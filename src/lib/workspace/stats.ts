import type {
  AuthorStat,
  BookmarkRecord,
  BookmarkTagRecord,
  TagRecord,
  WorkspaceStats
} from "../types.ts"

export function createEmptyWorkspaceStats(): WorkspaceStats {
  return {
    totalBookmarks: 0,
    unclassifiedCount: 0,
    tagCounts: [],
    topAuthors: []
  }
}

export function buildWorkspaceStats({
  bookmarks,
  tags,
  bookmarkTags,
  topAuthorLimit = 5
}: {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  topAuthorLimit?: number
}): WorkspaceStats {
  const tagCountById = new Map<string, number>()
  const bookmarkIdsWithTags = new Set<string>()
  const authorCountByHandle = new Map<string, AuthorStat>()

  for (const bookmarkTag of bookmarkTags) {
    tagCountById.set(bookmarkTag.tagId, (tagCountById.get(bookmarkTag.tagId) ?? 0) + 1)
    bookmarkIdsWithTags.add(bookmarkTag.bookmarkId)
  }

  for (const bookmark of bookmarks) {
    const existing = authorCountByHandle.get(bookmark.authorHandle)
    if (existing) {
      existing.count += 1
      continue
    }

    authorCountByHandle.set(bookmark.authorHandle, {
      authorHandle: bookmark.authorHandle,
      authorName: bookmark.authorName,
      count: 1
    })
  }

  const tagNamesById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const tagCounts = [...tagCountById.entries()]
    .map(([tagId, count]) => ({
      tagId,
      name: tagNamesById.get(tagId) ?? "Unknown tag",
      count
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))

  const topAuthors = [...authorCountByHandle.values()]
    .sort((left, right) => right.count - left.count || left.authorHandle.localeCompare(right.authorHandle))
    .slice(0, topAuthorLimit)

  return {
    totalBookmarks: bookmarks.length,
    unclassifiedCount: bookmarks.filter((bookmark) => !bookmarkIdsWithTags.has(bookmark.tweetId)).length,
    tagCounts,
    topAuthors
  }
}
