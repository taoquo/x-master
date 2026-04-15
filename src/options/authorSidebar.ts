import type { BookmarkRecord } from "../lib/types.ts"

export interface AuthorSidebarItem {
  authorHandle: string
  authorName: string
  count: number
}

function compareAuthors(left: AuthorSidebarItem, right: AuthorSidebarItem) {
  return (
    right.count - left.count ||
    left.authorHandle.localeCompare(right.authorHandle, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  )
}

export function buildAuthorSidebarItems(bookmarks: BookmarkRecord[]) {
  const authorsByHandle = new Map<string, AuthorSidebarItem>()

  for (const bookmark of bookmarks) {
    const authorHandle = bookmark.authorHandle.trim()
    if (!authorHandle) {
      continue
    }

    const existing = authorsByHandle.get(authorHandle)
    if (existing) {
      existing.count += 1
      if (!existing.authorName && bookmark.authorName.trim()) {
        existing.authorName = bookmark.authorName.trim()
      }
      continue
    }

    authorsByHandle.set(authorHandle, {
      authorHandle,
      authorName: bookmark.authorName.trim(),
      count: 1
    })
  }

  return [...authorsByHandle.values()].sort(compareAuthors)
}

export function getVisibleAuthorSidebarItems({
  authorItems,
  searchQuery,
  expanded,
  defaultVisibleCount = 6
}: {
  authorItems: AuthorSidebarItem[]
  searchQuery: string
  expanded: boolean
  defaultVisibleCount?: number
}) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const matchingAuthorItems = authorItems.filter((author) => {
    if (!normalizedSearchQuery) {
      return true
    }

    return [author.authorName, author.authorHandle]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearchQuery))
  })

  return {
    items:
      normalizedSearchQuery || expanded ? matchingAuthorItems : matchingAuthorItems.slice(0, defaultVisibleCount),
    shouldShowToggle: !normalizedSearchQuery && matchingAuthorItems.length > defaultVisibleCount
  }
}

export function formatAuthorLabel(author: AuthorSidebarItem) {
  return `@${author.authorHandle}`
}
