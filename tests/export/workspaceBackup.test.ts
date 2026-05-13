import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { getAllBookmarkLists, getAllLists } from "../../src/lib/storage/listsStore.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { createSyncRun, getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { createEmptySyncSummary, type ExtensionSettings } from "../../src/lib/types.ts"
import {
  restoreWorkspaceBackup,
  validateWorkspaceBackupText,
  type WorkspaceRestoreResult
} from "../../src/lib/export/workspaceBackup.ts"
import { WORKSPACE_EXPORT_VERSION, type WorkspaceExportPayload } from "../../src/lib/export/exportBookmarks.ts"

function installSettingsHarness() {
  let storedSettings: unknown

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedSettings }),
        set: async (value: Record<string, unknown>) => {
          storedSettings = value.settings
        }
      }
    }
  }

  return {
    getStoredSettings: () => storedSettings
  }
}

function createSettings(overrides: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    savedViews: [],
    ...overrides
  }
}

function createBackupPayload(overrides: Partial<WorkspaceExportPayload> = {}): WorkspaceExportPayload {
  const summary = {
    status: "success" as const,
    fetchedCount: 1,
    insertedCount: 1,
    updatedCount: 0,
    failedCount: 0,
    lastSyncedAt: "2026-04-11T08:05:00.000Z"
  }
  const classificationRules = [
    {
      id: "rule-1",
      name: "AI",
      enabled: true,
      authorHandles: ["alice"],
      keywords: ["agent"],
      requireMedia: false,
      requireLongform: false,
      targetTagIds: ["tag-ai"]
    }
  ]

  return {
    exportVersion: WORKSPACE_EXPORT_VERSION,
    schemaVersion: 3,
    exportedAt: "2026-04-11T09:00:00.000Z",
    bookmarks: [
      {
        tweetId: "tweet-1",
        tweetUrl: "https://x.com/alice/status/tweet-1",
        authorName: "Alice",
        authorHandle: "alice",
        text: "Agents for restore",
        createdAtOnX: "2026-04-11T08:00:00.000Z",
        savedAt: "2026-04-11T08:05:00.000Z",
        lastSeenAt: "2026-04-11T08:06:00.000Z",
        metrics: {
          likes: 4,
          retweets: 2,
          replies: 1
        }
      }
    ],
    lists: [{ id: "list-inbox", name: "Inbox", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkLists: [{ bookmarkId: "tweet-1", listId: "list-inbox", updatedAt: "2026-04-11T08:05:00.000Z" }],
    tags: [{ id: "tag-ai", name: "AI", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkTags: [{ id: "tweet-1:tag-ai", bookmarkId: "tweet-1", tagId: "tag-ai", createdAt: "2026-04-11T08:05:00.000Z" }],
    classificationRules,
    settings: {
      schemaVersion: 3,
      locale: "zh-CN",
      themePreference: "dark",
      classificationRules,
      savedViews: [
        {
          id: "view-ai",
          name: "AI media",
          createdAt: "2026-05-12T08:00:00.000Z",
          updatedAt: "2026-05-12T08:10:00.000Z",
          query: "agent",
          activeTagIds: ["tag-ai"],
          activeAuthorHandles: ["alice"],
          onlyWithMedia: true,
          onlyLongform: false,
          sortOrder: "likes-desc",
          viewMode: "list"
        }
      ],
      lastSyncSummary: summary
    },
    summary,
    latestSyncRun: {
      id: "sync-1",
      status: "success",
      startedAt: "2026-04-11T08:00:00.000Z",
      finishedAt: "2026-04-11T08:05:00.000Z",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0
    },
    ...overrides
  }
}

test.beforeEach(async () => {
  installSettingsHarness()
  await resetBookmarksDb()
})

test("validateWorkspaceBackupText accepts a valid workspace backup and returns counts", () => {
  const result = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))

  assert.equal(result.exportedAt, "2026-04-11T09:00:00.000Z")
  assert.equal(result.payload.exportVersion, WORKSPACE_EXPORT_VERSION)
  assert.equal(result.payload.settings.savedViews?.length, 1)
  assert.equal(result.payload.settings.savedViews?.[0].name, "AI media")
  assert.deepEqual(result.counts, {
    bookmarks: 1,
    lists: 1,
    bookmarkLists: 1,
    tags: 1,
    bookmarkTags: 1,
    classificationRules: 1,
    latestSyncRun: 1
  })
})

test("validateWorkspaceBackupText preserves sync error kind fields and accepts legacy summaries without them", () => {
  const errorSummary = {
    status: "error" as const,
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 1,
    errorKind: "auth_expired" as const,
    errorSummary: "X 登录已失效，请重新登录 X 后再同步。"
  }
  const result = validateWorkspaceBackupText(
    JSON.stringify(
      createBackupPayload({
        summary: errorSummary,
        settings: {
          schemaVersion: 3,
          locale: "zh-CN",
          themePreference: "dark",
          classificationRules: [],
          lastSyncSummary: errorSummary
        },
        latestSyncRun: {
          id: "sync-error",
          status: "error",
          fetchedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          failedCount: 1,
          errorKind: "auth_expired",
          errorSummary: "X 登录已失效，请重新登录 X 后再同步。"
        }
      })
    )
  )

  assert.equal(result.payload.summary.errorKind, "auth_expired")
  assert.equal(result.payload.settings.lastSyncSummary?.errorKind, "auth_expired")
  assert.equal(result.payload.latestSyncRun?.errorKind, "auth_expired")

  const legacyResult = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))
  assert.equal(legacyResult.payload.summary.errorKind, undefined)
})

