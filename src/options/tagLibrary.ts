// Pure helpers for the tag management mode. Kept free of React so the search,
// filter and sort behaviour can be unit tested directly.
import { canonicalTagKey } from "../lib/tags/canonical.ts"
import type { BookmarkTagRecord, TagRecord, TagSuggestionRecord } from "../lib/types.ts"

export interface TagLibraryItem {
  tagId: string
  name: string
  aliases: string[]
  parentId?: string
  parentName?: string
  childCount: number
  bookmarkCount: number
  pendingSuggestionCount: number
  updatedAt: string
}

export type TagLibraryFilter = "all" | "orphan" | "pending" | "unparented"

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

  const nameById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const childCountById = new Map<string, number>()
  for (const tag of tags) {
    if (!tag.parentId || !nameById.has(tag.parentId)) {
      continue
    }

    childCountById.set(tag.parentId, (childCountById.get(tag.parentId) ?? 0) + 1)
  }

  return tags.map((tag) => {
    // A parentId pointing at a deleted tag is treated as no parent instead of
    // rendering a dangling label.
    const parentName = tag.parentId ? nameById.get(tag.parentId) : undefined
    const item: TagLibraryItem = {
      tagId: tag.id,
      name: tag.name,
      aliases: tag.aliases ?? [],
      childCount: childCountById.get(tag.id) ?? 0,
      bookmarkCount: bookmarkCountByTagId.get(tag.id) ?? 0,
      pendingSuggestionCount: pendingCountByKey.get(canonicalTagKey(tag.name)) ?? 0,
      updatedAt: tag.updatedAt ?? tag.createdAt
    }

    if (parentName !== undefined && tag.parentId) {
      item.parentId = tag.parentId
      item.parentName = parentName
    }

    return item
  })
}

export function countOrphanTags(items: TagLibraryItem[]) {
  return items.reduce((total, item) => (item.bookmarkCount === 0 ? total + 1 : total), 0)
}

// "Unparented" only counts tags that could reasonably sit under a theme: a tag
// that already has children is a theme itself.
export function countUnparentedTags(items: TagLibraryItem[]) {
  return items.reduce(
    (total, item) => (!item.parentId && !item.childCount ? total + 1 : total),
    0
  )
}

// Only root tags (no parent of their own) may become a parent, which is what
// keeps the taxonomy two levels deep on the UI side as well.
export function getParentCandidates(items: TagLibraryItem[], tagId: string): TagLibraryItem[] {
  const self = items.find((item) => item.tagId === tagId)
  if (!self || self.childCount) {
    return []
  }

  return items
    .filter((item) => item.tagId !== tagId && !item.parentId)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }))
}

function matchesTagQuery(item: TagLibraryItem, searchQuery: string) {
  const trimmed = searchQuery.trim()
  if (!trimmed) {
    return true
  }

  const queryKey = canonicalTagKey(trimmed)
  const lowered = trimmed.toLowerCase()
  const haystack = [item.name, ...item.aliases, ...(item.parentName ? [item.parentName] : [])]

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

    if (filter === "unparented" && (item.parentId || item.childCount)) {
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
        childCount: 0,
        bookmarkCount: 0,
        pendingSuggestionCount: 0,
        updatedAt: tag.createdAt
      },
      trimmed
    )
  )
}
