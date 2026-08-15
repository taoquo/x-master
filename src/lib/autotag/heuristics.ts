import type {
  AutoTagSettings,
  BookmarkRecord,
  BookmarkTagRecord,
  TagRecord,
  TagSuggestionRecord
} from "../types.ts"
import { createTagSuggestion } from "../storage/suggestionsStore.ts"

const HASHTAG_CONFIDENCE = 0.9
const KEYWORD_CONFIDENCE = 0.7
const AUTHOR_CONFIDENCE = 0.6
const AUTHOR_MIN_TAGGED_BOOKMARKS = 3
const AUTHOR_MIN_TAG_SHARE = 0.6

export interface AuthorTagAffinity {
  authorHandle: string
  tagName: string
  taggedBookmarkCount: number
  tagOccurrenceCount: number
  share: number
}

// Shared statistic: how strongly each author's bookmarks lean toward a tag.
// Reused by the author heuristic here and, later, by the tag/author graph.
export function computeAuthorTagAffinity(input: {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
}): AuthorTagAffinity[] {
  const tagNameById = new Map(input.tags.map((tag) => [tag.id, tag.name]))
  const authorByBookmarkId = new Map(input.bookmarks.map((bookmark) => [bookmark.tweetId, bookmark.authorHandle]))

  const tagIdsByBookmarkId = new Map<string, Set<string>>()
  for (const bookmarkTag of input.bookmarkTags) {
    const tagIds = tagIdsByBookmarkId.get(bookmarkTag.bookmarkId) ?? new Set<string>()
    tagIds.add(bookmarkTag.tagId)
    tagIdsByBookmarkId.set(bookmarkTag.bookmarkId, tagIds)
  }

  const taggedBookmarkCountByAuthor = new Map<string, number>()
  const occurrenceByAuthorTag = new Map<string, { authorHandle: string; tagName: string; count: number }>()

  for (const [bookmarkId, tagIds] of tagIdsByBookmarkId) {
    const authorHandle = authorByBookmarkId.get(bookmarkId)
    if (!authorHandle) {
      continue
    }

    taggedBookmarkCountByAuthor.set(authorHandle, (taggedBookmarkCountByAuthor.get(authorHandle) ?? 0) + 1)

    for (const tagId of tagIds) {
      const tagName = tagNameById.get(tagId)
      if (!tagName) {
        continue
      }

      const key = `${authorHandle}\u0000${tagName.toLowerCase()}`
      const entry = occurrenceByAuthorTag.get(key) ?? { authorHandle, tagName, count: 0 }
      entry.count += 1
      occurrenceByAuthorTag.set(key, entry)
    }
  }

  const affinities: AuthorTagAffinity[] = []
  for (const entry of occurrenceByAuthorTag.values()) {
    const taggedBookmarkCount = taggedBookmarkCountByAuthor.get(entry.authorHandle) ?? 0
    affinities.push({
      authorHandle: entry.authorHandle,
      tagName: entry.tagName,
      taggedBookmarkCount,
      tagOccurrenceCount: entry.count,
      share: taggedBookmarkCount > 0 ? entry.count / taggedBookmarkCount : 0
    })
  }

  return affinities
}

// Pure rule engine: produces pending suggestions for bookmarks that have no
// tags yet. Existing suggestions (any status) act as a negative cache -- the
// same bookmark+tagName pair is never suggested twice.
export function computeHeuristicSuggestions(input: {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  suggestions: TagSuggestionRecord[]
  settings: AutoTagSettings["heuristics"]
}): TagSuggestionRecord[] {
  const taggedBookmarkIds = new Set(input.bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
  const knownSuggestionIds = new Set(input.suggestions.map((suggestion) => suggestion.id))
  const results: TagSuggestionRecord[] = []

  const addSuggestion = (
    bookmarkId: string,
    tagName: string,
    source: TagSuggestionRecord["source"],
    confidence: number
  ) => {
    const suggestion = createTagSuggestion({ bookmarkId, tagName, source, confidence })
    if (!suggestion || knownSuggestionIds.has(suggestion.id)) {
      return
    }

    knownSuggestionIds.add(suggestion.id)
    results.push(suggestion)
  }

  const affinitiesByAuthor = new Map<string, AuthorTagAffinity[]>()
  if (input.settings.useAuthors) {
    for (const affinity of computeAuthorTagAffinity(input)) {
      if (affinity.taggedBookmarkCount < AUTHOR_MIN_TAGGED_BOOKMARKS || affinity.share < AUTHOR_MIN_TAG_SHARE) {
        continue
      }

      const affinities = affinitiesByAuthor.get(affinity.authorHandle) ?? []
      affinities.push(affinity)
      affinitiesByAuthor.set(affinity.authorHandle, affinities)
    }
  }

  const keywordRules = input.settings.keywordRules
    .map((rule) => ({ keyword: rule.keyword.trim().toLowerCase(), tagName: rule.tagName }))
    .filter((rule) => rule.keyword.length > 0)

  for (const bookmark of input.bookmarks) {
    if (taggedBookmarkIds.has(bookmark.tweetId)) {
      continue
    }

    if (input.settings.useHashtags) {
      for (const hashtag of bookmark.hashtags ?? []) {
        addSuggestion(bookmark.tweetId, hashtag, "hashtag", HASHTAG_CONFIDENCE)
      }
    }

    if (input.settings.useAuthors) {
      for (const affinity of affinitiesByAuthor.get(bookmark.authorHandle) ?? []) {
        addSuggestion(bookmark.tweetId, affinity.tagName, "author", AUTHOR_CONFIDENCE)
      }
    }

    if (keywordRules.length) {
      const text = bookmark.text.toLowerCase()
      for (const rule of keywordRules) {
        if (text.includes(rule.keyword)) {
          addSuggestion(bookmark.tweetId, rule.tagName, "keyword", KEYWORD_CONFIDENCE)
        }
      }
    }
  }

  return results
}
