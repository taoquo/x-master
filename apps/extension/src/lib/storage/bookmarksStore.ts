import type { BookmarkRecord } from "../types.ts"
import { BOOKMARKS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"

type StoredBookmark = BookmarkRecord & { updatedAt?: string; id?: string }

export async function upsertBookmarks(bookmarks: BookmarkRecord[]) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  let insertedCount = 0
  let updatedCount = 0

  for (const bookmark of bookmarks) {
    const existing = await requestToPromise(store.get(bookmark.tweetId))

    store.put({
      ...existing,
      ...bookmark,
      id: bookmark.id ?? bookmark.tweetId,
      updatedAt: new Date().toISOString()
    })

    if (existing) {
      updatedCount += 1
    } else {
      insertedCount += 1
    }
  }

  await transactionDone(transaction)

  return { insertedCount, updatedCount }
}

export async function getAllBookmarks() {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarks = await requestToPromise(store.getAll())
  await transactionDone(transaction)

  return (bookmarks as StoredBookmark[]).sort((left, right) => {
    return String(right.savedAt ?? "").localeCompare(String(left.savedAt ?? ""))
  })
}
