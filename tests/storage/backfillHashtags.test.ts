import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { backfillHashtagsFromRawPayloads } from "../../src/lib/storage/backfillHashtags.ts"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { upsertRawPayloads } from "../../src/lib/storage/rawPayloadsStore.ts"

function installChromeStorageMock() {
  let stored: Record<string, unknown> = {}

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: stored[key] }),
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
        }
      }
    }
  }
}

function createBookmark(tweetId: string, overrides: Record<string, unknown> = {}) {
  return {
    tweetId,
    tweetUrl: `https://x.com/alice/status/${tweetId}`,
    authorName: "Alice",
    authorHandle: "alice",
    text: "hello",
    createdAtOnX: "2026-03-15T00:00:00.000Z",
    savedAt: "2026-03-15T01:00:00.000Z",
    ...overrides
  }
}

test("backfillHashtagsFromRawPayloads extracts hashtags once and is idempotent", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  await upsertBookmarks([
    createBookmark("tweet-1"),
    createBookmark("tweet-2", { hashtags: ["Existing"] })
  ])
  await upsertRawPayloads([
    {
      tweetId: "tweet-1",
      payload: { legacy: { entities: { hashtags: [{ text: "AI" }, { text: "ai" }, { text: "Rust" }] } } }
    }
  ])

  const firstRun = await backfillHashtagsFromRawPayloads()
  assert.equal(firstRun.skipped, false)
  assert.equal(firstRun.updatedCount, 1)

  const bookmarks = await getAllBookmarks()
  const first = bookmarks.find((bookmark) => bookmark.tweetId === "tweet-1")
  const second = bookmarks.find((bookmark) => bookmark.tweetId === "tweet-2")
  assert.deepEqual(first?.hashtags, ["AI", "Rust"])
  assert.deepEqual(second?.hashtags, ["Existing"])

  const secondRun = await backfillHashtagsFromRawPayloads()
  assert.equal(secondRun.skipped, true)
  assert.equal(secondRun.updatedCount, 0)
})

test("backfillHashtagsFromRawPayloads stores empty arrays when no raw payload exists", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  await upsertBookmarks([createBookmark("tweet-solo")])

  const result = await backfillHashtagsFromRawPayloads()
  assert.equal(result.updatedCount, 1)

  const bookmarks = await getAllBookmarks()
  assert.deepEqual(bookmarks[0].hashtags, [])
})
