import { computeHeuristicSuggestions } from "./heuristics.ts"
import {
  createOpenAiCompatibleProvider,
  type AutoTagLlmProvider,
  type LlmVocabularyEntry
} from "./llmProvider.ts"
import { broadcastAutoTagProgress } from "../runtime/autotagProgress.ts"
import { backfillHashtagsFromRawPayloads } from "../storage/backfillHashtags.ts"
import { getAllBookmarks } from "../storage/bookmarksStore.ts"
import { getSecrets } from "../storage/secrets.ts"
import { getSettings, updateSettings } from "../storage/settings.ts"
import { createTagSuggestion, getAllTagSuggestions, insertNewTagSuggestions } from "../storage/suggestionsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../storage/tagsStore.ts"
import { canonicalTagKey } from "../tags/canonical.ts"
import { HEALTHY_TAG_COUNT_MAX } from "../tags/health.ts"
import type { AutoTagRunOutcome, BookmarkRecord, TagSuggestionRecord } from "../types.ts"

export interface AutoTagRunResult {
  ran: boolean
  suggestedCount: number
  llmProcessedCount: number
  skippedCount: number
  outcome: AutoTagRunOutcome
  candidateCount: number
  llmBatchCount: number
  llmFailedBatchCount: number
  newTagBudget: number
  vocabularySize: number
  blockedTagKeyCount: number
  // Suggestions the LLM returned that were thrown away because the tag name is
  // on the block list. A large count means the block list, not the model, is
  // the reason a run produced nothing.
  blockedDroppedCount: number
  // Suggestions dropped because the run had already spent its new-tag budget.
  // A large count means the guarded budget, not the model, ate the results.
  budgetDroppedCount: number
  error?: string
}

interface LlmStepInput {
  bookmarks: BookmarkRecord[]
  taggedBookmarkIds: Set<string>
  // Bookmarks the LLM already looked at, in any suggestion status. Excluding
  // them stops a run from re-analyzing the same newest batch forever (rejected
  // suggestions used to keep the window pinned to the head of the library).
  // Heuristic suggestions are deliberately NOT part of this set: hashtag and
  // author rules cover most of the library, and treating them as "analyzed"
  // starved the LLM step down to zero candidates.
  llmAnalyzedBookmarkIds: Set<string>
  // Bookmarks a rule already suggested a tag for. They stay eligible, but the
  // per-run window prefers bookmarks nothing has touched yet.
  deprioritizedBookmarkIds?: Set<string>
  vocabulary: LlmVocabularyEntry[]
  allowNewTags: boolean
  // Total number of new tags the run may introduce. "guarded" mode derives this
  // from the candidate count; "open" mode passes Infinity.
  newTagBudget?: number
  blockedTagKeys?: string[]
  batchSize: number
  maxBookmarksPerRun: number
  provider: AutoTagLlmProvider
  // Called after every batch so results survive a worker shutdown mid-run.
  persistBatch?: (suggestions: TagSuggestionRecord[]) => Promise<{ insertedCount: number }>
}

