import type { BookmarkListRecord, BookmarkRecord, BookmarkTagRecord } from "../types.ts"
import { getAllBookmarks } from "../storage/bookmarksStore.ts"

export type BookmarkSortOrder = "timeline" | "saved-desc" | "saved-asc" | "created-desc" | "likes-desc"
export type MultiValueMatchMode = "any" | "all"
export type SavedTimeRange = "all" | "7d" | "30d" | "90d"

export interface BookmarkFilterOptions {
  query: string
  bookmarkLists: BookmarkListRecord[]
  selectedListId?: string
  bookmarkTags: BookmarkTagRecord[]
  selectedAuthorHandles: string[]
  authorMatchMode: MultiValueMatchMode
  selectedTagIds: string[]
  tagMatchMode: MultiValueMatchMode
  timeRange: SavedTimeRange
  onlyWithMedia: boolean
  onlyLongform: boolean
  sortOrder: BookmarkSortOrder
  currentTime?: number
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function toTimestamp(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function filterBookmarks(bookmarks: BookmarkRecord[], query: string) {
  const normalizedQuery = normalizeValue(query)

  if (!normalizedQuery) {
    return bookmarks
  }

  return bookmarks.filter((bookmark) => {
    return [bookmark.text, bookmark.authorName, bookmark.authorHandle, bookmark.tweetUrl]
      .filter(Boolean)
      .some((value) => normalizeValue(String(value)).includes(normalizedQuery))
  })
}

export function bookmarkHasMedia(bookmark: BookmarkRecord) {
  return Array.isArray(bookmark.media) && bookmark.media.length > 0
}

export function bookmarkIsLongform(bookmark: BookmarkRecord) {
  return bookmark.text.trim().length > 280
}

function matchesMultiValueFilter(values: Set<string>, selectedValues: string[], matchMode: MultiValueMatchMode) {
  if (!selectedValues.length) {
    return true
  }

  if (matchMode === "any") {
    return selectedValues.some((selectedValue) => values.has(selectedValue))
  }

  return selectedValues.every((selectedValue) => values.has(selectedValue))
}

export function filterBookmarksByList(
  bookmarks: BookmarkRecord[],
  bookmarkLists: BookmarkListRecord[],
  selectedListId?: string
) {
  if (!selectedListId) {
    return bookmarks
  }

  const listIdByBookmarkId = new Map(bookmarkLists.map((bookmarkList) => [bookmarkList.bookmarkId, bookmarkList.listId]))
  return bookmarks.filter((bookmark) => listIdByBookmarkId.get(bookmark.tweetId) === selectedListId)
}

export function filterBookmarksByAuthors(
  bookmarks: BookmarkRecord[],
  selectedAuthorHandles: string[],
  matchMode: MultiValueMatchMode = "any"
) {
  const normalizedHandles = selectedAuthorHandles.map(normalizeValue).filter(Boolean)

  if (!normalizedHandles.length) {
    return bookmarks
  }

  return bookmarks.filter((bookmark) => {
    const authorValues = new Set([normalizeValue(bookmark.authorHandle), normalizeValue(bookmark.authorName)].filter(Boolean))
    return matchesMultiValueFilter(authorValues, normalizedHandles, matchMode)
  })
}

export function filterBookmarksByTags(
  bookmarks: BookmarkRecord[],
  bookmarkTags: BookmarkTagRecord[],
  selectedTagIds: string[],
  matchMode: MultiValueMatchMode = "all"
) {
  if (!selectedTagIds.length) {
    return bookmarks
  }

  const tagIdsByBookmarkId = new Map<string, Set<string>>()

  for (const bookmarkTag of bookmarkTags) {
    const tagIds = tagIdsByBookmarkId.get(bookmarkTag.bookmarkId) ?? new Set<string>()
    tagIds.add(bookmarkTag.tagId)
    tagIdsByBookmarkId.set(bookmarkTag.bookmarkId, tagIds)
  }

  return bookmarks.filter((bookmark) => {
    const tagIds = tagIdsByBookmarkId.get(bookmark.tweetId) ?? new Set<string>()
    return matchesMultiValueFilter(tagIds, selectedTagIds, matchMode)
  })
}

export function filterBookmarksBySavedTime(
  bookmarks: BookmarkRecord[],
  timeRange: SavedTimeRange,
  currentTime = Date.now()
) {
  if (timeRange === "all") {
    return bookmarks
  }

  const rangeInDays = Number.parseInt(timeRange.replace("d", ""), 10)
  const threshold = currentTime - rangeInDays * 24 * 60 * 60 * 1000

  return bookmarks.filter((bookmark) => toTimestamp(bookmark.savedAt) >= threshold)
}

export function filterBookmarksByFlags(
  bookmarks: BookmarkRecord[],
  {
    onlyWithMedia,
    onlyLongform
  }: {
    onlyWithMedia: boolean
    onlyLongform: boolean
  }
) {
  return bookmarks.filter((bookmark) => {
    if (onlyWithMedia && !bookmarkHasMedia(bookmark)) {
      return false
    }

    if (onlyLongform && !bookmarkIsLongform(bookmark)) {
      return false
    }

    return true
  })
}

export function sortBookmarks(bookmarks: BookmarkRecord[], sortOrder: BookmarkSortOrder) {
  const sorted = [...bookmarks]

  sorted.sort((left, right) => {
    switch (sortOrder) {
      case "timeline": {
        const leftRank = left.bookmarkTimelineRank
        const rightRank = right.bookmarkTimelineRank

        if (leftRank !== undefined && rightRank !== undefined) {
          return leftRank - rightRank
        }

        if (leftRank !== undefined) {
          return -1
        }

        if (rightRank !== undefined) {
          return 1
        }

        return toTimestamp(right.savedAt) - toTimestamp(left.savedAt)
      }
      case "saved-asc":
        return toTimestamp(left.savedAt) - toTimestamp(right.savedAt)
      case "created-desc":
        return toTimestamp(right.createdAtOnX) - toTimestamp(left.createdAtOnX)
      case "likes-desc":
        return (right.metrics?.likes ?? 0) - (left.metrics?.likes ?? 0)
      default:
        return toTimestamp(right.savedAt) - toTimestamp(left.savedAt)
    }
  })

  return sorted
}

export function applyBookmarkFilters(bookmarks: BookmarkRecord[], options: BookmarkFilterOptions) {
  return sortBookmarks(
    filterBookmarksByFlags(
      filterBookmarksBySavedTime(
        filterBookmarksByTags(
          filterBookmarksByAuthors(
            filterBookmarksByList(
              filterBookmarks(bookmarks, options.query),
              options.bookmarkLists,
              options.selectedListId
            ),
            options.selectedAuthorHandles,
            options.authorMatchMode
          ),
          options.bookmarkTags,
          options.selectedTagIds,
          options.tagMatchMode
        ),
        options.timeRange,
        options.currentTime
      ),
      {
        onlyWithMedia: options.onlyWithMedia,
        onlyLongform: options.onlyLongform
      }
    ),
    options.sortOrder
  )
}

export async function searchBookmarks(query: string) {
  const bookmarks = await getAllBookmarks()
  return filterBookmarks(bookmarks, query)
}
