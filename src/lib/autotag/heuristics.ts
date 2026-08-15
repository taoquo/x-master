import type {
  AutoTagSettings,
  BookmarkRecord,
  BookmarkTagRecord,
  TagRecord,
  TagSuggestionRecord
} from "../types.ts"
import { createTagSuggestion } from "../storage/suggestionsStore.ts"
import { canonicalTagKey } from "../tags/canonical.ts"

const HASHTAG_CONFIDENCE = 0.9
const KEYWORD_CONFIDENCE = 0.7
const AUTHOR_CONFIDENCE = 0.6
const AUTHOR_MIN_TAGGED_BOOKMARKS = 3
const AUTHOR_MIN_TAG_SHARE = 0.6
// A hashtag only becomes a tag candidate once it shows up in at least this many
// bookmarks. Single-use hashtags are the main source of long-tail tag noise.
export const HASHTAG_MIN_BOOKMARKS = 3

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
  // Canonical keys the user deleted on purpose; never suggested again.
  blockedTagKeys?: string[]
}): TagSuggestionRecord[] {
  const taggedBookmarkIds = new Set(input.bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
  const knownSuggestionIds = new Set(input.suggestions.map((suggestion) => suggestion.id))
  const blockedKeys = new Set(input.blockedTagKeys ?? [])
  const results: TagSuggestionRecord[] = []

  const addSuggestion = (
    bookmarkId: string,
    tagName: string,
    source: TagSuggestionRecord["source"],
    confidence: number
  ) => {
    if (blockedKeys.has(canonicalTagKey(tagName))) {
      return
    }

    const suggestion = createTagSuggestion({ bookmarkId, tagName, source, confidence })
    if (!suggestion || knownSuggestionIds.has(suggestion.id)) {
      return
    }

    knownSuggestionIds.add(suggestion.id)
    results.push(suggestion)
  }

  // Hashtag frequency across the whole library (existing tags included, so a
  // hashtag matching an established tag always passes the threshold).
  const hashtagBookmarkCounts = new Map<string, number>()
  if (input.settings.useHashtags) {
    for (const tag of input.tags) {
      const key = canonicalTagKey(tag.name)
      if (key) {
        hashtagBookmarkCounts.set(key, HASHTAG_MIN_BOOKMARKS)
      }
    }

    for (const bookmark of input.bookmarks) {
      const seen = new Set<string>()
      for (const hashtag of bookmark.hashtags ?? []) {
        const key = canonicalTagKey(hashtag)
        if (!key || seen.has(key)) {
          continue
        }

        seen.add(key)
        hashtagBookmarkCounts.set(key, (hashtagBookmarkCounts.get(key) ?? 0) + 1)
      }
    }
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
        const key = canonicalTagKey(hashtag)
        if ((hashtagBookmarkCounts.get(key) ?? 0) < HASHTAG_MIN_BOOKMARKS) {
          continue
        }

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
