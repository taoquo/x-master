import type { BookmarkRecord, TagRecord } from "../../lib/types.ts"
import type { BookmarkSortOrder } from "../../lib/search/searchBookmarks.ts"

export function getSortLabel(sortOrder: BookmarkSortOrder) {
  switch (sortOrder) {
    case "saved-asc":
      return "oldest saved"
    case "created-desc":
      return "newest on X"
    case "likes-desc":
      return "most likes"
    case "saved-desc":
    default:
      return "newest saved"
  }
}

export function getAuthorOptions(bookmarks: BookmarkRecord[]) {
  const countsByHandle = new Map<string, { handle: string; label: string; count: number }>()

  for (const bookmark of bookmarks) {
    const handle = bookmark.authorHandle.trim()
    if (!handle) {
      continue
    }

    const current = countsByHandle.get(handle) ?? {
      handle,
      label: bookmark.authorName ? `${bookmark.authorName} (@${handle})` : `@${handle}`,
      count: 0
    }

    current.count += 1
    countsByHandle.set(handle, current)
  }

  return Array.from(countsByHandle.values()).sort((left, right) => left.label.localeCompare(right.label))
}

export function getBookmarkTagsForBookmark(
  bookmarkId: string | undefined,
  bookmarkTags: Array<{ bookmarkId: string; tagId: string }>,
  tagsById: Map<string, TagRecord>
) {
  if (!bookmarkId) {
    return []
  }

  return bookmarkTags
    .filter((bookmarkTag) => bookmarkTag.bookmarkId === bookmarkId)
    .map((bookmarkTag) => tagsById.get(bookmarkTag.tagId))
    .filter(Boolean) as TagRecord[]
}
