import { getTagSuggestion, resolveTagSuggestion } from "../storage/suggestionsStore.ts"
import { attachTagToBookmark, createTag, getAllTags } from "../storage/tagsStore.ts"
import { findTagByName } from "../tags/canonical.ts"
import type { TagRecord, TagSuggestionRecord } from "../types.ts"

async function ensureTagByName(tagName: string, knownTags?: TagRecord[]): Promise<TagRecord> {
  const tags = knownTags ?? (await getAllTags())
  const existing = findTagByName(tags, tagName)

  if (existing) {
    return existing
  }

  return createTag({ name: tagName })
}

// Accepting a suggestion is the only path where auto-tagging mutates real
// tags: resolve the canonical name (including merge aliases), create the tag
// only when nothing matches, attach it, and mark the suggestion accepted.
//
// Order matters. Marking the suggestion accepted first meant a failure in
// createTag/attachTagToBookmark left a row that was already resolved: the tag
// was never attached, and because every suggestion id acts as a negative cache
// for the rule engine, that bookmark+tag pair could never be suggested again.
// Resolving last keeps the suggestion pending when the work did not happen, so
// a retry is possible.
export async function acceptTagSuggestion(suggestionId: string): Promise<TagSuggestionRecord | null> {
  const suggestion = await getTagSuggestion(suggestionId)

  if (!suggestion || suggestion.status !== "pending") {
    return null
  }

  const tag = await ensureTagByName(suggestion.tagName)
  await attachTagToBookmark({ bookmarkId: suggestion.bookmarkId, tagId: tag.id })
  return resolveTagSuggestion(suggestionId, "accepted")
}

export async function rejectTagSuggestion(suggestionId: string): Promise<TagSuggestionRecord | null> {
  return resolveTagSuggestion(suggestionId, "rejected")
}

export async function acceptTagSuggestionsBulk(suggestionIds: string[]) {
  let acceptedCount = 0
  let tags = await getAllTags()

  for (const suggestionId of suggestionIds) {
    const suggestion = await getTagSuggestion(suggestionId)
    if (!suggestion || suggestion.status !== "pending") {
      continue
    }

    const tag = await ensureTagByName(suggestion.tagName, tags)
    if (!tags.some((known) => known.id === tag.id)) {
      tags = [...tags, tag]
    }

    await attachTagToBookmark({ bookmarkId: suggestion.bookmarkId, tagId: tag.id })
    await resolveTagSuggestion(suggestionId, "accepted")
    acceptedCount += 1
  }

  return { acceptedCount }
}
