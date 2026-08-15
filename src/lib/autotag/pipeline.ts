import { computeHeuristicSuggestions } from "./heuristics.ts"
import { broadcastAutoTagProgress } from "../runtime/autotagProgress.ts"
import { backfillHashtagsFromRawPayloads } from "../storage/backfillHashtags.ts"
import { getAllBookmarks } from "../storage/bookmarksStore.ts"
import { getSettings } from "../storage/settings.ts"
import { getAllTagSuggestions, insertNewTagSuggestions } from "../storage/suggestionsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../storage/tagsStore.ts"

export interface AutoTagRunResult {
  ran: boolean
  suggestedCount: number
  llmProcessedCount: number
  skippedCount: number
}

// Orchestrates one auto-tag run: heuristics first, LLM later (P5) for the
// bookmarks the rules could not cover. Suggestion writes are idempotent via
// insertNewTagSuggestions, so re-running is always safe.
export async function runAutoTagPipeline(): Promise<AutoTagRunResult> {
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

  return {
    ran: true,
    suggestedCount: insertedCount,
    llmProcessedCount: 0,
    skippedCount: heuristicSuggestions.length - insertedCount
  }
}
