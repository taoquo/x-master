import test from "node:test"
import assert from "node:assert/strict"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { createEmptySyncSummary } from "../../src/lib/types.ts"

function installChromeStorageMock() {
  let storedValue: unknown

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async (value: Record<string, unknown>) => {
          storedValue = value.settings
        }
      }
    }
  }

  return {
    setStoredValue: (value: unknown) => {
      storedValue = value
    },
    getStoredValue: () => storedValue
  }
}

test("getSettings returns bookmark-manager defaults", async () => {
  installChromeStorageMock()

  const settings = await getSettings()

  assert.equal(settings.schemaVersion, 6)
  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "system")
  assert.equal(settings.lastSyncSummary.status, "idle")
  assert.equal(settings.syncStrategyVersion, 1)
  assert.equal(settings.hasCompletedInitialFullSync, false)
  assert.equal(settings.incrementalStopBufferPages, 3)
  assert.equal(settings.leftSidebarWidth, 280)
  assert.equal(settings.rightSidebarWidth, 360)
  assert.deepEqual(settings.savedViews, [])
})

test("getSettings migrates legacy stored fields into the reduced settings shape", async () => {
  const storage = installChromeStorageMock()
  storage.setStoredValue({
    schemaVersion: 2,
    hasCompletedOnboarding: true,
    aiGeneration: {
      enabled: true,
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-5-mini"
    },
    exportScope: "all",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 10,
      insertedCount: 7,
      updatedCount: 3,
      failedCount: 0,
      lastSyncedAt: "2026-03-16T00:00:00.000Z"
    }
  })

  const settings = await getSettings()

  assert.equal(settings.schemaVersion, 6)
  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "system")
  assert.equal(settings.lastSyncSummary.status, "success")
  assert.equal(settings.lastSyncSummary.lastSyncedAt, "2026-03-16T00:00:00.000Z")
  assert.equal(settings.syncStrategyVersion, 1)
  assert.equal(settings.hasCompletedInitialFullSync, false)
  assert.equal(settings.incrementalStopBufferPages, 3)
})

test("getSettings preserves valid sync error kinds and drops invalid values", async () => {
  const storage = installChromeStorageMock()
  storage.setStoredValue({
    lastSyncSummary: {
      status: "error",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 1,
      errorKind: "rate_limited",
      errorSummary: "X 暂时限制了同步请求，请稍后再试。"
    }
  })

  const settings = await getSettings()
  assert.equal(settings.lastSyncSummary.errorKind, "rate_limited")

  storage.setStoredValue({
    lastSyncSummary: {
      status: "error",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 1,
      errorKind: "raw-http-error",
      errorSummary: "raw error"
    }
  })

  const normalizedSettings = await getSettings()
  assert.equal(normalizedSettings.lastSyncSummary.errorKind, undefined)
})

test("saveSettings persists locale and theme preferences", async () => {
  installChromeStorageMock()

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: createEmptySyncSummary(),
    leftSidebarWidth: 320,
    rightSidebarWidth: 420,
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
    ]
  })

  const settings = await getSettings()

  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "dark")
  assert.equal(settings.leftSidebarWidth, 320)
  assert.equal(settings.rightSidebarWidth, 420)
  assert.equal(settings.savedViews.length, 1)
  assert.equal(settings.savedViews[0].name, "AI media")
  assert.equal(settings.savedViews[0].sortOrder, "likes-desc")
  assert.equal(settings.savedViews[0].viewMode, "list")
})

