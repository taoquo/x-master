import { computeHeuristicSuggestions } from "./heuristics.ts"
import {
  type AutoTagLlmProvider,
  type LlmVocabularyEntry
} from "./llmProvider.ts"
import { broadcastAutoTagProgress } from "../runtime/autotagProgress.ts"
import type { AutoTagProgress } from "../runtime/autotagProgress.ts"
import { getAllBookmarks } from "../storage/bookmarksStore.ts"
import {
  createLlmAnalysisRecord,
  getAllLlmAnalysis,
  hashAnalyzedContent,
  isAnalysisReusable,
  putLlmAnalysisRecords
} from "../storage/llmAnalysisStore.ts"
import { getSecrets } from "../storage/secrets.ts"
import { resolveAuth } from "../llm/auth/index.ts"
import { isLlmError } from "../llm/errors.ts"
import { createAutoTagLlmProvider } from "../llm/orchestrator.ts"
import { resolveBaseUrl, resolveProvider } from "../llm/providers.ts"
import {
  beginAutoTagRunState,
  finishAutoTagRun,
  getSettings,
  touchAutoTagRunState
} from "../storage/settings.ts"
import { createTagSuggestion, getAllTagSuggestions, insertNewTagSuggestions } from "../storage/suggestionsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../storage/tagsStore.ts"
import { canonicalTagKey } from "../tags/canonical.ts"
import { HEALTHY_TAG_COUNT_MAX } from "../tags/health.ts"
import type {
  AutoTagRunOutcome,
  BookmarkRecord,
  LlmAnalysisOutcome,
  LlmAnalysisRecord,
  TagSuggestionRecord
} from "../types.ts"

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
  // Candidates the run never reached because it stopped early. Non-zero means
  // "run again to continue" rather than "there is nothing left to do".
  unprocessedCount: number
  error?: string
}

// Wall-clock budget for the LLM step. A run must always reach finishRun: every
// outcome report, the cleared run state and the released background lock all
// hang off it. Per-request timeouts bound one batch, this bounds the run, and
// partial results are already persisted batch by batch.
//
// This must stay comfortably below Chrome's per-invocation limit for an MV3
// service worker (~5 minutes, which no keepalive resets). This used to be 8
// minutes, i.e. past the limit: the worker was killed mid-run, finishRun never
// ran, and the run state stayed "running" with the previous result on screen.
// The deadline is also handed to the provider, so one slow batch cannot outlive
// it either.
export const DEFAULT_LLM_RUN_BUDGET_MS = 4 * 60 * 1000

// Upper bound on a single batch. The heartbeat is refreshed once per batch, so
// the gap between heartbeats is one batch: without a cap on a batch, a batch
// could outlive the window other code uses to decide whether this run is still
// alive, and a healthy run would be taken over as if it had died. Kept well
// below that window (AUTO_TAG_RUN_STALE_MS).
export const DEFAULT_LLM_BATCH_BUDGET_MS = 2 * 60 * 1000

