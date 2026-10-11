import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createDefaultAutoTagSettings, getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { createSyncRun, getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import { createTag, getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { deleteTagsPermanently } from "../../src/lib/tags/tagActions.ts"
import { createTagSuggestion, getAllTagSuggestions, insertNewTagSuggestions } from "../../src/lib/storage/suggestionsStore.ts"
import {
  createLlmAnalysisRecord,
  getAllLlmAnalysis,
  putLlmAnalysisRecords
} from "../../src/lib/storage/llmAnalysisStore.ts"
import { createEmptySyncSummary, type ExtensionSettings } from "../../src/lib/types.ts"
import {
  restoreWorkspaceBackup,
  validateWorkspaceBackupText,
  type WorkspaceRestoreResult
} from "../../src/lib/export/workspaceBackup.ts"
import { createWorkspaceExportPayload } from "../../src/lib/export/exportBookmarks.ts"
import { getSecrets, saveSecrets } from "../../src/lib/storage/secrets.ts"
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
    savedViews: [],
    autoTag: createDefaultAutoTagSettings(),
    ...overrides
  } as ExtensionSettings
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
    tags: [{ id: "tag-ai", name: "AI", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkTags: [{ id: "tweet-1:tag-ai", bookmarkId: "tweet-1", tagId: "tag-ai", createdAt: "2026-04-11T08:05:00.000Z" }],
    settings: {
      schemaVersion: 3,
      locale: "zh-CN",
      themePreference: "dark",
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
    tags: 1,
    bookmarkTags: 1,
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

test("validateWorkspaceBackupText round-trips the optional tag parentId", async () => {
  const payload = createBackupPayload({
    tags: [
      { id: "tag-ai", name: "AI", createdAt: "2026-04-11T08:00:00.000Z" },
      {
        id: "tag-agents",
        name: "agents",
        createdAt: "2026-04-11T08:00:00.000Z",
        parentId: "tag-ai"
      }
    ]
  })

  const result = validateWorkspaceBackupText(JSON.stringify(payload))

  assert.equal(result.counts.tags, 2)
  assert.equal(result.payload.tags[0].parentId, undefined)
  assert.equal(result.payload.tags[1].parentId, "tag-ai")

  await restoreWorkspaceBackup(result.payload)
  const tags = await getAllTags()

  assert.equal(tags.find((tag) => tag.id === "tag-agents")?.parentId, "tag-ai")
})

test("a backup round-trips bookmark hashtags", async () => {
  const payload = createBackupPayload({
    bookmarks: [
      {
        ...createBackupPayload().bookmarks[0],
        hashtags: ["ai", "agents"]
      }
    ]
  })

  const result = validateWorkspaceBackupText(JSON.stringify(payload))

  // Hashtags used to be exported but dropped on import, which permanently
  // stripped them: raw payloads are not part of a backup, so the one-time
  // backfill could not recover them.
  assert.deepEqual(result.payload.bookmarks[0].hashtags, ["ai", "agents"])

  await restoreWorkspaceBackup(result.payload)
  const [stored] = await getAllBookmarks()

  assert.deepEqual(stored?.hashtags, ["ai", "agents"])
})

test("validateWorkspaceBackupText keeps bookmarks without hashtags undefined", () => {
  const result = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))

  // Absent stays absent: an empty array would claim "this bookmark has no
  // hashtags" and stop the backfill from ever filling it in.
  assert.equal(result.payload.bookmarks[0].hashtags, undefined)
})

test("validateWorkspaceBackupText rejects non-string hashtags", () => {
  const payload = createBackupPayload({
    bookmarks: [
      {
        ...createBackupPayload().bookmarks[0],
        hashtags: ["ai", 42]
      } as unknown as WorkspaceExportPayload["bookmarks"][number]
    ]
  })

  assert.throws(
    () => validateWorkspaceBackupText(JSON.stringify(payload)),
    /bookmarks\[0\]\.hashtags must contain only strings/
  )
})

test("validateWorkspaceBackupText rejects a non-string tag parentId", () => {
  const payload = createBackupPayload({
    tags: [
      {
        id: "tag-agents",
        name: "agents",
        createdAt: "2026-04-11T08:00:00.000Z",
        parentId: 42
      } as unknown as WorkspaceExportPayload["tags"][number]
    ],
    bookmarkTags: []
  })

  assert.throws(() => validateWorkspaceBackupText(JSON.stringify(payload)), /tags\[0\]\.parentId must be a string/)
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

  const [bookmarks, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
    getAllBookmarks(),
    getAllTags(),
    getAllBookmarkTags(),
    getSettings(),
    getLatestSyncRun()
  ])

  assert.equal(bookmarks.length, 1)
  assert.equal(bookmarks[0].tweetId, "tweet-1")
  assert.equal(tags.length, 1)
  assert.equal(bookmarkTags.length, 1)
  assert.equal(settings.locale, "zh-CN")
  assert.equal(settings.themePreference, "dark")
  assert.equal(settings.lastSyncSummary.status, "success")
  assert.equal(settings.savedViews.length, 1)
  assert.equal(settings.savedViews[0].name, "AI media")
  assert.equal(latestSyncRun?.id, "sync-1")
})

test("a workspace backup never carries the LLM API key", async () => {
  await resetBookmarksDb()
  const harness = installSettingsHarness()
  await saveSettings(createSettings({ lastSyncSummary: createEmptySyncSummary() }))

  // Seed a key through the same chrome.storage.local the export reads.
  ;(globalThis as any).chrome.storage.local.get = async (key?: string) => {
    if (key === "secrets") {
      return { secrets: { llmApiKey: "sk-live-should-never-be-exported" } }
    }

    return { settings: harness.getStoredSettings() }
  }

  const { createWorkspaceExportPayload } = await import("../../src/lib/export/exportBookmarks.ts")
  const workspace = {
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
    tagSuggestions: [],
    savedViews: [],
    latestSyncRun: null,
    summary: createEmptySyncSummary(),
    stats: {
      totalBookmarks: 0,
      unclassifiedCount: 0,
      pendingSuggestionCount: 0,
      tagCounts: [],
      topAuthors: []
    }
  }

  const payload = createWorkspaceExportPayload({ workspace, settings: await getSettings() })
  const serialized = JSON.stringify(payload)

  // Spec §3.3: the key lives in its own storage key and must never reach a
  // backup, in any field.
  assert.equal(serialized.includes("sk-live-should-never-be-exported"), false)
  assert.equal(serialized.includes("llmApiKey"), false)
  assert.equal("secrets" in (payload as unknown as Record<string, unknown>), false)
})

test("an imported backup cannot inject a secrets key", async () => {
  await resetBookmarksDb()
  installSettingsHarness()

  const payload = createBackupPayload() as unknown as Record<string, unknown>
  payload.secrets = { llmApiKey: "sk-injected-from-a-tampered-backup" }

  const result = validateWorkspaceBackupText(JSON.stringify(payload))

  // The validator rebuilds a known field set, so an unknown key is dropped
  // rather than carried into storage.
  assert.equal("secrets" in (result.payload as unknown as Record<string, unknown>), false)
  assert.equal(JSON.stringify(result.payload).includes("sk-injected-from-a-tampered-backup"), false)
})

test("restoreWorkspaceBackup drops suggestions and analysis rows for the replaced bookmarks", async () => {
  await resetBookmarksDb()
  installSettingsHarness()

  // Rows derived from the bookmark set that is about to be replaced.
  const orphan = createTagSuggestion({
    bookmarkId: "ghost-1",
    tagName: "Ghost",
    source: "hashtag",
    confidence: 0.9
  })
  assert.ok(orphan)
  await insertNewTagSuggestions([orphan])
  await putLlmAnalysisRecords([
    createLlmAnalysisRecord({
      bookmarkId: "ghost-2",
      model: "test-model",
      contentHash: "hash",
      outcome: "no-topic",
      tagCount: 0
    })
  ])

  const validation = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))
  await restoreWorkspaceBackup(validation.payload)

  // A pending row nobody can resolve inflates the sidebar badge forever, and an
  // analysis row claims a verdict for a bookmark the backup may not contain.
  assert.deepEqual(await getAllTagSuggestions(), [])
  assert.deepEqual(await getAllLlmAnalysis(), [])
})

