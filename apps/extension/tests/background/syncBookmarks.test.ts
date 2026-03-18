import test from "node:test"
import assert from "node:assert/strict"
import { runBookmarkSync } from "../../src/background/syncBookmarks.ts"
import type { ExtensionSettings } from "../../src/lib/types.ts"

test("runBookmarkSync stores fetched bookmarks locally and returns sync stats", async () => {
  const recordedSummaries: Array<{ status: string; errorSummary?: string }> = []
  let recordedSyncRun: unknown

  const result = await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async ({ fetchPage, limit }) => {
      assert.equal(limit, 1000)
      const page = await fetchPage({ cursor: undefined })
      return { bookmarks: page.bookmarks, failedCount: page.failedCount ?? 0 }
    },
    fetchBookmarksPage: async ({ cursor, requestContext }) => {
      assert.equal(cursor, undefined)
      assert.equal(requestContext.cookieHeader, "auth_token=abc; ct0=token123")
      assert.equal(requestContext.csrfToken, "token123")

      return {
        bookmarks: [
          {
            tweetId: "123",
            tweetUrl: "https://x.com/a/status/123",
            authorName: "Alice",
            authorHandle: "alice",
            text: "hello",
            createdAtOnX: "2026-03-15T00:00:00.000Z",
            savedAt: "2026-03-15T01:00:00.000Z",
            rawPayload: {}
          }
        ],
        nextCursor: null,
        failedCount: 0
      }
    },
    upsertBookmarks: async (bookmarks) => {
      assert.equal(bookmarks.length, 1)
      return { insertedCount: 1, updatedCount: 0 }
    },
    assignBookmarksToInboxIfMissing: async (bookmarkIds) => {
      assert.deepEqual(bookmarkIds, ["123"])
    },
    createSyncRun: async (syncRun) => {
      recordedSyncRun = syncRun
    },
    updateSyncSummary: async (summary) => {
      recordedSummaries.push({ status: summary.status, errorSummary: summary.errorSummary })
    }
  })

  assert.equal(result.fetchedCount, 1)
  assert.equal(result.insertedCount, 1)
  assert.equal(result.updatedCount, 0)
  assert.equal(result.failedCount, 0)
  assert.deepEqual(
    recordedSummaries.map((summary) => summary.status),
    ["running", "success"]
  )
  assert.match(String((recordedSyncRun as { status?: string })?.status), /success/)
})

test("runBookmarkSync default summary persistence updates saved settings", async () => {
  let savedSettings: ExtensionSettings = {
    schemaVersion: 1,
    hasCompletedOnboarding: false,
    lastSyncSummary: {
      status: "idle" as const,
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    }
  }

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({ bookmarks: [], failedCount: 0 }),
    upsertBookmarks: async () => ({ insertedCount: 0, updatedCount: 0 }),
    assignBookmarksToInboxIfMissing: async () => {},
    createSyncRun: async () => {},
    getSettings: async () => savedSettings,
    saveSettings: async (nextSettings) => {
      savedSettings = nextSettings
    }
  })

  assert.equal(savedSettings.lastSyncSummary.status, "success")
  assert.equal(savedSettings.lastSyncSummary.fetchedCount, 0)
})

test("runBookmarkSync persists an error summary and rethrows when sync fails", async () => {
  const recordedSummaries: Array<{ status: string; errorSummary?: string }> = []
  let recordedSyncRun: unknown

  await assert.rejects(
    () =>
      runBookmarkSync({
        getXCookieHeader: async () => "auth_token=abc; ct0=token123",
        fetchBookmarksPage: async () => {
          throw new Error("X API error 401: unauthorized response body")
        },
        assignBookmarksToInboxIfMissing: async () => {},
        createSyncRun: async (syncRun) => {
          recordedSyncRun = syncRun
        },
        updateSyncSummary: async (summary) => {
          recordedSummaries.push({ status: summary.status, errorSummary: summary.errorSummary })
        }
      }),
    /X API error 401: unauthorized response body/
  )

  assert.deepEqual(
    recordedSummaries.map((summary) => summary.status),
    ["running", "error"]
  )
  assert.equal(recordedSummaries[1].errorSummary, "X API error 401: unauthorized response body")
  assert.equal((recordedSyncRun as { status?: string; errorSummary?: string }).status, "error")
  assert.equal(
    (recordedSyncRun as { status?: string; errorSummary?: string }).errorSummary,
    "X API error 401: unauthorized response body"
  )
})
