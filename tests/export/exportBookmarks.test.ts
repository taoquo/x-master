import test from "node:test"
import assert from "node:assert/strict"
import {
  WORKSPACE_EXPORT_VERSION,
  createWorkspaceExportFilename,
  createWorkspaceExportPayload,
  exportBookmarks
} from "../../src/lib/export/exportBookmarks.ts"
import { createEmptySyncSummary, type ExtensionSettings, type WorkspaceData } from "../../src/lib/types.ts"
import { createEmptyWorkspaceStats } from "../../src/lib/workspace/stats.ts"

function createWorkspaceData(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    bookmarks: [],
    lists: [],
    bookmarkLists: [],
    tags: [],
    bookmarkTags: [],
    classificationRules: [],
    summary: createEmptySyncSummary(),
    latestSyncRun: null,
    stats: createEmptyWorkspaceStats(),
    ...overrides
  }
}

function createSettings(overrides: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    ...overrides
  }
}

test("createWorkspaceExportPayload includes workspace data and strips rawPayload", () => {
  const workspace = createWorkspaceData({
    bookmarks: [
      {
        tweetId: "tweet-1",
        tweetUrl: "https://x.com/alice/status/tweet-1",
        authorName: "Alice",
        authorHandle: "alice",
        text: "Agents for export",
        createdAtOnX: "2026-04-11T08:00:00.000Z",
        savedAt: "2026-04-11T08:05:00.000Z",
        lastSeenAt: "2026-04-11T08:08:00.000Z",
        rawPayload: { hidden: true },
        updatedAt: "2026-04-11T08:06:00.000Z"
      }
    ],
    lists: [{ id: "list-inbox", name: "Inbox", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkLists: [{ bookmarkId: "tweet-1", listId: "list-inbox", updatedAt: "2026-04-11T08:05:00.000Z" }],
    tags: [{ id: "tag-ai", name: "AI", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkTags: [{ id: "tweet-1:tag-ai", bookmarkId: "tweet-1", tagId: "tag-ai", createdAt: "2026-04-11T08:05:00.000Z" }],
    classificationRules: [
      {
        id: "rule-1",
        name: "AI rule",
        enabled: true,
        authorHandles: ["alice"],
        keywords: ["agent"],
        requireMedia: false,
        requireLongform: false,
        targetTagIds: ["tag-ai"]
      }
    ],
    summary: {
      status: "success",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-04-11T08:05:00.000Z"
    },
    latestSyncRun: {
      id: "sync-1",
      status: "success",
      startedAt: "2026-04-11T08:00:00.000Z",
      finishedAt: "2026-04-11T08:05:00.000Z",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0
    }
  })
  const settings = createSettings({
    locale: "zh-CN",
    themePreference: "dark",
    classificationRules: workspace.classificationRules,
    lastSyncSummary: workspace.summary
  })

  const payload = createWorkspaceExportPayload({
    workspace,
    settings,
    exportedAt: "2026-04-11T09:00:00.000Z"
  })

  assert.equal(payload.exportVersion, WORKSPACE_EXPORT_VERSION)
  assert.equal(payload.schemaVersion, 3)
  assert.equal(payload.exportedAt, "2026-04-11T09:00:00.000Z")
  assert.equal(payload.bookmarks.length, 1)
  assert.equal("rawPayload" in payload.bookmarks[0], false)
  assert.equal(payload.bookmarks[0].lastSeenAt, "2026-04-11T08:08:00.000Z")
  assert.equal(payload.settings.locale, "zh-CN")
  assert.equal(payload.settings.themePreference, "dark")
  assert.deepEqual(payload.summary, workspace.summary)
  assert.deepEqual(payload.latestSyncRun, workspace.latestSyncRun)
})

test("exportBookmarks serializes an empty workspace backup as JSON", () => {
  const workspace = createWorkspaceData()
  const settings = createSettings()

  const json = exportBookmarks({
    workspace,
    settings,
    exportedAt: "2026-04-11T09:30:00.000Z"
  })

  const parsed = JSON.parse(json)
  assert.equal(parsed.exportedAt, "2026-04-11T09:30:00.000Z")
  assert.deepEqual(parsed.bookmarks, [])
  assert.deepEqual(parsed.tags, [])
  assert.deepEqual(parsed.settings.classificationRules, [])
})

test("createWorkspaceExportFilename uses the expected backup naming scheme", () => {
  assert.equal(createWorkspaceExportFilename("2026-04-11T10:20:30.000Z"), "xbm-workspace-2026-04-11.json")
})
