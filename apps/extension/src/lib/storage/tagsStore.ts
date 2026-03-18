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
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const tag = {
    id: `tag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    createdAt: new Date().toISOString()
  }

  store.put(tag)
  await transactionDone(transaction)
  return tag
}

export async function getAllTags(): Promise<TagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readonly")
  const store = transaction.objectStore(TAGS_STORE)
  const tags = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return tags as TagRecord[]
}

export async function getAllBookmarkTags(): Promise<BookmarkTagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const bookmarkTags = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return bookmarkTags as BookmarkTagRecord[]
}

export async function attachTagToBookmark({
  bookmarkId,
  tagId
}: {
  bookmarkId: string
  tagId: string
}): Promise<BookmarkTagRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const id = createBookmarkTagId(bookmarkId, tagId)
  const existing = await requestToPromise(store.get(id))

  const bookmarkTag = existing ?? {
    id,
    bookmarkId,
    tagId,
    createdAt: new Date().toISOString()
  }

  store.put(bookmarkTag)
  await transactionDone(transaction)
  return bookmarkTag as BookmarkTagRecord
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

  return tags.filter(Boolean) as TagRecord[]
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