test("validateWorkspaceBackupText rejects invalid sync error kinds", () => {
  const payload = createBackupPayload({
    summary: {
      status: "error",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 1,
      errorKind: "raw-http-error",
      errorSummary: "raw error"
    } as unknown as WorkspaceExportPayload["summary"]
  })

  assert.throws(() => validateWorkspaceBackupText(JSON.stringify(payload)), /summary\.errorKind is invalid/)
})

test("validateWorkspaceBackupText rejects non-json backup text", () => {
  assert.throws(() => validateWorkspaceBackupText("not json"), /Backup file must be valid JSON/)
})

test("validateWorkspaceBackupText rejects unsupported export versions", () => {
  assert.throws(
    () => validateWorkspaceBackupText(JSON.stringify(createBackupPayload({ exportVersion: 999 }))),
    /Unsupported backup version/
  )
})

test("validateWorkspaceBackupText rejects missing required bookmark fields", () => {
  const payload = createBackupPayload({
    bookmarks: [{ tweetId: "tweet-1" } as WorkspaceExportPayload["bookmarks"][number]]
  })

  assert.throws(() => validateWorkspaceBackupText(JSON.stringify(payload)), /bookmarks\[0\]\.tweetUrl is required/)
})

test("validateWorkspaceBackupText rejects relation records that point at missing entities", () => {
  const payload = createBackupPayload({
    bookmarkTags: [
      {
        id: "tweet-1:tag-missing",
        bookmarkId: "tweet-1",
        tagId: "tag-missing",
        createdAt: "2026-04-11T08:05:00.000Z"
      }
    ]
  })

  assert.throws(() => validateWorkspaceBackupText(JSON.stringify(payload)), /bookmarkTags\[0\]\.tagId references a missing tag/)
})

test("restoreWorkspaceBackup overwrites local data with a validated backup", async () => {
  await upsertBookmarks([
    {
      tweetId: "old-tweet",
      tweetUrl: "https://x.com/old/status/old-tweet",
      authorName: "Old",
      authorHandle: "old",
      text: "Old local data",
      createdAtOnX: "2026-04-10T08:00:00.000Z",
      savedAt: "2026-04-10T08:05:00.000Z",
      rawPayload: { source: "old" }
    }
  ])
  await createSyncRun({
    id: "old-sync",
    status: "success",
    fetchedCount: 1,
    insertedCount: 1,
    updatedCount: 0,
    failedCount: 0
  })
  await saveSettings(createSettings({ locale: "en", themePreference: "system" }))

  const validation = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))
  const result: WorkspaceRestoreResult = await restoreWorkspaceBackup(validation.payload)

  assert.equal(result.counts.bookmarks, 1)
  assert.equal(result.counts.tags, 1)
  assert.equal(result.counts.lists, 1)

  const [bookmarks, lists, bookmarkLists, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
    getAllBookmarks(),
    getAllLists(),
    getAllBookmarkLists(),
    getAllTags(),
    getAllBookmarkTags(),
    getSettings(),
    getLatestSyncRun()
  ])

  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].tweetId, "tweet-1")
  assert.deepEqual(bookmarks[0].rawPayload, { source: "workspace-restore" })
  assert.equal(lists.length, 1)
  assert.equal(bookmarkLists.length, 1)
  assert.equal(tags.length, 1)
  assert.equal(bookmarkTags.length, 1)
  assert.equal(settings.locale, "zh-CN")
  assert.equal(settings.themePreference, "dark")
  assert.equal(settings.lastSyncSummary.status, "success")
  assert.equal(settings.classificationRules.length, 1)
  assert.equal(settings.savedViews.length, 1)
  assert.equal(settings.savedViews[0].name, "AI media")
  assert.equal(latestSyncRun?.id, "sync-1")
})

test("validateWorkspaceBackupText accepts legacy settings without saved views", () => {
  const payload = createBackupPayload()
  delete (payload.settings as Partial<typeof payload.settings>).savedViews

  const result = validateWorkspaceBackupText(JSON.stringify(payload))

  assert.equal(result.payload.settings.savedViews, undefined)
})

test("restoreWorkspaceBackup keeps sync runs empty when the backup has no latest sync run", async () => {
  await createSyncRun({
    id: "old-sync",
    status: "success",
    fetchedCount: 1,
    insertedCount: 1,
    updatedCount: 0,
    failedCount: 0
  })

  const validation = validateWorkspaceBackupText(JSON.stringify(createBackupPayload({ latestSyncRun: null })))
  await restoreWorkspaceBackup(validation.payload)

  assert.equal(await getLatestSyncRun(), null)
})
