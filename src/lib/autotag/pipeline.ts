import { computeHeuristicSuggestions } from "./heuristics.ts"
import { createOpenAiCompatibleProvider, type AutoTagLlmProvider } from "./llmProvider.ts"
import { broadcastAutoTagProgress } from "../runtime/autotagProgress.ts"
import { backfillHashtagsFromRawPayloads } from "../storage/backfillHashtags.ts"
import { getAllBookmarks } from "../storage/bookmarksStore.ts"
import { getSecrets } from "../storage/secrets.ts"
import { getSettings } from "../storage/settings.ts"
import { createTagSuggestion, getAllTagSuggestions, insertNewTagSuggestions } from "../storage/suggestionsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../storage/tagsStore.ts"
import type { BookmarkRecord, TagSuggestionRecord } from "../types.ts"

export interface AutoTagRunResult {
  ran: boolean
  suggestedCount: number
  llmProcessedCount: number
  skippedCount: number
}

interface LlmStepInput {
  bookmarks: BookmarkRecord[]
  taggedBookmarkIds: Set<string>
  pendingSuggestionBookmarkIds: Set<string>
  vocabulary: string[]
  allowNewTags: boolean
  batchSize: number
  maxBookmarksPerRun: number
  provider: AutoTagLlmProvider
}

// LLM step: serially feeds batches of still-untagged bookmarks to the
// provider and converts responses into pending suggestions. A failed batch
// only loses its own results.
export async function runLlmSuggestionStep(input: LlmStepInput): Promise<{
  suggestions: TagSuggestionRecord[]
  processedCount: number
}> {
  const candidates = input.bookmarks
    .filter(
      (bookmark) =>
        !input.taggedBookmarkIds.has(bookmark.tweetId) &&
        !input.pendingSuggestionBookmarkIds.has(bookmark.tweetId)
    )
    .slice(0, input.maxBookmarksPerRun)

  if (!candidates.length || (!input.allowNewTags && !input.vocabulary.length)) {
    return { suggestions: [], processedCount: 0 }
  }

  const suggestions: TagSuggestionRecord[] = []
  let processedCount = 0

  for (let offset = 0; offset < candidates.length; offset += input.batchSize) {
    const batch = candidates.slice(offset, offset + input.batchSize)
    const results = await input.provider.suggestTags({
      bookmarks: batch.map((bookmark) => ({
        tweetId: bookmark.tweetId,
        authorHandle: bookmark.authorHandle,
        text: bookmark.text
      })),
      vocabulary: input.vocabulary,
      allowNewTags: input.allowNewTags
    })

    processedCount += batch.length

    for (const result of results) {
      for (const tag of result.tags) {
        const suggestion = createTagSuggestion({
          bookmarkId: result.tweetId,
          tagName: tag.name,
          source: "llm",
          confidence: tag.confidence
        })

        if (suggestion) {
          suggestions.push(suggestion)
        }
      }
    }

    broadcastAutoTagProgress({ phase: "llm", processed: processedCount, total: candidates.length })
  }

  return { suggestions, processedCount }
}

// Orchestrates one auto-tag run: heuristics first, LLM later (P5) for the
// bookmarks the rules could not cover. Suggestion writes are idempotent via
// insertNewTagSuggestions, so re-running is always safe.
export async function runAutoTagPipeline(options?: {
  createLlmProvider?: (input: { apiKey: string; baseUrl: string; model: string }) => AutoTagLlmProvider
}): Promise<AutoTagRunResult> {
  const settings = await getSettings()

  if (!settings.autoTag.enabled) {
    return { ran: false, suggestedCount: 0, llmProcessedCount: 0, skippedCount: 0 }
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
    settings: settings.autoTag.heuristics
  })

  const { insertedCount } = await insertNewTagSuggestions(heuristicSuggestions)

  broadcastAutoTagProgress({ phase: "heuristics", processed: bookmarks.length, total: bookmarks.length })

  let llmInsertedCount = 0
  let llmProcessedCount = 0
  let llmSkippedCount = 0

  const llmSettings = settings.autoTag.llm
  if (llmSettings.enabled) {
    const { llmApiKey } = await getSecrets()

    if (llmApiKey) {
      const provider = options?.createLlmProvider
        ? options.createLlmProvider({ apiKey: llmApiKey, baseUrl: llmSettings.baseUrl, model: llmSettings.model })
        : createOpenAiCompatibleProvider({ settings: llmSettings, apiKey: llmApiKey })

      const taggedBookmarkIds = new Set(bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
      const pendingSuggestionBookmarkIds = new Set(
        [...suggestions, ...heuristicSuggestions]
          .filter((suggestion) => suggestion.status === "pending")
          .map((suggestion) => suggestion.bookmarkId)
      )

      const llmResult = await runLlmSuggestionStep({
        bookmarks,
        taggedBookmarkIds,
        pendingSuggestionBookmarkIds,
        vocabulary: tags.map((tag) => tag.name),
        allowNewTags: llmSettings.tagVocabularyMode === "open",
        batchSize: llmSettings.batchSize,
        maxBookmarksPerRun: llmSettings.maxBookmarksPerRun,
        provider
      })

      llmProcessedCount = llmResult.processedCount
      const inserted = await insertNewTagSuggestions(llmResult.suggestions)
      llmInsertedCount = inserted.insertedCount
      llmSkippedCount = llmResult.suggestions.length - inserted.insertedCount
    }
  }

  return {
    ran: true,
    suggestedCount: insertedCount + llmInsertedCount,
    llmProcessedCount,
    skippedCount: heuristicSuggestions.length - insertedCount + llmSkippedCount
  }
}
