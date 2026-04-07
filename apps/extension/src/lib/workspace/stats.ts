import type {
  AuthorStat,
  BookmarkListRecord,
  BookmarkRecord,
  BookmarkTagRecord,
  ListRecord,
  TagRecord,
  WorkspaceStats
} from "../types.ts"
import { INBOX_LIST_ID } from "../storage/listsStore.ts"

export function createEmptyWorkspaceStats(): WorkspaceStats {
  return {
    totalBookmarks: 0,
    inboxCount: 0,
    unclassifiedCount: 0,
    listCounts: [],
    tagCounts: [],
    topAuthors: []
  }
}

function compareWithInboxFirst(left: { id: string; name: string }, right: { id: string; name: string }) {
  if (left.id === INBOX_LIST_ID) {
    return -1
  }

  if (right.id === INBOX_LIST_ID) {
    return 1
  }

  return left.name.localeCompare(right.name)
}

export function buildWorkspaceStats({
  bookmarks,
  lists,
  bookmarkLists,
  tags,
  bookmarkTags,
  topAuthorLimit = 5
}: {
  bookmarks: BookmarkRecord[]
  lists: ListRecord[]
  bookmarkLists: BookmarkListRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  topAuthorLimit?: number
}): WorkspaceStats {
  const listCountById = new Map<string, number>()
  const tagCountById = new Map<string, number>()
  const bookmarkIdsWithTags = new Set<string>()
  const authorCountByHandle = new Map<string, AuthorStat>()

  for (const bookmarkList of bookmarkLists) {
    listCountById.set(bookmarkList.listId, (listCountById.get(bookmarkList.listId) ?? 0) + 1)
  }

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

  const listCounts = [...lists]
    .sort(compareWithInboxFirst)
    .map((list) => ({
      listId: list.id,
      name: list.name,
      count: listCountById.get(list.id) ?? 0
    }))

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
    inboxCount: listCountById.get(INBOX_LIST_ID) ?? 0,
    unclassifiedCount: bookmarks.filter((bookmark) => !bookmarkIdsWithTags.has(bookmark.tweetId)).length,
    listCounts,
    tagCounts,
    topAuthors
  }
}
