import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { DB_NAME, getBookmarksDb, resetBookmarksDb } from "../../src/lib/storage/db.ts"
import {
  getAllBookmarks,
  removeBookmarkSnapshot,
  upsertBookmarks,
  upsertBookmarkSnapshot
} from "../../src/lib/storage/bookmarksStore.ts"
import { getAllBookmarkLists, assignBookmarksToInboxIfMissing } from "../../src/lib/storage/listsStore.ts"
import { attachTagToBookmark, createTag, getAllBookmarkTags } from "../../src/lib/storage/tagsStore.ts"

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

test("upsertBookmarks preserves the original savedAt for existing bookmarks", async () => {
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
      lastSeenAt: "2026-03-15T01:00:00.000Z",
      rawPayload: { id: "123" }
    }
  ])

  await upsertBookmarks([
    {
      tweetId: "123",
      tweetUrl: "https://x.com/alice/status/123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "updated text",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      lastSeenAt: "2026-03-15T02:00:00.000Z",
      rawPayload: { id: "123", version: 2 }
    }
  ])

  const bookmarks = await getAllBookmarks()

  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].savedAt, "2026-03-15T01:00:00.000Z")
  assert.equal(bookmarks[0].lastSeenAt, "2026-03-15T02:00:00.000Z")
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

test("upsertBookmarkSnapshot creates a minimal bookmark without overwriting richer fields", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-123",
      tweetUrl: "https://x.com/alice/status/123",
      authorName: "Alice Johnson",
      authorHandle: "alice",
      text: "Full synced text with richer details",
      createdAtOnX: "2026-04-01T00:00:00.000Z",
      savedAt: "2026-04-01T00:10:00.000Z",
      lastSeenAt: "2026-04-01T00:10:00.000Z",
      media: [{ type: "photo", url: "https://example.com/media.jpg", altText: "cover" }],
      metrics: { likes: 8, retweets: 2, replies: 1 },
      rawPayload: { source: "sync" }
    }
  ])

  const snapshot = await upsertBookmarkSnapshot({
    tweetId: "tweet-123",
    tweetUrl: "https://x.com/alice/status/123",
    authorName: "Alice",
    authorHandle: "alice",
    text: "Short DOM text",
    createdAtOnX: "2026-04-01T00:00:00.000Z"
  })

  const bookmarks = await getAllBookmarks()

  assert.equal(snapshot.tweetId, "tweet-123")
  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].text, "Full synced text with richer details")
  assert.equal(bookmarks[0].savedAt, "2026-04-01T00:10:00.000Z")
  assert.deepEqual(bookmarks[0].metrics, { likes: 8, retweets: 2, replies: 1 })
  assert.deepEqual(bookmarks[0].rawPayload, { source: "sync" })
  assert.match(String(bookmarks[0].lastSeenAt), /^\d{4}-\d{2}-\d{2}T/)
})

test("upsertBookmarkSnapshot can be assigned into inbox for site bookmark sync", async () => {
  await resetBookmarksDb()

  await upsertBookmarkSnapshot({
    tweetId: "tweet-123",
    tweetUrl: "https://x.com/alice/status/123",
    authorName: "Alice",
    authorHandle: "alice",
    text: "Short DOM text",
    createdAtOnX: "2026-04-01T00:00:00.000Z"
  })
  await assignBookmarksToInboxIfMissing(["tweet-123"])

  const bookmarkLists = await getAllBookmarkLists()

  assert.deepEqual(bookmarkLists.map((entry) => ({ bookmarkId: entry.bookmarkId, listId: entry.listId })), [
    { bookmarkId: "tweet-123", listId: "list-inbox" }
  ])
})

test("removeBookmarkSnapshot removes the bookmark and all related list and tag mappings", async () => {
  await resetBookmarksDb()

  await upsertBookmarkSnapshot({
    tweetId: "tweet-123",
    tweetUrl: "https://x.com/alice/status/123",
    authorName: "Alice",
    authorHandle: "alice",
    text: "Short DOM text",
    createdAtOnX: "2026-04-01T00:00:00.000Z"
  })
  await assignBookmarksToInboxIfMissing(["tweet-123"])
  const tag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-123", tagId: tag.id })

  await removeBookmarkSnapshot("tweet-123")

  assert.equal((await getAllBookmarks()).length, 0)
  assert.equal((await getAllBookmarkLists()).length, 0)
  assert.equal((await getAllBookmarkTags()).length, 0)
})
