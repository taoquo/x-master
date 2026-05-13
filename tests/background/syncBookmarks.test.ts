import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { runBookmarkSync } from "../../src/background/syncBookmarks.ts"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createEmptySyncSummary, type ExtensionSettings } from "../../src/lib/types.ts"

test("runBookmarkSync stores fetched bookmarks, assigns inbox, and applies matching rules", async () => {
  const recordedSummaries: Array<{ status: string; errorSummary?: string }> = []
  const recordedSyncRuns: Array<{ id: string; status: string; finishedAt?: string }> = []
  const recordedInboxAssignments: string[][] = []
  const recordedTagAssignments: Array<{ bookmarkId: string; tagId: string }> = []

  const result = await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async ({ fetchPage, limit, stopAfterConsecutiveKnownPages }) => {
      assert.equal(limit, 10000)
      assert.equal(stopAfterConsecutiveKnownPages, undefined)
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
            text: "hello agents",
            createdAtOnX: "2026-03-15T00:00:00.000Z",
            savedAt: "2026-03-15T01:00:00.000Z",
            rawPayload: {}
          },
          {
            tweetId: "124",
            tweetUrl: "https://x.com/b/status/124",
            authorName: "Bob",
            authorHandle: "bob",
            text: "plain note",
            createdAtOnX: "2026-03-15T00:00:00.000Z",
            savedAt: "2026-03-15T01:05:00.000Z",
            rawPayload: {}
          }
        ],
        nextCursor: null,
        failedCount: 0
      }
    },
    upsertBookmarks: async (bookmarks) => {
      assert.equal(bookmarks.length, 2)
      return { insertedCount: 2, updatedCount: 0 }
    },
    assignBookmarksToInboxIfMissing: async (bookmarkIds) => {
      recordedInboxAssignments.push(bookmarkIds)
    },
    getAllTags: async () => [
      {
        id: "tag-ai",
        name: "AI",
        createdAt: "2026-03-15T00:00:00.000Z"
      }
    ],
    getAllBookmarkTags: async () => [],
    attachBookmarkTags: async (relations) => {
      recordedTagAssignments.push(...relations)
      return relations.length
    },
    getSettings: async () => ({
      schemaVersion: 3,
      locale: "zh-CN",
      themePreference: "system",
      lastSyncSummary: createEmptySyncSummary(),
      classificationRules: [
        {
          id: "rule-1",
          name: "AI tag",
          enabled: true,
          authorHandles: ["alice"],
          keywords: ["hello"],
          requireMedia: false,
          requireLongform: false,
          targetTagIds: ["tag-ai"]
        }
      ],
      savedViews: []
    }),
    createSyncRun: async (syncRun) => {
      recordedSyncRuns.push({
        id: syncRun.id,
        status: syncRun.status,
        finishedAt: syncRun.finishedAt
      })
    },
    updateSyncSummary: async (summary) => {
      recordedSummaries.push({ status: summary.status, errorSummary: summary.errorSummary })
    }
  })

  assert.equal(result.fetchedCount, 2)
  assert.equal(result.insertedCount, 2)
  assert.equal(result.updatedCount, 0)
  assert.equal(result.failedCount, 0)
  assert.deepEqual(recordedInboxAssignments, [["123", "124"]])
  assert.deepEqual(recordedTagAssignments, [{ bookmarkId: "123", tagId: "tag-ai" }])
  assert.deepEqual(recordedSummaries.map((summary) => summary.status), ["running", "success"])
  assert.deepEqual(recordedSyncRuns.map((syncRun) => syncRun.status), ["running", "success"])
  assert.equal(recordedSyncRuns[0]?.id, recordedSyncRuns[1]?.id)
  assert.match(String(recordedSyncRuns[1]?.finishedAt), /^\d{4}-\d{2}-\d{2}T/)
})

test("runBookmarkSync default summary persistence updates saved settings", async () => {
  let savedSettings: ExtensionSettings = {
    schemaVersion: 4,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    savedViews: [],
    syncStrategyVersion: 1,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: 3
  }

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({ bookmarks: [], failedCount: 0 }),
    createSyncRun: async () => {},
    getSettings: async () => savedSettings,
    saveSettings: async (nextSettings) => {
      savedSettings = nextSettings
    }
  })

  assert.equal(savedSettings.lastSyncSummary.status, "success")
  assert.equal(savedSettings.lastSyncSummary.fetchedCount, 0)
  assert.equal(savedSettings.hasCompletedInitialFullSync, true)
})

test("runBookmarkSync does not delete bookmarks that are already stored locally", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "existing-1",
      tweetUrl: "https://x.com/alice/status/existing-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "keep me",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({ bookmarks: [], failedCount: 0 }),
    createSyncRun: async () => {},
    getSettings: async () => ({
      schemaVersion: 4,
      locale: "zh-CN",
      themePreference: "system",
      lastSyncSummary: createEmptySyncSummary(),
      classificationRules: [],
      savedViews: [],
      syncStrategyVersion: 1,
      hasCompletedInitialFullSync: true,
      incrementalStopBufferPages: 3
    }),
    saveSettings: async () => {}
  })

  const bookmarks = await getAllBookmarks()
  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].tweetId, "existing-1")
})

test("runBookmarkSync uses buffered incremental mode after initial sync completes", async () => {
  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async ({ limit, stopAfterConsecutiveKnownPages }) => {
      assert.equal(limit, 10000)
      assert.equal(stopAfterConsecutiveKnownPages, 3)
      return { bookmarks: [], failedCount: 0 }
    },
    createSyncRun: async () => {},
    getSettings: async () => ({
      schemaVersion: 4,
      locale: "zh-CN",
      themePreference: "system",
      lastSyncSummary: createEmptySyncSummary(),
      classificationRules: [],
      savedViews: [],
      syncStrategyVersion: 1,
      hasCompletedInitialFullSync: true,
      incrementalStopBufferPages: 3
    }),
    saveSettings: async () => {}
  })
})

