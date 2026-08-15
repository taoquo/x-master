import { resolveTagSuggestion } from "../storage/suggestionsStore.ts"
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
export async function acceptTagSuggestion(suggestionId: string): Promise<TagSuggestionRecord | null> {
  const suggestion = await resolveTagSuggestion(suggestionId, "accepted")

  if (!suggestion) {
    return null
  }

  const tag = await ensureTagByName(suggestion.tagName)
  await attachTagToBookmark({ bookmarkId: suggestion.bookmarkId, tagId: tag.id })
  return suggestion
}

export async function rejectTagSuggestion(suggestionId: string): Promise<TagSuggestionRecord | null> {
  return resolveTagSuggestion(suggestionId, "rejected")
}

export async function acceptTagSuggestionsBulk(suggestionIds: string[]) {
  let acceptedCount = 0
  let tags = await getAllTags()

  for (const suggestionId of suggestionIds) {
    const suggestion = await resolveTagSuggestion(suggestionId, "accepted")
    if (!suggestion) {
      continue
    }

    const tag = await ensureTagByName(suggestion.tagName, tags)
    if (!tags.some((known) => known.id === tag.id)) {
      tags = [...tags, tag]
    }

    await attachTagToBookmark({ bookmarkId: suggestion.bookmarkId, tagId: tag.id })
    acceptedCount += 1
  }

  return { acceptedCount }
}