export interface LlmStepInput {
  bookmarks: BookmarkRecord[]
  taggedBookmarkIds: Set<string>
  // Bookmarks whose stored LLM verdict is still valid. Unlike the old set this
  // is not inferred from suggestion rows: a bookmark the model looked at and
  // deliberately skipped has no suggestion, yet it has certainly been analyzed.
  // Heuristic suggestions are still deliberately NOT part of this set, because
  // hashtag and author rules cover most of the library and treating them as
  // "analyzed" starved the LLM step down to zero candidates.
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
  // How many batches may be in flight at once. 1 restores strictly serial runs.
  concurrency?: number
  maxBookmarksPerRun: number
  provider: AutoTagLlmProvider
  // Called after every batch so results survive a worker shutdown mid-run.
  persistBatch?: (suggestions: TagSuggestionRecord[]) => Promise<{ insertedCount: number }>
  // Wall-clock budget for the whole step. Checked at batch boundaries, so the
  // worst case is one in-flight batch past the deadline.
  budgetMs?: number
  // Per-batch cap, so the heartbeat gap stays smaller than the window other code
  // uses to decide whether this run is alive.
  batchBudgetMs?: number
  now?: () => number
  // Called at every batch boundary with the progress so far. Returning true
  // stops the step and reports "cancelled". The pipeline wires this to the
  // persisted run state, so the same round-trip refreshes the heartbeat and
  // reads back any cancel the options page requested.
  shouldCancel?: (progress: { processed: number; total: number }) => boolean | Promise<boolean>
  // Progress detail is published through the caller because only it owns the run
  // identity, and therefore the persisted heartbeat the UI reads after a refresh.
  onProgress?: (progress: AutoTagProgress) => void
  // Records what the model decided about every bookmark in a finished batch,
  // including the ones it produced nothing for. Without this the zero-result
  // bookmarks stayed at the head of the queue and were re-sent every run.
  persistAnalysis?: (records: LlmAnalysisRecord[]) => Promise<unknown>
  // Identifies the verdicts this run produces, so a later run can tell whether
  // a stored verdict still answers the current question.
  model?: string
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
  // Candidates the step selected but never sent, because it stopped early.
  unprocessedCount: number
  // Set when the step returned before issuing a single request, so the caller
  // can tell "nothing left to analyze" apart from "nothing to analyze with",
  // plus the two early-stop reasons that leave work behind on purpose.
  stoppedReason?: "no-candidates" | "empty-vocabulary" | "deadline" | "cancelled"
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
      unprocessedCount: candidates.length,
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

  const now = input.now ?? (() => Date.now())
  const budgetMs = input.budgetMs ?? DEFAULT_LLM_RUN_BUDGET_MS
  const batchBudgetMs = input.batchBudgetMs ?? DEFAULT_LLM_BATCH_BUDGET_MS
  const deadlineAt = Number.isFinite(budgetMs) ? now() + budgetMs : Number.POSITIVE_INFINITY
  let stoppedReason: "deadline" | "cancelled" | undefined

    // Batches are independent requests, so they are issued in waves. Per-request
    // latency dominates the run's wall clock, and the run budget is capped by
    // Chrome's per-invocation limit, so overlapping a few batches is what lets a run
    // finish instead of stopping at the deadline. The unit of parallelism is the
    // batch, never the bookmark: the instruction block and the vocabulary are a fixed
    // prefix that is only worth paying once per request.
    const maxConcurrency = Math.max(1, Math.min(4, Math.trunc(input.concurrency ?? 1)))
    let activeConcurrency = maxConcurrency
    // Advanced by the size of the wave actually issued, never by the current
    // concurrency: a wave that shrinks after a 429 would otherwise re-send the
    // batches it just covered.
    let offset = 0

