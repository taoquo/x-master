import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getBookmarksDb, resetBookmarksDb } from "../../src/lib/storage/db.ts"
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

test("getBookmarksDb requires IndexedDB and opens required object stores", async () => {
  assert.equal(typeof indexedDB, "object")

  await resetBookmarksDb()

  const db = await getBookmarksDb()

  assert.equal(typeof db.transaction, "function")
  assert.equal(db.objectStoreNames.contains("bookmarks"), true)
  assert.equal(db.objectStoreNames.contains("tags"), true)
  assert.equal(db.objectStoreNames.contains("bookmark-tags"), true)
  assert.equal(db.objectStoreNames.contains("sync-runs"), true)
})
