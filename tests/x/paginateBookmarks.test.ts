import test from "node:test"
import assert from "node:assert/strict"
import { fetchAllBookmarks } from "../../src/lib/x/paginateBookmarks.ts"

test("fetchAllBookmarks continues until next cursor is absent", async () => {
  const calls: Array<string | null | undefined> = []
  const fetchPage = async ({ cursor }: { cursor?: string | null }) => {
    calls.push(cursor)

    if (!cursor) {
      return {
        bookmarks: [{ tweetId: "1" }],
        nextCursor: "cursor-2",
        failedCount: 0
      }
    }

    return {
      bookmarks: [{ tweetId: "2" }],
      nextCursor: null,
      failedCount: 0
    }
  }

  const result = await fetchAllBookmarks({ fetchPage, limit: 100 })

  assert.deepEqual(calls, [undefined, "cursor-2"])
  assert.equal(result.bookmarks.length, 2)
  assert.equal(result.failedCount, 0)
})

test("fetchAllBookmarks stops at the configured limit", async () => {
  const fetchPage = async ({ cursor }: { cursor?: string | null }) => {
    if (!cursor) {
      return {
        bookmarks: [{ tweetId: "1" }, { tweetId: "2" }],
        nextCursor: "cursor-2",
        failedCount: 0
      }
    }

    return {
      bookmarks: [{ tweetId: "3" }],
      nextCursor: null,
      failedCount: 0
    }
  }

  const result = await fetchAllBookmarks({ fetchPage, limit: 2 })

  assert.deepEqual(result.bookmarks.map((bookmark) => bookmark.tweetId), ["1", "2"])
})

test("fetchAllBookmarks returns partial results when a later page fails", async () => {
  const fetchPage = async ({ cursor }: { cursor?: string | null }) => {
    if (!cursor) {
      return {
        bookmarks: [{ tweetId: "1" }],
        nextCursor: "cursor-2",
        failedCount: 0
      }
    }

    throw new Error("boom")
  }

  const result = await fetchAllBookmarks({ fetchPage, limit: 100 })

  assert.deepEqual(result.bookmarks.map((bookmark) => bookmark.tweetId), ["1"])
  assert.equal(result.failedCount, 1)
})