test("getSettings normalizes saved views and drops invalid records", async () => {
  const storage = installChromeStorageMock()
  storage.setStoredValue({
    savedViews: [
      {
        id: "view-valid",
        name: "Valid view",
        createdAt: "2026-05-12T08:00:00.000Z",
        updatedAt: "2026-05-12T08:10:00.000Z",
        query: "agent",
        activeTagIds: ["tag-ai", 42],
        activeAuthorHandles: ["alice", null],
        onlyWithMedia: true,
        onlyLongform: false,
        sortOrder: "created-desc",
        viewMode: "list"
      },
      {
        id: "",
        name: "Missing id",
        createdAt: "2026-05-12T08:00:00.000Z",
        updatedAt: "2026-05-12T08:10:00.000Z",
        query: "",
        activeTagIds: [],
        activeAuthorHandles: [],
        onlyWithMedia: false,
        onlyLongform: false,
        sortOrder: "timeline",
        viewMode: "grid"
      },
      {
        id: "view-invalid-sort",
        name: "Invalid sort",
        createdAt: "2026-05-12T08:00:00.000Z",
        updatedAt: "2026-05-12T08:10:00.000Z",
        query: "",
        activeTagIds: [],
        activeAuthorHandles: [],
        onlyWithMedia: false,
        onlyLongform: false,
        sortOrder: "random",
        viewMode: "grid"
      }
    ]
  })

  const settings = await getSettings()

  assert.equal(settings.savedViews.length, 1)
  assert.deepEqual(settings.savedViews[0], {
    id: "view-valid",
    name: "Valid view",
    createdAt: "2026-05-12T08:00:00.000Z",
    updatedAt: "2026-05-12T08:10:00.000Z",
    query: "agent",
    activeTagIds: ["tag-ai", "42"],
    activeAuthorHandles: ["alice", "null"],
    onlyWithMedia: true,
    onlyLongform: false,
    sortOrder: "created-desc",
    viewMode: "list"
  })
})

test("getSettings silently drops legacy classificationRules from stored settings", async () => {
  const storage = installChromeStorageMock()
  storage.setStoredValue({
    schemaVersion: 4,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [
      {
        id: "rule-1",
        name: "AI",
        enabled: true,
        authorHandles: [],
        keywords: ["agent"],
        requireMedia: false,
        requireLongform: false,
        targetTagIds: ["tag-ai"]
      }
    ],
    savedViews: []
  })

  const settings = await getSettings()

  assert.equal(settings.schemaVersion, 6)
  assert.equal("classificationRules" in settings, false)

  await saveSettings(settings)
  const persisted = storage.getStoredValue() as Record<string, unknown>
  assert.equal("classificationRules" in persisted, false)
})

test("getSettings applies autoTag defaults and normalizes invalid values", async () => {
  const storage = installChromeStorageMock()
  storage.setStoredValue({
    schemaVersion: 5,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    savedViews: []
  })

  const settings = await getSettings()

  assert.equal(settings.schemaVersion, 6)
  assert.equal(settings.autoTag.enabled, false)
  assert.equal(settings.autoTag.runAfterSync, true)
  assert.equal(settings.autoTag.heuristics.useHashtags, true)
  assert.equal(settings.autoTag.heuristics.useAuthors, true)
  assert.deepEqual(settings.autoTag.heuristics.keywordRules, [])
  assert.equal(settings.autoTag.llm.enabled, false)
  assert.equal(settings.autoTag.llm.provider, "openai-compatible")
  assert.equal(settings.autoTag.llm.baseUrl, "https://api.openai.com/v1")
  assert.equal(settings.autoTag.llm.tagVocabularyMode, "closed")
  assert.equal(settings.hashtagBackfillDone, false)

  storage.setStoredValue({
    schemaVersion: 6,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    savedViews: [],
    hashtagBackfillDone: true,
    autoTag: {
      enabled: true,
      heuristics: {
        keywordRules: [
          { keyword: " rust ", tagName: " Rust " },
          { keyword: "", tagName: "Empty" },
          { keyword: "orphan", tagName: "" }
        ]
      },
      llm: {
        enabled: true,
        baseUrl: "  https://proxy.example.com/v1  ",
        model: "  ",
        batchSize: 999,
        maxBookmarksPerRun: 0,
        tagVocabularyMode: "open"
      }
    }
  })

  const customized = await getSettings()

  assert.equal(customized.autoTag.enabled, true)
  assert.equal(customized.hashtagBackfillDone, true)
  assert.deepEqual(customized.autoTag.heuristics.keywordRules, [{ keyword: "rust", tagName: "Rust" }])
  assert.equal(customized.autoTag.llm.baseUrl, "https://proxy.example.com/v1")
  assert.equal(customized.autoTag.llm.model, "gpt-4o-mini")
  assert.equal(customized.autoTag.llm.batchSize, 50)
  assert.equal(customized.autoTag.llm.maxBookmarksPerRun, 200)
  assert.equal(customized.autoTag.llm.tagVocabularyMode, "open")
})
