import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { DB_NAME, DB_VERSION, getBookmarksDb, requestToPromise, resetBookmarksDb, transactionDone } from "../../src/lib/storage/db.ts"
import { getAllBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { getRawPayload } from "../../src/lib/storage/rawPayloadsStore.ts"
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
    rawPayload: { legacy: { id: "tweet-1" } }
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

  assert.equal(db.version, DB_VERSION)
  assert.equal(db.objectStoreNames.contains("folders"), false)
  assert.equal(db.objectStoreNames.contains("bookmark-folders"), false)
  assert.equal(db.objectStoreNames.contains("bookmarks"), true)
  assert.equal(db.objectStoreNames.contains("tags"), true)
  assert.equal(db.objectStoreNames.contains("bookmark-tags"), true)
  assert.equal(db.objectStoreNames.contains("sync-runs"), true)
  assert.equal(db.objectStoreNames.contains("raw-payloads"), true)

  const bookmarks = await getAllBookmarks()
  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].tweetId, "tweet-1")
  assert.equal("rawPayload" in bookmarks[0], false)

  const migratedPayload = await getRawPayload("tweet-1")
  assert.deepEqual(migratedPayload, { legacy: { id: "tweet-1" } })

  const tags = await getAllTags()
  assert.equal(tags.length, 1)
  assert.equal(tags[0].name, "AI")

  const bookmarkTagsCount = await requestToPromise(
    db.transaction("bookmark-tags", "readonly").objectStore("bookmark-tags").count()
  )
  assert.equal(bookmarkTagsCount, 0)
})

test("upgrading to DB v7 backfills media posterUrl from legacy rawPayload", async () => {
  await resetBookmarksDb()

  const legacyDb = await openLegacyV5Db()
  const seedTransaction = legacyDb.transaction(["bookmarks"], "readwrite")
  seedTransaction.objectStore("bookmarks").put({
    tweetId: "tweet-video",
    tweetUrl: "https://x.com/alice/status/tweet-video",
    authorName: "Alice",
    authorHandle: "alice",
    text: "legacy video",
    createdAtOnX: "2026-03-15T00:00:00.000Z",
    savedAt: "2026-03-15T01:00:00.000Z",
    media: [{ type: "video", url: "https://example.com/video.mp4" }],
    rawPayload: {
      legacy: {
        extended_entities: {
          media: [{ type: "video", media_url_https: "https://example.com/poster.jpg" }]
        }
      }
    }
  })
  await transactionDone(seedTransaction)
  legacyDb.close()

  await getBookmarksDb()

  const bookmarks = await getAllBookmarks()
  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].media?.[0]?.posterUrl, "https://example.com/poster.jpg")
})

test("upgrading to DB v8 creates the tag-suggestions store with indexes", async () => {
  await resetBookmarksDb()

  const legacyDb = await openLegacyV5Db()
  legacyDb.close()

  const db = await getBookmarksDb()

  assert.equal(db.version, DB_VERSION)
  assert.equal(db.objectStoreNames.contains("tag-suggestions"), true)

  const store = db.transaction("tag-suggestions", "readonly").objectStore("tag-suggestions")
  assert.equal(store.keyPath, "id")
  assert.equal(store.indexNames.contains("bookmarkId"), true)
  assert.equal(store.indexNames.contains("status"), true)
})