test("runBookmarkSync does not mark initial full sync complete when the first sync fails", async () => {
  let savedSettings: ExtensionSettings = {
    schemaVersion: 4,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    savedViews: [],
    syncStrategyVersion: 1,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: 3
  }

  await assert.rejects(
    () =>
      runBookmarkSync({
        getXCookieHeader: async () => "auth_token=abc; ct0=token123",
        fetchAllBookmarks: async () => {
          throw new Error("boom")
        },
        createSyncRun: async () => {},
        getSettings: async () => savedSettings,
        saveSettings: async (nextSettings) => {
          savedSettings = nextSettings
        }
      }),
    /同步失败，请重试/
  )

  assert.equal(savedSettings.hasCompletedInitialFullSync, false)
  assert.equal(savedSettings.lastSyncSummary.errorKind, "unknown")
  assert.equal(savedSettings.lastSyncSummary.errorSummary, "同步失败，请重试。")
})

test("runBookmarkSync persists an auth-expired error kind and rethrows a friendly error", async () => {
  const recordedSummaries: Array<{ status: string; errorKind?: string; errorSummary?: string }> = []
  const recordedSyncRuns: Array<{ id: string; status: string; errorKind?: string; errorSummary?: string; finishedAt?: string }> = []

  await assert.rejects(
    () =>
      runBookmarkSync({
        getXCookieHeader: async () => "auth_token=abc; ct0=token123",
        fetchBookmarksPage: async () => {
          throw new Error("X API error 401: unauthorized response body")
        },
        createSyncRun: async (syncRun) => {
          recordedSyncRuns.push({
            id: syncRun.id,
            status: syncRun.status,
            errorKind: syncRun.errorKind,
            errorSummary: syncRun.errorSummary,
            finishedAt: syncRun.finishedAt
          })
        },
        updateSyncSummary: async (summary) => {
          recordedSummaries.push({
            status: summary.status,
            errorKind: summary.errorKind,
            errorSummary: summary.errorSummary
          })
        }
      }),
    /X 登录已失效/
  )

  assert.deepEqual(recordedSummaries.map((summary) => summary.status), ["running", "error"])
  assert.equal(recordedSummaries[1].errorKind, "auth_expired")
  assert.equal(recordedSummaries[1].errorSummary, "X 登录已失效，请重新登录 X 后再同步。")
  assert.doesNotMatch(recordedSummaries[1].errorSummary ?? "", /unauthorized response body/)
  assert.deepEqual(recordedSyncRuns.map((syncRun) => syncRun.status), ["running", "error"])
  assert.equal(recordedSyncRuns[0]?.id, recordedSyncRuns[1]?.id)
  assert.equal(recordedSyncRuns[1]?.errorKind, "auth_expired")
  assert.equal(recordedSyncRuns[1]?.errorSummary, "X 登录已失效，请重新登录 X 后再同步。")
  assert.match(String(recordedSyncRuns[1]?.finishedAt), /^\d{4}-\d{2}-\d{2}T/)
})

test("runBookmarkSync persists specific recoverable sync error kinds", async () => {
  const cases = [
    {
      error: new Error("X API error 429"),
      kind: "rate_limited",
      summary: "X 暂时限制了同步请求，请稍后再试。"
    },
    {
      error: new TypeError("Failed to fetch"),
      kind: "network_error",
      summary: "网络请求失败，请检查网络连接后重试。"
    },
    {
      error: new Error("X bookmark timeline structure changed"),
      kind: "x_schema_changed",
      summary: "X 页面或 API 结构已变化，请更新扩展后再同步。"
    }
  ]

  for (const currentCase of cases) {
    const recordedSummaries: Array<{ status: string; errorKind?: string; errorSummary?: string }> = []

    await assert.rejects(
      () =>
        runBookmarkSync({
          getXCookieHeader: async () => "auth_token=abc; ct0=token123",
          fetchBookmarksPage: async () => {
            throw currentCase.error
          },
          createSyncRun: async () => {},
          updateSyncSummary: async (summary) => {
            recordedSummaries.push({
              status: summary.status,
              errorKind: summary.errorKind,
              errorSummary: summary.errorSummary
            })
          }
        }),
      (error) => {
        assert.match(error instanceof Error ? error.message : String(error), new RegExp(currentCase.summary))
        return true
      }
    )

    const errorSummary = recordedSummaries.at(-1)
    assert.equal(errorSummary?.status, "error")
    assert.equal(errorSummary?.errorKind, currentCase.kind)
    assert.equal(errorSummary?.errorSummary, currentCase.summary)
  }
})

test("runBookmarkSync clears stale sync errors when a later sync succeeds", async () => {
  let savedSettings: ExtensionSettings = {
    schemaVersion: 4,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: {
      status: "error",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 1,
      errorKind: "network_error",
      errorSummary: "old error"
    },
    classificationRules: [],
    savedViews: [],
    syncStrategyVersion: 1,
    hasCompletedInitialFullSync: true,
    incrementalStopBufferPages: 3
  }

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({ bookmarks: [], failedCount: 0 }),
    createSyncRun: async () => {},
    getSettings: async () => savedSettings,
    saveSettings: async (nextSettings) => {
      savedSettings = nextSettings
    }
  })

  assert.equal(savedSettings.lastSyncSummary.status, "success")
  assert.equal(savedSettings.lastSyncSummary.errorKind, undefined)
  assert.equal(savedSettings.lastSyncSummary.errorSummary, undefined)
})