test("restoreWorkspaceBackup clears the in-flight run state", async () => {
  await resetBookmarksDb()
  installSettingsHarness()
  await saveSettings(
    createSettings({
      autoTagRunState: {
        runId: "run-1",
        startedAt: "2026-08-21T00:00:00.000Z",
        updatedAt: new Date().toISOString(),
        phase: "llm",
        processed: 1,
        total: 5
      }
    })
  )

  const validation = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))
  await restoreWorkspaceBackup(validation.payload)

  // The run was working against the bookmark set that just got replaced.
  assert.equal((await getSettings()).autoTagRunState, undefined)
})

test("restoring a backup releases the tag names it brings back", async () => {
  await resetBookmarksDb()
  installSettingsHarness()

  // Deleting a tag blocks its name so auto-tagging cannot resurrect it.
  const rust = await createTag({ name: "Rust" })
  await deleteTagsPermanently([{ tagId: rust.id, tagName: "Rust" }])
  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, ["rust"])

  const validation = validateWorkspaceBackupText(JSON.stringify(createBackupPayload({
    tags: [{ id: "tag-rust", name: "Rust", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkTags: []
  })))
  await restoreWorkspaceBackup(validation.payload)

  // The tag is back, so the block has to go with it: otherwise the rule engine and
  // the LLM refuse to ever suggest the concept again, silently.
  assert.equal((await getAllTags()).some((tag) => tag.name === "Rust"), true)
  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, [])
})

