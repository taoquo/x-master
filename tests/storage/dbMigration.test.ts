import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { DB_NAME, getBookmarksDb, requestToPromise, resetBookmarksDb, transactionDone } from "../../src/lib/storage/db.ts"
import { getAllBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { getAllTags } from "../../src/lib/storage/tagsStore.ts"

function openLegacyV5Db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 5)

    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore("bookmarks", { keyPath: "tweetId" })
      db.createObjectStore("tags", { keyPath: "id" })
      const bookmarkTagsStore = db.createObjectStore("bookmark-tags", { keyPath: "id" })
      bookmarkTagsStore.createIndex("bookmarkId", "bookmarkId", { unique: false })
      bookmarkTagsStore.createIndex("tagId", "tagId", { unique: false })
      db.createObjectStore("sync-runs", { keyPath: "id" })
      db.createObjectStore("folders", { keyPath: "id" })
      const bookmarkListsStore = db.createObjectStore("bookmark-folders", { keyPath: "bookmarkId" })
      bookmarkListsStore.createIndex("listId", "listId", { unique: false })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open legacy v5 database"))
  })
}

test("upgrading from DB v5 removes legacy list stores and keeps bookmarks and tags", async () => {
  await resetBookmarksDb()

  const legacyDb = await openLegacyV5Db()
  const seedTransaction = legacyDb.transaction(["bookmarks", "tags", "folders", "bookmark-folders"], "readwrite")
  seedTransaction.objectStore("bookmarks").put({
    tweetId: "tweet-1",
    tweetUrl: "https://x.com/alice/status/tweet-1",
    authorName: "Alice",
    authorHandle: "alice",
    text: "hello migration",
    createdAtOnX: "2026-03-15T00:00:00.000Z",
    savedAt: "2026-03-15T01:00:00.000Z",
    rawPayload: {}
  })
  seedTransaction.objectStore("tags").put({ id: "tag-ai", name: "AI", createdAt: "2026-03-15T00:00:00.000Z" })
  seedTransaction.objectStore("folders").put({ id: "list-inbox", name: "Inbox", createdAt: "2026-03-15T00:00:00.000Z" })
  seedTransaction.objectStore("bookmark-folders").put({
    bookmarkId: "tweet-1",
    listId: "list-inbox",
    updatedAt: "2026-03-15T01:00:00.000Z"
  })
  await transactionDone(seedTransaction)
  legacyDb.close()

  const db = await getBookmarksDb()

  assert.equal(db.version, 6)
  assert.equal(db.objectStoreNames.contains("folders"), false)
  assert.equal(db.objectStoreNames.contains("bookmark-folders"), false)
  assert.equal(db.objectStoreNames.contains("bookmarks"), true)
  assert.equal(db.objectStoreNames.contains("tags"), true)
  assert.equal(db.objectStoreNames.contains("bookmark-tags"), true)
  assert.equal(db.objectStoreNames.contains("sync-runs"), true)

  const bookmarks = await getAllBookmarks()
  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].tweetId, "tweet-1")

  const tags = await getAllTags()
  assert.equal(tags.length, 1)
  assert.equal(tags[0].name, "AI")

  const bookmarkTagsCount = await requestToPromise(
    db.transaction("bookmark-tags", "readonly").objectStore("bookmark-tags").count()
  )
  assert.equal(bookmarkTagsCount, 0)
})