    while (offset < candidates.length) {
    // Checked before the wave, never in the middle of one: batches already in flight
    // run to completion so their results still get persisted.
    if (input.shouldCancel && (await input.shouldCancel({ processed: processedCount, total: candidates.length }))) {
      stoppedReason = "cancelled"
      break
    }

    if (now() >= deadlineAt) {
      stoppedReason = "deadline"
      break
    }

    const waveBatches: BookmarkRecord[][] = []
    for (let index = 0; index < activeConcurrency; index += 1) {
      const start = offset + index * input.batchSize
      if (start >= candidates.length) {
        break
      }

      waveBatches.push(candidates.slice(start, start + input.batchSize))
    }

    offset += input.batchSize * waveBatches.length

    // Announced once per wave, before the requests go out: a wave is what may take a
    // minute plus a backoff, and without this the bar would sit still for that whole
    // time with no way to tell "waiting" from "wedged".
    const batchStartedAt = new Date().toISOString()
    input.onProgress?.({
      phase: "llm",
      processed: processedCount,
      total: candidates.length,
      status: "running",
      inFlight: true,
      batchStartedAt,
      ...(input.model ? { model: input.model } : {})
    })

    // Per-batch isolation: one provider error (or a malformed response) must not
    // abandon the other batches in the wave, nor the batches already persisted.
    const waveOutcomes = await Promise.all(
      waveBatches.map(async (waveBatch) => {
        try {
          const results = await input.provider.suggestTags({
            // A provider that asks us to back off is reported as waiting, so the UI
            // can say "waiting on the provider" instead of looking frozen. The wait
            // is persisted too, so a refresh during a rate limit still shows it.
            onWait: ({ waitMs }) => {
              input.onProgress?.({
                phase: "llm",
                processed: processedCount,
                total: candidates.length,
                status: "waiting",
                inFlight: true,
                waitingUntilMs: Date.now() + waitMs,
                waitingReason: "rate-limit",
                ...(input.model ? { model: input.model } : {})
              })
            },
            bookmarks: waveBatch.map((bookmark) => ({
              tweetId: bookmark.tweetId,
              authorHandle: bookmark.authorHandle,
              text: bookmark.text
            })),
            vocabulary: [...vocabulary.values()],
            // A wave shares one budget snapshot: concurrent batches may each spend
            // from it, and the accounting below still clamps the total, so the run
            // can overshoot by at most (concurrency - 1) new tags.
            allowNewTags: input.allowNewTags && remainingNewTagBudget > 0,
            newTagBudget: Number.isFinite(remainingNewTagBudget) ? remainingNewTagBudget : undefined,
            // The provider enforces this too: a single batch can otherwise burn 5
            // attempts x the request timeout plus backoff and outlive the run budget,
            // which is what let a run die without reaching finishRun. Capped per batch
            // as well, so the heartbeat gap stays inside the window that decides
            // whether this run is still alive.
            deadlineMs: Math.min(deadlineAt, now() + batchBudgetMs)
          })

          return { ok: true as const, results }
        } catch (error) {
          return { ok: false as const, error }
        }
      })
    )

    // A rate limit is a property of the provider, not of one batch: shrink the wave
    // for the rest of the run instead of hammering it, and let the per-batch backoff
    // do its work.
    if (waveOutcomes.some((outcome) => !outcome.ok && isRateLimitFailure(outcome.error))) {
      activeConcurrency = Math.max(1, Math.floor(activeConcurrency / 2))
    }

    for (let index = 0; index < waveBatches.length; index += 1) {
      const batch = waveBatches[index]
      const outcome = waveOutcomes[index]
      batchCount += 1

      if (!outcome.ok) {
        failedBatchCount += 1
        lastError = outcome.error instanceof Error ? outcome.error.message : String(outcome.error)
        continue
      }

      const results = outcome.results
      processedCount += batch.length


      const batchSuggestions: TagSuggestionRecord[] = []
      // Every bookmark in a finished batch gets a verdict, even the ones the model
      // ignored entirely. "The model saw this and said nothing" is a real answer
      // and has to be recorded, otherwise it is indistinguishable from "never
      // looked at" and gets re-sent on every later run.
      const batchVerdicts = new Map<string, { tagged: number; blocked: number; budgetDropped: number }>()
      for (const bookmark of batch) {
        batchVerdicts.set(bookmark.tweetId, { tagged: 0, blocked: 0, budgetDropped: 0 })
      }

      for (const result of results) {
        const verdict = batchVerdicts.get(result.tweetId)

        for (const tag of result.tags) {
          const key = canonicalTagKey(tag.name)
          if (!key) {
            continue
          }

          if (blockedKeys.has(key)) {
            blockedDroppedCount += 1
            if (verdict) {
              verdict.blocked += 1
            }
            continue
          }

          const known = vocabulary.get(key)

          if (!known) {
            if (!input.allowNewTags || remainingNewTagBudget <= 0) {
              budgetDroppedCount += 1
              if (verdict) {
                verdict.budgetDropped += 1
              }
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
            if (verdict) {
              verdict.tagged += 1
            }

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

      if (input.persistAnalysis) {
        const textByTweetId = new Map(batch.map((bookmark) => [bookmark.tweetId, bookmark.text]))
        const records: LlmAnalysisRecord[] = []

        for (const [tweetId, verdict] of batchVerdicts) {
          // A dropped tag is reported rather than hidden behind "no topic": the
          // model did find a subject, the run's own rules refused it, and the
          // ledger has to say which so the outcome stays explainable.
          const outcome: LlmAnalysisOutcome = verdict.tagged
            ? "tagged"
            : verdict.blocked
              ? "all-blocked"
              : verdict.budgetDropped
                ? "budget-dropped"
                : "no-topic"

          records.push(
            createLlmAnalysisRecord({
              bookmarkId: tweetId,
              model: input.model ?? "",
              contentHash: hashAnalyzedContent(textByTweetId.get(tweetId) ?? ""),
              outcome,
              tagCount: verdict.tagged
            })
          )
        }

        await input.persistAnalysis(records)
      }

    }

    // Announced once per wave, after every batch in it has been processed: a per-batch
    // "done" would clear the in-flight marker while the rest of the wave was still
    // running, which is exactly the "is it stuck?" question the marker answers.
    input.onProgress?.({
      phase: "llm",
      processed: processedCount,
      total: candidates.length,
      status: "running",
      inFlight: false,
      ...(input.model ? { model: input.model } : {})
    })
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
    unprocessedCount: candidates.length - processedCount,
    ...(stoppedReason ? { stoppedReason } : {}),
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
// hardest thing to debug in this feature. finishRun also clears the in-flight
// run state, which is what releases the panel from showing "running".
// A rate limit is the one failure worth reacting to globally: it describes the
// provider's current capacity, not the batch that happened to hit it.
function isRateLimitFailure(error: unknown): boolean {
  if (isLlmError(error)) {
    return error.kind === "rate-limit"
  }

  const message = error instanceof Error ? error.message : String(error)
  return message.includes("429") || /rate ?limit/i.test(message)
}

async function finishRun(result: AutoTagRunResult, runId?: string): Promise<AutoTagRunResult> {
  let pendingCount = 0
  try {
    pendingCount = (await getAllTagSuggestions()).filter((suggestion) => suggestion.status === "pending").length
  } catch {
    pendingCount = 0
  }

  try {
    // Scoped to the run that owns the state: a run superseded by a takeover must
    // not clear the replacement's state (which would leave it looking finished
    // but still running, and uncancellable) nor publish its own discarded report.
    await finishAutoTagRun({
      runId,
      summary: {
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
        unprocessedCount: result.unprocessedCount,
        ...(result.error ? { error: result.error } : {})
      }
    })
  } catch {
    // Reporting is best-effort; never fail a run because of it.
  }

  return result
}

// A run that throws must still report. Without this, a failure anywhere between
// publishing the run state and reaching finishRun left the state behind with a
// frozen heartbeat: the panel showed the previous result while the state claimed
// a run was still in flight.
function failedRunResult(error: unknown): AutoTagRunResult {
  return {
    ran: true,
    outcome: "failed",
    suggestedCount: 0,
    llmProcessedCount: 0,
    skippedCount: 0,
    candidateCount: 0,
    llmBatchCount: 0,
    llmFailedBatchCount: 0,
    newTagBudget: 0,
    vocabularySize: 0,
    blockedTagKeyCount: 0,
    blockedDroppedCount: 0,
    budgetDroppedCount: 0,
    unprocessedCount: 0,
    error: error instanceof Error ? error.message : String(error)
  }
}

export async function runAutoTagPipeline(options?: {
  createLlmProvider?: (input: { apiKey: string; baseUrl: string; model: string }) => AutoTagLlmProvider
  // Wall-clock budget for the LLM step, exposed for tests.
  llmBudgetMs?: number
  now?: () => number
  // Injectable like the provider: the rule-engine write is the one await between
  // publishing the run state and the LLM step, so tests use it to force a storage
  // failure and to land a cancel while the rules are still running.
  insertSuggestions?: typeof insertNewTagSuggestions
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
      budgetDroppedCount: 0,
      unprocessedCount: 0
    })
  }

  // The one-time hashtag backfill used to run here, which made it unreachable
  // whenever auto-tagging was off (the default): the early return above fired
  // first, so existing bookmarks kept hashtags: undefined and the hashtag rule
  // had nothing to work with. It now runs on the sync path instead
  // (src/background/index.ts), independently of this pipeline's gate.
  const [bookmarks, tags, bookmarkTags, suggestions, llmAnalysis] = await Promise.all([
    getAllBookmarks(),
    getAllTags(),
    getAllBookmarkTags(),
    getAllTagSuggestions(),
    getAllLlmAnalysis()
  ])

  broadcastAutoTagProgress({ phase: "heuristics", processed: 0, total: bookmarks.length })
  // Published before the first request so a run killed mid-flight (worker
  // recycled, browser closed) still leaves a trace instead of looking frozen.
  // The returned runId is this run's identity: every later state write is
  // scoped to it, so a takeover cannot leave two runs fighting over one state.
  const runState = await beginAutoTagRunState({ phase: "heuristics", total: bookmarks.length })
  const runId = runState?.runId

  const heuristicSuggestions = computeHeuristicSuggestions({
    bookmarks,
    tags,
    bookmarkTags,
    suggestions,
    settings: settings.autoTag.heuristics,
    blockedTagKeys: settings.autoTag.blockedTagKeys
  })

  let insertedCount = 0
  try {
    const insertSuggestions = options?.insertSuggestions ?? insertNewTagSuggestions
    insertedCount = (await insertSuggestions(heuristicSuggestions)).insertedCount
  } catch (error) {
    // A storage failure here must not leave the run state behind: every exit
    // after publishing the state has to go through finishRun.
    return finishRun(failedRunResult(error), runId)
  }

  broadcastAutoTagProgress({ phase: "heuristics", processed: bookmarks.length, total: bookmarks.length })

  // A cancel requested while the rules were running had no checkpoint of its own:
  // the only read used to be at LLM batch boundaries, so a cancel aimed at a
  // rules-only run (or one that never reached the LLM) was accepted and then
  // silently ignored.
  const heuristicsCheckpoint = await touchAutoTagRunState({
    runId,
    phase: "heuristics",
    processed: bookmarks.length,
    total: bookmarks.length
  }).catch(() => undefined)
  const stoppedAfterHeuristics =
    heuristicsCheckpoint !== undefined &&
    (heuristicsCheckpoint.ownsState
      ? Boolean(heuristicsCheckpoint.state?.cancelRequested)
      : runId !== undefined)

  let llmInsertedCount = 0
  let llmProcessedCount = 0
  let llmSkippedCount = 0
  let outcome: AutoTagRunOutcome = stoppedAfterHeuristics ? "cancelled" : "ok"
  let candidateCount = 0
  let llmBatchCount = 0
  let llmFailedBatchCount = 0
  let newTagBudget = 0
  let llmBlockedDroppedCount = 0
  let llmBudgetDroppedCount = 0
  let llmUnprocessedCount = 0
  let runError: string | undefined

  const llmSettings = settings.autoTag.llm

  if (stoppedAfterHeuristics) {
    // The rules already wrote their suggestions; skipping the LLM step is the
    // whole point of the cancel, and the kept count tells the user where it left off.
  } else if (!llmSettings.enabled) {
    outcome = "llm-disabled"
  } else {
    // A secrets read failure degrades to "no credential" instead of throwing out of
    // the published run state.
    const secrets = await getSecrets().catch(() => undefined)
    const configuredProvider = resolveProvider(llmSettings.activeProviderId)
    // The credential comes from the active provider's profile, with the legacy
    // single-key field as a fallback for installs that predate the provider table.
    const auth = await resolveAuth(llmSettings.activeProviderId, {
      allowLegacy: true,
      ...(secrets ? { secrets } : {})
    }).catch(() => undefined)
    // A keyless local endpoint is configured without a credential.
    const needsApiKey = configuredProvider.credentialKind !== "api-key-or-none"

    if (needsApiKey && !auth?.apiKey) {
      outcome = "missing-api-key"
    } else {
      const provider = options?.createLlmProvider
        ? options.createLlmProvider({
            apiKey: auth?.apiKey ?? "",
            baseUrl: resolveBaseUrl(configuredProvider, llmSettings.baseUrl),
            model: llmSettings.model
          })
        : createAutoTagLlmProvider({ settings: llmSettings, credential: auth })

      const taggedBookmarkIds = new Set(bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
      // The ledger, not the suggestion rows, decides what has been analyzed. A
      // bookmark the model deliberately skipped leaves no suggestion behind, so
      // inferring from suggestions kept re-sending exactly those bookmarks on
      // every run while newer ones never reached the candidate window.
      //
      // A stored verdict is only reused while it still answers the current
      // question: same prompt version, same model, same text.
      const analysisByBookmarkId = new Map(llmAnalysis.map((record) => [record.bookmarkId, record]))
      const llmAnalyzedBookmarkIds = new Set(
        bookmarks
          .filter((bookmark) =>
            isAnalysisReusable(analysisByBookmarkId.get(bookmark.tweetId), {
              model: llmSettings.model,
              contentHash: hashAnalyzedContent(bookmark.text)
            })
          )
          .map((bookmark) => bookmark.tweetId)
      )
      // Bookmarks carrying an LLM suggestion from before the ledger existed are
      // still analyzed; without this every pre-upgrade library would be re-sent
      // in full on the first run after the update.
      for (const suggestion of suggestions) {
        if (suggestion.source === "llm") {
          llmAnalyzedBookmarkIds.add(suggestion.bookmarkId)
        }
      }
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
          concurrency: llmSettings.concurrency,
          maxBookmarksPerRun: llmSettings.maxBookmarksPerRun,
          provider,
          persistBatch: insertNewTagSuggestions,
          persistAnalysis: putLlmAnalysisRecords,
          model: llmSettings.model,
          budgetMs: options?.llmBudgetMs,
          ...(options?.now ? { now: options.now } : {}),
          // The persisted state is the source of truth the UI re-reads after a
          // refresh; the broadcast only lowers the latency. Detail that cannot be
          // expressed by a plain heartbeat (in flight, waiting until) is written
          // here too, so a refresh during a rate limit still shows the wait.
          onProgress: (progress: AutoTagProgress) => {
            void touchAutoTagRunState({
              runId,
              phase: progress.phase,
              processed: progress.processed,
              total: progress.total,
              ...(progress.status ? { status: progress.status } : {}),
              ...(progress.inFlight === undefined ? {} : { inFlight: progress.inFlight }),
              ...(progress.batchStartedAt ? { batchStartedAt: progress.batchStartedAt } : {}),
              ...(progress.waitingUntilMs === undefined ? {} : { waitingUntilMs: progress.waitingUntilMs }),
              ...(progress.waitingReason ? { waitingReason: progress.waitingReason } : {}),
              ...(llmSettings.model ? { model: llmSettings.model } : {})
            }).catch(() => undefined)

            broadcastAutoTagProgress(progress)
          },
          // One round-trip per batch boundary: refresh the heartbeat and read
          // back a cancel the options page may have requested.
          shouldCancel: async (progress) => {
            const touched = await touchAutoTagRunState({
              runId,
              phase: "llm",
              processed: progress.processed,
              total: progress.total
            }).catch(() => undefined)

            if (!touched) {
              return false
            }

            // Losing the state means another run took over: it owns the state and
            // the report now. Stopping here is what keeps two live pipelines from
            // both spending on the same bookmarks.
            if (runId !== undefined && !touched.ownsState) {
              return true
            }

            return Boolean(touched.state?.cancelRequested)
          }
        })

        llmProcessedCount = llmResult.processedCount
        candidateCount = llmResult.candidateCount
        llmBatchCount = llmResult.batchCount
        llmFailedBatchCount = llmResult.failedBatchCount
        llmInsertedCount = llmResult.insertedCount
        llmSkippedCount = llmResult.suggestions.length - llmResult.insertedCount
        llmBlockedDroppedCount = llmResult.blockedDroppedCount
        llmBudgetDroppedCount = llmResult.budgetDroppedCount
        llmUnprocessedCount = llmResult.unprocessedCount

        // A run that issued zero batches while candidates were waiting is never
        // "ok": either there was nothing left to analyze, or the vocabulary was
        // empty in a mode that forbids new tags.
        if (llmResult.stoppedReason === "empty-vocabulary") {
          outcome = "empty-vocabulary"
        } else if (!candidateCount || llmResult.stoppedReason === "no-candidates") {
          outcome = "no-candidates"
        } else if (llmResult.stoppedReason === "cancelled") {
          // Partial success: batches already persisted stay, and the leftover
          // count tells the user the queue is simply where they left it.
          outcome = "cancelled"
        } else if (llmResult.stoppedReason === "deadline") {
          outcome = "timed-out"
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
    unprocessedCount: llmUnprocessedCount,
    ...(runError ? { error: runError } : {})
  }, runId)
}