// LLM step: serially feeds batches of still-untagged bookmarks to the
// provider and converts responses into pending suggestions. A failed batch
// only loses its own results.
//
// The vocabulary is accumulated across batches: any new tag accepted in batch N
// is offered to batch N+1, which is what stops one run from inventing
// "ai agent", "ai agents" and "agentic ai" for the same concept.
export async function runLlmSuggestionStep(input: LlmStepInput): Promise<{
  suggestions: TagSuggestionRecord[]
  processedCount: number
  candidateCount: number
  batchCount: number
  failedBatchCount: number
  insertedCount: number
  // Tags the model returned that the block list rejected.
  blockedDroppedCount: number
  // Tags the model returned that the new-tag budget rejected.
  budgetDroppedCount: number
  // Set when the step returned before issuing a single request, so the caller
  // can tell "nothing left to analyze" apart from "nothing to analyze with".
  stoppedReason?: "no-candidates" | "empty-vocabulary"
  lastError?: string
}> {
  const eligible = input.bookmarks.filter(
    (bookmark) =>
      !input.taggedBookmarkIds.has(bookmark.tweetId) &&
      !input.llmAnalyzedBookmarkIds.has(bookmark.tweetId)
  )
  const deprioritized = input.deprioritizedBookmarkIds
  const ordered = deprioritized
    ? [
        ...eligible.filter((bookmark) => !deprioritized.has(bookmark.tweetId)),
        ...eligible.filter((bookmark) => deprioritized.has(bookmark.tweetId))
      ]
    : eligible
  const candidates = ordered.slice(0, input.maxBookmarksPerRun)

  if (!candidates.length || (!input.allowNewTags && !input.vocabulary.length)) {
    return {
      suggestions: [],
      processedCount: 0,
      candidateCount: eligible.length,
      batchCount: 0,
      failedBatchCount: 0,
      insertedCount: 0,
      blockedDroppedCount: 0,
      budgetDroppedCount: 0,
      stoppedReason: candidates.length ? "empty-vocabulary" : "no-candidates"
    }
  }

  const suggestions: TagSuggestionRecord[] = []
  let processedCount = 0
  let batchCount = 0
  let failedBatchCount = 0
  let insertedCount = 0
  let blockedDroppedCount = 0
  let budgetDroppedCount = 0
  let lastError: string | undefined

  const vocabulary = new Map<string, LlmVocabularyEntry>()
  for (const entry of input.vocabulary) {
    const key = canonicalTagKey(entry.name)
    if (key) {
      vocabulary.set(key, entry)
    }
  }

  const blockedKeys = new Set(input.blockedTagKeys ?? [])
  let remainingNewTagBudget = input.allowNewTags ? input.newTagBudget ?? Number.POSITIVE_INFINITY : 0

  for (let offset = 0; offset < candidates.length; offset += input.batchSize) {
    const batch = candidates.slice(offset, offset + input.batchSize)
    batchCount += 1

    // Per-batch isolation: one provider error (or a malformed response) must
    // not abandon the batches that already succeeded.
    let results: Awaited<ReturnType<AutoTagLlmProvider["suggestTags"]>>
    try {
      results = await input.provider.suggestTags({
        bookmarks: batch.map((bookmark) => ({
          tweetId: bookmark.tweetId,
          authorHandle: bookmark.authorHandle,
          text: bookmark.text
        })),
        vocabulary: [...vocabulary.values()],
        allowNewTags: input.allowNewTags && remainingNewTagBudget > 0,
        newTagBudget: Number.isFinite(remainingNewTagBudget) ? remainingNewTagBudget : undefined
      })
    } catch (error) {
      failedBatchCount += 1
      lastError = error instanceof Error ? error.message : String(error)
      continue
    }

    processedCount += batch.length

    const batchSuggestions: TagSuggestionRecord[] = []

    for (const result of results) {
      for (const tag of result.tags) {
        const key = canonicalTagKey(tag.name)
        if (!key) {
          continue
        }

        if (blockedKeys.has(key)) {
          blockedDroppedCount += 1
          continue
        }

        const known = vocabulary.get(key)

        if (!known) {
          if (!input.allowNewTags || remainingNewTagBudget <= 0) {
            budgetDroppedCount += 1
            continue
          }

          remainingNewTagBudget -= 1
        }

        const suggestion = createTagSuggestion({
          bookmarkId: result.tweetId,
          // Reuse the stored spelling so a run cannot create casing variants.
          tagName: known?.name ?? tag.name,
          source: "llm",
          confidence: tag.confidence
        })

        if (suggestion) {
          suggestions.push(suggestion)
          batchSuggestions.push(suggestion)

          if (known) {
            known.count += 1
          } else {
            vocabulary.set(key, { name: tag.name, count: 1 })
          }
        }
      }
    }

    if (input.persistBatch && batchSuggestions.length) {
      const persisted = await input.persistBatch(batchSuggestions)
      insertedCount += persisted.insertedCount
    }

    broadcastAutoTagProgress({ phase: "llm", processed: processedCount, total: candidates.length })
  }

  return {
    suggestions,
    processedCount,
    candidateCount: eligible.length,
    batchCount,
    failedBatchCount,
    insertedCount,
    blockedDroppedCount,
    budgetDroppedCount,
    ...(lastError ? { lastError } : {})
  }
}

// A healthy library holds 30-50 durable subject tags. Once it reaches the upper
// bound "guarded" mode stops minting tags altogether and behaves like "closed",
// which is what keeps the long tail from growing run after run.
//
// "guarded" mode budget: roughly one new tag per 150 candidate bookmarks, with
// a floor of 1 so a fresh library can still bootstrap a taxonomy, and a ceiling
// of the headroom left before the healthy size is reached.
export function resolveNewTagBudget(mode: string, candidateCount: number, vocabularySize = 0) {
  if (mode === "open") {
    return Number.POSITIVE_INFINITY
  }

  if (mode !== "guarded") {
    return 0
  }

  const headroom = Math.max(0, HEALTHY_TAG_COUNT_MAX - vocabularySize)
  return Math.min(headroom, Math.max(1, Math.ceil(candidateCount / 150)))
}