test("restoreWorkspaceBackup keeps local auto-tag settings that backups do not carry", async () => {
  await resetBookmarksDb()
  installSettingsHarness()

  const localAutoTag = createDefaultAutoTagSettings()
  localAutoTag.enabled = true
  localAutoTag.llm.enabled = true
  localAutoTag.llm.baseUrl = "https://api.appintheloop.com/v1"
  localAutoTag.llm.model = "claude-sonnet-5"

  await saveSettings(createSettings({ locale: "en", autoTag: localAutoTag }))

  const validation = validateWorkspaceBackupText(JSON.stringify(createBackupPayload()))
  await restoreWorkspaceBackup(validation.payload)

  const settings = await getSettings()

  assert.equal(settings.locale, "zh-CN")
  assert.equal(settings.autoTag.enabled, true)
  assert.equal(settings.autoTag.llm.enabled, true)
  assert.equal(settings.autoTag.llm.baseUrl, "https://api.appintheloop.com/v1")
  assert.equal(settings.autoTag.llm.model, "claude-sonnet-5")
})

test("validateWorkspaceBackupText accepts legacy v1 backups and drops lists/rules fields", async () => {
  const legacyPayload = {
    ...createBackupPayload(),
    exportVersion: 1,
    lists: [{ id: "list-inbox", name: "Inbox", createdAt: "2026-04-11T08:00:00.000Z" }],
    bookmarkLists: [{ bookmarkId: "tweet-1", listId: "list-inbox", updatedAt: "2026-04-11T08:05:00.000Z" }],
    classificationRules: [
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
    ],
    settings: {
      schemaVersion: 3,
      locale: "zh-CN" as const,
      themePreference: "dark" as const,
      classificationRules: [
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
    }
  }

  const result = validateWorkspaceBackupText(JSON.stringify(legacyPayload))

  assert.deepEqual(result.counts, {
    bookmarks: 1,
    tags: 1,
    bookmarkTags: 1,
    latestSyncRun: 1
  })

  const restoreResult = await restoreWorkspaceBackup(result.payload)
  assert.equal(restoreResult.counts.bookmarks, 1)

  const settings = getSettings ? await getSettings() : undefined
  assert.equal((settings as unknown as Record<string, unknown>)?.classificationRules, undefined)

  const bookmarks = await getAllBookmarks()
  assert.equal(bookmarks[0]?.tweetId, "tweet-1")
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

test("backup validation rejects parent graphs the app itself can never write", () => {
  const base = createBackupPayload()

  // Self-parent.
  assert.throws(
    () => validateWorkspaceBackupText(JSON.stringify(createBackupPayload({
      tags: [{ id: "tag-a", name: "A", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-a" }],
      bookmarkTags: []
    }))),
    /point at the tag itself/
  )

  // Dangling parent.
  assert.throws(
    () => validateWorkspaceBackupText(JSON.stringify(createBackupPayload({
      tags: [{ id: "tag-a", name: "A", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-missing" }],
      bookmarkTags: []
    }))),
    /parentId references a missing tag/
  )

  // Two-cycle: A's parent is B and B's parent is A. Unreachable through the store,
  // but a hand-edited file used to restore into a library whose parent dropdown was
  // locked because no tag counted as a root.
  assert.throws(
    () => validateWorkspaceBackupText(JSON.stringify(createBackupPayload({
      tags: [
        { id: "tag-a", name: "A", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-b" },
        { id: "tag-b", name: "B", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-a" }
      ],
      bookmarkTags: []
    }))),
    /more than two levels deep/
  )

  // Three levels.
  assert.throws(
    () => validateWorkspaceBackupText(JSON.stringify(createBackupPayload({
      tags: [
        { id: "tag-a", name: "A", createdAt: "2026-04-11T08:00:00.000Z" },
        { id: "tag-b", name: "B", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-a" },
        { id: "tag-c", name: "C", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-b" }
      ],
      bookmarkTags: []
    }))),
    /more than two levels deep/
  )

  // A valid two-level graph still round-trips.
  const ok = validateWorkspaceBackupText(JSON.stringify(createBackupPayload({
    tags: [
      { id: "tag-a", name: "A", createdAt: "2026-04-11T08:00:00.000Z" },
      { id: "tag-b", name: "B", createdAt: "2026-04-11T08:00:00.000Z", parentId: "tag-a" }
    ],
    bookmarkTags: []
  })))
  assert.equal(ok.counts.tags, 2)
  assert.equal(base.exportVersion, WORKSPACE_EXPORT_VERSION)
})

// Behaves like the real chrome.storage.local: several keys in one area, so a test
// can hold settings and secrets at the same time.
function installMultiKeyStorageHarness() {
  let stored: Record<string, unknown> = {}

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key?: string) =>
          typeof key === "string" ? { [key]: stored[key] } : { ...stored },
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
        },
        setAccessLevel: async () => {}
      }
    }
  }

  return { read: () => stored }
}

function emptyWorkspace() {
  return {
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
    tagSuggestions: [],
    savedViews: [],
    summary: createEmptySyncSummary(),
    latestSyncRun: null,
    stats: {
      totalBookmarks: 0,
      unclassifiedCount: 0,
      pendingSuggestionCount: 0,
      tagCounts: [],
      topAuthors: []
    }
  } as Parameters<typeof createWorkspaceExportPayload>[0]["workspace"]
}

test("a backup never carries the stored API key", async () => {
  installMultiKeyStorageHarness()
  await resetBookmarksDb()

  const secret = "sk-live-value-that-must-never-be-exported"
  await saveSecrets({ llmApiKey: secret })
  assert.equal((await getSecrets()).llmApiKey, secret)

  // The export payload is an explicit allow-list, and secrets live in a separate
  // storage key that the export module never reads. This pins that: the whole point
  // of excluding the key is worthless if a later refactor starts spreading settings.
  const payload = createWorkspaceExportPayload({
    workspace: emptyWorkspace(),
    settings: await getSettings()
  })
  const serialized = JSON.stringify(payload)

  assert.equal(serialized.includes(secret), false, "the API key must not appear in a backup")
  assert.equal("secrets" in payload, false, "a backup payload has no secrets field")
  assert.equal(serialized.includes("llmApiKey"), false, "not even the key name is exported")
  assert.deepEqual(Object.keys(payload.settings).sort(), [
    "lastSyncSummary",
    "locale",
    "savedViews",
    "schemaVersion",
    "themePreference"
  ])
})

test("a hand-crafted backup cannot inject or overwrite the API key", async () => {
  installMultiKeyStorageHarness()
  await resetBookmarksDb()

  const secret = "sk-the-real-user-key"
  await saveSecrets({ llmApiKey: secret })

  // A backup file is untrusted input: it must not be able to smuggle a key in and
  // have it written to storage, nor overwrite the one the user already saved.
  const hostile = {
    ...createBackupPayload(),
    secrets: { llmApiKey: "sk-attacker-supplied" },
    settings: { ...createBackupPayload().settings, apiKey: "sk-attacker-supplied" }
  }

  const validation = validateWorkspaceBackupText(JSON.stringify(hostile))
  assert.equal(JSON.stringify(validation.payload).includes("sk-attacker-supplied"), false)

  await restoreWorkspaceBackup(validation.payload)
  assert.equal((await getSecrets()).llmApiKey, secret)
})
