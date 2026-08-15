// Pure helpers for the tag management mode. Kept free of React so the search,
// filter and sort behaviour can be unit tested directly.
import { canonicalTagKey } from "../lib/tags/canonical.ts"
import type { BookmarkTagRecord, TagRecord, TagSuggestionRecord } from "../lib/types.ts"

export interface TagLibraryItem {
  tagId: string
  name: string
  aliases: string[]
  bookmarkCount: number
  pendingSuggestionCount: number
  updatedAt: string
}

export type TagLibraryFilter = "all" | "orphan" | "pending"

export type TagLibrarySortOrder = "count-desc" | "count-asc" | "name-asc" | "recent"

export const TAG_LIBRARY_SORT_ORDERS: TagLibrarySortOrder[] = [
  "count-desc",
  "count-asc",
  "name-asc",
  "recent"
]

export function buildTagLibraryItems({
  tags,
  bookmarkTags,
  tagSuggestions
}: {
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  tagSuggestions: TagSuggestionRecord[]
}): TagLibraryItem[] {
  const bookmarkCountByTagId = new Map<string, number>()
  for (const bookmarkTag of bookmarkTags) {
    bookmarkCountByTagId.set(bookmarkTag.tagId, (bookmarkCountByTagId.get(bookmarkTag.tagId) ?? 0) + 1)
  }

  const pendingCountByKey = new Map<string, number>()
  for (const suggestion of tagSuggestions) {
    if (suggestion.status !== "pending") {
      continue
    }

    const key = canonicalTagKey(suggestion.tagName)
    if (!key) {
      continue
    }

    pendingCountByKey.set(key, (pendingCountByKey.get(key) ?? 0) + 1)
  }

  return tags.map((tag) => ({
    tagId: tag.id,
    name: tag.name,
    aliases: tag.aliases ?? [],
    bookmarkCount: bookmarkCountByTagId.get(tag.id) ?? 0,
    pendingSuggestionCount: pendingCountByKey.get(canonicalTagKey(tag.name)) ?? 0,
    updatedAt: tag.updatedAt ?? tag.createdAt
  }))
}

export function countOrphanTags(items: TagLibraryItem[]) {
  return items.reduce((total, item) => (item.bookmarkCount === 0 ? total + 1 : total), 0)
}

function matchesTagQuery(item: TagLibraryItem, searchQuery: string) {
  const trimmed = searchQuery.trim()
  if (!trimmed) {
    return true
  }

  const queryKey = canonicalTagKey(trimmed)
  const lowered = trimmed.toLowerCase()
  const haystack = [item.name, ...item.aliases]

  return haystack.some((value) => {
    if (value.toLowerCase().includes(lowered)) {
      return true
    }

    return Boolean(queryKey) && canonicalTagKey(value).includes(queryKey)
  })
}

function compareTagItems(left: TagLibraryItem, right: TagLibraryItem, sortOrder: TagLibrarySortOrder) {
  if (sortOrder === "name-asc") {
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" })
  }

  if (sortOrder === "recent") {
    return right.updatedAt.localeCompare(left.updatedAt)
  }

  const delta = sortOrder === "count-asc"
    ? left.bookmarkCount - right.bookmarkCount
    : right.bookmarkCount - left.bookmarkCount

  if (delta !== 0) {
    return delta
  }

  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" })
}

export function getVisibleTagLibraryItems({
  items,
  searchQuery,
  filter,
  sortOrder
}: {
  items: TagLibraryItem[]
  searchQuery: string
  filter: TagLibraryFilter
  sortOrder: TagLibrarySortOrder
}): TagLibraryItem[] {
  const filtered = items.filter((item) => {
    if (filter === "orphan" && item.bookmarkCount > 0) {
      return false
    }

    if (filter === "pending" && item.pendingSuggestionCount === 0) {
      return false
    }

    return matchesTagQuery(item, searchQuery)
  })

  return [...filtered].sort((left, right) => compareTagItems(left, right, sortOrder))
}

// Sidebar reuses the same matcher so typing in either search box behaves the same.
export function filterSidebarTags(tags: TagRecord[], searchQuery: string): TagRecord[] {
  const trimmed = searchQuery.trim()
  if (!trimmed) {
    return tags
  }

  return tags.filter((tag) =>
    matchesTagQuery(
      {
        tagId: tag.id,
        name: tag.name,
        aliases: tag.aliases ?? [],
        bookmarkCount: 0,
        pendingSuggestionCount: 0,
        updatedAt: tag.createdAt
      },
      trimmed
    )
  )
}
