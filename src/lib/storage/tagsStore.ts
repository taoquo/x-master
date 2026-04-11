import type { BookmarkRecord, BookmarkTagRecord, TagRecord } from "../types.ts"
import {
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  getBookmarksDb,
  requestToPromise,
  TAGS_STORE,
  transactionDone
} from "./db.ts"

function createBookmarkTagId(bookmarkId: string, tagId: string) {
  return `${bookmarkId}:${tagId}`
}

export async function createTag({ name }: { name: string }): Promise<TagRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("Tag name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const tag = {
    id: `tag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: trimmedName,
    createdAt: new Date().toISOString()
  }

  store.put(tag)
  await transactionDone(transaction)
  return tag
}

export async function renameTag({
  tagId,
  name
}: {
  tagId: string
  name: string
}): Promise<TagRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("Tag name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const existing = (await requestToPromise(store.get(tagId))) as TagRecord | undefined

  if (!existing) {
    throw new Error("Tag not found")
  }

  const updatedTag: TagRecord = {
    ...existing,
    name: trimmedName
  }

  store.put(updatedTag)
  await transactionDone(transaction)
  return updatedTag
}

export async function getAllTags(): Promise<TagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readonly")
  const store = transaction.objectStore(TAGS_STORE)
  const tags = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return (tags as TagRecord[]).sort((left, right) => left.name.localeCompare(right.name))
}

export async function getAllBookmarkTags(): Promise<BookmarkTagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const bookmarkTags = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return bookmarkTags as BookmarkTagRecord[]
}

export async function attachBookmarkTags(relations: Array<{ bookmarkId: string; tagId: string }>) {
  if (!relations.length) {
    return 0
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  let createdCount = 0

  for (const relation of relations) {
    const id = createBookmarkTagId(relation.bookmarkId, relation.tagId)
    const existing = await requestToPromise(store.get(id))
    if (existing) {
      continue
    }

    store.put({
      id,
      bookmarkId: relation.bookmarkId,
      tagId: relation.tagId,
      createdAt: new Date().toISOString()
    } satisfies BookmarkTagRecord)
    createdCount += 1
  }

  await transactionDone(transaction)
  return createdCount
}

export async function attachTagToBookmark({
  bookmarkId,
  tagId
}: {
  bookmarkId: string
  tagId: string
}): Promise<BookmarkTagRecord> {
  await attachBookmarkTags([{ bookmarkId, tagId }])
  return {
    id: createBookmarkTagId(bookmarkId, tagId),
    bookmarkId,
    tagId,
    createdAt: new Date().toISOString()
  }
}

export async function attachTagToBookmarks({
  bookmarkIds,
  tagId
}: {
  bookmarkIds: string[]
  tagId: string
}) {
  await attachBookmarkTags(bookmarkIds.map((bookmarkId) => ({ bookmarkId, tagId })))
}

export async function detachTagFromBookmark({
  bookmarkId,
  tagId
}: {
  bookmarkId: string
  tagId: string
}) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  store.delete(createBookmarkTagId(bookmarkId, tagId))
  await transactionDone(transaction)
}

export async function deleteTag(tagId: string) {
  const db = await getBookmarksDb()
  const transaction = db.transaction([TAGS_STORE, BOOKMARK_TAGS_STORE], "readwrite")
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const relatedBookmarkTags = (await requestToPromise(bookmarkTagsStore.index("tagId").getAll(tagId))) as BookmarkTagRecord[]

  for (const bookmarkTag of relatedBookmarkTags) {
    bookmarkTagsStore.delete(bookmarkTag.id)
  }

  tagsStore.delete(tagId)
  await transactionDone(transaction)
}

export async function listTagsForBookmark(bookmarkId: string): Promise<TagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARK_TAGS_STORE, TAGS_STORE], "readonly")
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTags = (await requestToPromise(
    bookmarkTagsStore.index("bookmarkId").getAll(bookmarkId)
  )) as BookmarkTagRecord[]

  const tags = await Promise.all(bookmarkTags.map((bookmarkTag) => requestToPromise(tagsStore.get(bookmarkTag.tagId))))
  await transactionDone(transaction)

  return (tags.filter(Boolean) as TagRecord[]).sort((left, right) => left.name.localeCompare(right.name))
}

export async function listBookmarksByTag(tagId: string): Promise<BookmarkRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARK_TAGS_STORE, BOOKMARKS_STORE], "readonly")
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarkTags = (await requestToPromise(bookmarkTagsStore.index("tagId").getAll(tagId))) as BookmarkTagRecord[]

  const bookmarks = await Promise.all(
    bookmarkTags.map((bookmarkTag) => requestToPromise(bookmarksStore.get(bookmarkTag.bookmarkId)))
  )

  await transactionDone(transaction)
  return bookmarks.filter(Boolean) as BookmarkRecord[]
}