// Orchestrates one auto-tag run: heuristics first, LLM later (P5) for the
// bookmarks the rules could not cover. Suggestion writes are idempotent via
// insertNewTagSuggestions, so re-running is always safe.
//
// Every exit path goes through finishRun so the settings panel can always tell
// the user what happened; a run that silently does nothing is the single
// hardest thing to debug in this feature.
async function finishRun(result: AutoTagRunResult): Promise<AutoTagRunResult> {
  let pendingCount = 0
  try {
    pendingCount = (await getAllTagSuggestions()).filter((suggestion) => suggestion.status === "pending").length
  } catch {
    pendingCount = 0
  }

  try {
    await updateSettings({
      lastAutoTagRun: {
        finishedAt: new Date().toISOString(),
        outcome: result.outcome,
        suggestedCount: result.suggestedCount,
        pendingCount,
        candidateCount: result.candidateCount,
        llmProcessedCount: result.llmProcessedCount,
        llmBatchCount: result.llmBatchCount,
        llmFailedBatchCount: result.llmFailedBatchCount,
        newTagBudget: Number.isFinite(result.newTagBudget) ? result.newTagBudget : -1,
        vocabularySize: result.vocabularySize,
        blockedTagKeyCount: result.blockedTagKeyCount,
        blockedDroppedCount: result.blockedDroppedCount,
        budgetDroppedCount: result.budgetDroppedCount,
        ...(result.error ? { error: result.error } : {})
      }
    })
  } catch {
    // Reporting is best-effort; never fail a run because of it.
  }

  return result
}

