import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { DB_NAME, getBookmarksDb, resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"

test("upsertBookmarks stores bookmarks and getAllBookmarks returns them", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "123",
      tweetUrl: "https://x.com/alice/status/123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: { id: "123" }
    }
  ])

  const bookmarks = await getAllBookmarks()

  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].tweetId, "123")
  assert.equal(bookmarks[0].authorHandle, "alice")
})

test("upsertBookmarks updates an existing bookmark with the same tweetId", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "123",
      tweetUrl: "https://x.com/alice/status/123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: { id: "123" }
    }
  ])

  const result = await upsertBookmarks([
    {
      tweetId: "123",
      tweetUrl: "https://x.com/alice/status/123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "updated text",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      rawPayload: { id: "123", version: 2 }
    }
  ])

  const bookmarks = await getAllBookmarks()

  assert.equal(result.insertedCount, 0)
  assert.equal(result.updatedCount, 1)
  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].text, "updated text")
})

test("database migration removes the legacy knowledge-cards store", async () => {
  await resetBookmarksDb()

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("bookmarks")) {
        db.createObjectStore("bookmarks", { keyPath: "tweetId" })
      }
      if (!db.objectStoreNames.contains("knowledge-cards")) {
        db.createObjectStore("knowledge-cards", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("folders")) {
        db.createObjectStore("folders", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("bookmark-folders")) {
        db.createObjectStore("bookmark-folders", { keyPath: "bookmarkId" })
      }
      if (!db.objectStoreNames.contains("tags")) {
        db.createObjectStore("tags", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("bookmark-tags")) {
        const bookmarkTagsStore = db.createObjectStore("bookmark-tags", { keyPath: "id" })
        bookmarkTagsStore.createIndex("bookmarkId", "bookmarkId", { unique: false })
        bookmarkTagsStore.createIndex("tagId", "tagId", { unique: false })
      }
      if (!db.objectStoreNames.contains("sync-runs")) {
        db.createObjectStore("sync-runs", { keyPath: "id" })
      }
    }

    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
    request.onerror = () => reject(request.error ?? new Error("Failed to open legacy database"))
  })

  const db = await getBookmarksDb()

  assert.equal(db.objectStoreNames.contains("bookmarks"), true)
  assert.equal(db.objectStoreNames.contains("knowledge-cards"), false)
  assert.equal(db.objectStoreNames.contains("tags"), true)
  assert.equal(db.objectStoreNames.contains("bookmark-tags"), true)
  assert.equal(db.objectStoreNames.contains("sync-runs"), true)
})