export async function runAutoTagPipeline(options?: {
  createLlmProvider?: (input: { apiKey: string; baseUrl: string; model: string }) => AutoTagLlmProvider
}): Promise<AutoTagRunResult> {
  const settings = await getSettings()

  if (!settings.autoTag.enabled) {
    return finishRun({
      ran: false,
      outcome: "disabled",
      suggestedCount: 0,
      llmProcessedCount: 0,
      skippedCount: 0,
      candidateCount: 0,
      llmBatchCount: 0,
      llmFailedBatchCount: 0,
      newTagBudget: 0,
      vocabularySize: 0,
      blockedTagKeyCount: settings.autoTag.blockedTagKeys.length,
      blockedDroppedCount: 0,
      budgetDroppedCount: 0
    })
  }

  await backfillHashtagsFromRawPayloads()

  const [bookmarks, tags, bookmarkTags, suggestions] = await Promise.all([
    getAllBookmarks(),
    getAllTags(),
    getAllBookmarkTags(),
    getAllTagSuggestions()
  ])

  broadcastAutoTagProgress({ phase: "heuristics", processed: 0, total: bookmarks.length })

  const heuristicSuggestions = computeHeuristicSuggestions({
    bookmarks,
    tags,
    bookmarkTags,
    suggestions,
    settings: settings.autoTag.heuristics,
    blockedTagKeys: settings.autoTag.blockedTagKeys
  })

  const { insertedCount } = await insertNewTagSuggestions(heuristicSuggestions)

  broadcastAutoTagProgress({ phase: "heuristics", processed: bookmarks.length, total: bookmarks.length })

  let llmInsertedCount = 0
  let llmProcessedCount = 0
  let llmSkippedCount = 0
  let outcome: AutoTagRunOutcome = "ok"
  let candidateCount = 0
  let llmBatchCount = 0
  let llmFailedBatchCount = 0
  let newTagBudget = 0
  let llmBlockedDroppedCount = 0
  let llmBudgetDroppedCount = 0
  let runError: string | undefined

  const llmSettings = settings.autoTag.llm
  if (!llmSettings.enabled) {
    outcome = "llm-disabled"
  } else {
    const { llmApiKey } = await getSecrets()

    if (!llmApiKey) {
      outcome = "missing-api-key"
    } else {
      const provider = options?.createLlmProvider
        ? options.createLlmProvider({ apiKey: llmApiKey, baseUrl: llmSettings.baseUrl, model: llmSettings.model })
        : createOpenAiCompatibleProvider({ settings: llmSettings, apiKey: llmApiKey })

      const taggedBookmarkIds = new Set(bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
      // Only previous LLM verdicts retire a bookmark from the LLM queue.
      // Heuristic (hashtag/author/keyword) suggestions must not, otherwise the
      // rule step consumes every candidate and the LLM never runs.
      const llmAnalyzedBookmarkIds = new Set(
        suggestions.filter((suggestion) => suggestion.source === "llm").map((suggestion) => suggestion.bookmarkId)
      )
      const ruleSuggestedBookmarkIds = new Set(
        [...suggestions, ...heuristicSuggestions]
          .filter((suggestion) => suggestion.source !== "llm")
          .map((suggestion) => suggestion.bookmarkId)
      )

      const bookmarkCountByTagId = new Map<string, number>()
      for (const bookmarkTag of bookmarkTags) {
        bookmarkCountByTagId.set(bookmarkTag.tagId, (bookmarkCountByTagId.get(bookmarkTag.tagId) ?? 0) + 1)
      }

      const eligibleCount = bookmarks.filter(
        (bookmark) => !taggedBookmarkIds.has(bookmark.tweetId) && !llmAnalyzedBookmarkIds.has(bookmark.tweetId)
      ).length

      newTagBudget = resolveNewTagBudget(
        llmSettings.tagVocabularyMode,
        Math.min(eligibleCount, llmSettings.maxBookmarksPerRun),
        tags.length
      )

      try {
        const llmResult = await runLlmSuggestionStep({
          bookmarks,
          taggedBookmarkIds,
          llmAnalyzedBookmarkIds,
          deprioritizedBookmarkIds: ruleSuggestedBookmarkIds,
          vocabulary: tags.map((tag) => ({ name: tag.name, count: bookmarkCountByTagId.get(tag.id) ?? 0 })),
          allowNewTags: llmSettings.tagVocabularyMode !== "closed",
          newTagBudget,
          blockedTagKeys: settings.autoTag.blockedTagKeys,
          batchSize: llmSettings.batchSize,
          maxBookmarksPerRun: llmSettings.maxBookmarksPerRun,
          provider,
          persistBatch: insertNewTagSuggestions
        })

        llmProcessedCount = llmResult.processedCount
        candidateCount = llmResult.candidateCount
        llmBatchCount = llmResult.batchCount
        llmFailedBatchCount = llmResult.failedBatchCount
        llmInsertedCount = llmResult.insertedCount
        llmSkippedCount = llmResult.suggestions.length - llmResult.insertedCount
        llmBlockedDroppedCount = llmResult.blockedDroppedCount
        llmBudgetDroppedCount = llmResult.budgetDroppedCount

        // A run that issued zero batches while candidates were waiting is never
        // "ok": either there was nothing left to analyze, or the vocabulary was
        // empty in a mode that forbids new tags.
        if (llmResult.stoppedReason === "empty-vocabulary") {
          outcome = "empty-vocabulary"
        } else if (!candidateCount || llmResult.stoppedReason === "no-candidates") {
          outcome = "no-candidates"
        } else if (llmBatchCount > 0 && llmFailedBatchCount === llmBatchCount) {
          outcome = "failed"
          runError = llmResult.lastError ?? "all-batches-failed"
        } else if (!llmResult.suggestions.length && llmBlockedDroppedCount > 0) {
          // The model answered, but every name it proposed is on the block list.
          // Reporting this as "ok" is what made the feature look broken.
          outcome = "all-blocked"
        } else if (!llmResult.suggestions.length && llmBudgetDroppedCount > 0) {
          // The model answered with nothing but new tag names while the run had
          // no new-tag budget left. Same failure shape as "all-blocked": a
          // successful run that stored nothing, so it needs its own outcome.
          outcome = "budget-exhausted"
        }
      } catch (error) {
        outcome = "failed"
        runError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  return finishRun({
    ran: true,
    outcome,
    suggestedCount: insertedCount + llmInsertedCount,
    llmProcessedCount,
    skippedCount: heuristicSuggestions.length - insertedCount + llmSkippedCount,
    candidateCount,
    llmBatchCount,
    llmFailedBatchCount,
    newTagBudget,
    vocabularySize: tags.length,
    blockedTagKeyCount: settings.autoTag.blockedTagKeys.length,
    blockedDroppedCount: llmBlockedDroppedCount,
    budgetDroppedCount: llmBudgetDroppedCount,
    ...(runError ? { error: runError } : {})
  })
}
