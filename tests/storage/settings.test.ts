import test from "node:test"
import assert from "node:assert/strict"
import {
  AUTO_TAG_RUN_STALE_MS,
  beginAutoTagRunState,
  finishAutoTagRun,
  getSettings,
  isAutoTagRunActive,
  saveSettings,
  touchAutoTagRunState,
  updateSettings
} from "../../src/lib/storage/settings.ts"
import { createEmptySyncSummary } from "../../src/lib/types.ts"

function installChromeStorageMock(options: { writeDelayMs?: number } = {}) {
  let storedValue: unknown

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async (value: Record<string, unknown>) => {
          if (options.writeDelayMs) {
            await new Promise((resolve) => setTimeout(resolve, options.writeDelayMs))
          }
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
  assert.equal(settings.autoTag.llm.tagVocabularyMode, "guarded")
  assert.deepEqual(settings.autoTag.blockedTagKeys, [])
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

test("updateSettings merges a patch without resetting unrelated fields", async () => {
  installChromeStorageMock()

  await updateSettings({
    autoTag: {
      enabled: true,
      runAfterSync: true,
      heuristics: { useHashtags: true, useAuthors: true, keywordRules: [] },
      blockedTagKeys: [],
      llm: {
        enabled: true,
        provider: "openai-compatible",
        baseUrl: "https://api.appintheloop.com/v1",
        model: "claude-sonnet-5",
        batchSize: 10,
        maxBookmarksPerRun: 200,
        tagVocabularyMode: "open"
      }
    }
  })

  await updateSettings({ locale: "zh-CN" })
  await updateSettings({ themePreference: "dark" })

  const settings = await getSettings()

  assert.equal(settings.locale, "zh-CN")
  assert.equal(settings.themePreference, "dark")
  assert.equal(settings.autoTag.llm.baseUrl, "https://api.appintheloop.com/v1")
  assert.equal(settings.autoTag.llm.model, "claude-sonnet-5")
  assert.equal(settings.autoTag.llm.enabled, true)
})

// Regression: two concurrent read-modify-write calls used to read the same
// snapshot, so the slower write reverted the faster one and a setting the panel
// had already shown as saved silently went back to its previous value.
test("concurrent updateSettings calls do not clobber each other", async () => {
  const mock = installChromeStorageMock({ writeDelayMs: 5 })
  mock.setStoredValue(undefined)

  await Promise.all([
    updateSettings({ locale: "zh-CN" }),
    updateSettings({ themePreference: "dark" }),
    updateSettings({ hashtagBackfillDone: true })
  ])

  const settings = await getSettings()

  assert.equal(settings.locale, "zh-CN")
  assert.equal(settings.themePreference, "dark")
  assert.equal(settings.hashtagBackfillDone, true)
})

test("updateSettings accepts a function patch that sees the latest snapshot", async () => {
  const mock = installChromeStorageMock({ writeDelayMs: 5 })
  mock.setStoredValue(undefined)

  await Promise.all([
    updateSettings((current) => ({
      autoTag: { ...current.autoTag, blockedTagKeys: [...current.autoTag.blockedTagKeys, "one"] }
    })),
    updateSettings((current) => ({
      autoTag: { ...current.autoTag, blockedTagKeys: [...current.autoTag.blockedTagKeys, "two"] }
    }))
  ])

  const settings = await getSettings()

  assert.deepEqual(settings.autoTag.blockedTagKeys.sort(), ["one", "two"])
})

test("a nested function patch does not revert a sibling changed meanwhile", async () => {
  const mock = installChromeStorageMock({ writeDelayMs: 5 })
  mock.setStoredValue({
    schemaVersion: 6,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary()
  })

  // The panel used to build its patch from a React snapshot: it spread the
  // autoTag object it had loaded, so anything written between that load and this
  // write was reverted. Two interleaved snapshot writes demonstrate the loss.
  const snapshot = await getSettings()
  await updateSettings((current) => ({
    autoTag: { ...current.autoTag, heuristics: { ...current.autoTag.heuristics, useHashtags: false } }
  }))
  await updateSettings((current) => ({
    autoTag: { ...current.autoTag, llm: { ...current.autoTag.llm, enabled: true } }
  }))

  const settings = await getSettings()

  assert.equal(settings.autoTag.heuristics.useHashtags, false)
  assert.equal(settings.autoTag.llm.enabled, true)
  // The snapshot the panel read at mount is deliberately not what the patch is
  // built from any more, so this assertion pins that the stale copy is unused.
  assert.equal(snapshot.autoTag.llm.enabled, false)
})

test("isAutoTagRunActive distinguishes a live run from a finished or dead one", () => {
  const now = Date.parse("2026-08-21T00:10:00.000Z")
  const state = (updatedAt: string) => ({
    runId: "run-1",
    startedAt: updatedAt,
    updatedAt,
    phase: "llm" as const,
    processed: 1,
    total: 2
  })

  // Absent means finished: finishRun clears the state, so this is the terminal
  // signal the popup folds into the progress stream.
  assert.equal(isAutoTagRunActive(undefined, now), false)
  // A heartbeat inside the window means a run is genuinely in flight.
  assert.equal(isAutoTagRunActive(state(new Date(now - 1_000).toISOString()), now), true)
  // A frozen heartbeat means the worker died holding the run.
  assert.equal(
    isAutoTagRunActive(state(new Date(now - AUTO_TAG_RUN_STALE_MS - 1).toISOString()), now),
    false
  )
  assert.equal(isAutoTagRunActive(state("not-a-date"), now), false)
})

test("finishAutoTagRun refuses to touch a state owned by another run", async () => {
  const mock = installChromeStorageMock()
  mock.setStoredValue(undefined)

  const started = await beginAutoTagRunState({ phase: "llm", total: 10 })
  assert.ok(started?.runId)

  // A takeover installs a different runId over the same state.
  const winner = await beginAutoTagRunState({ phase: "llm", total: 10 })
  assert.ok(winner?.runId)
  assert.notEqual(winner?.runId, started?.runId)

  // The superseded run now finishes. It must not clear the winner's state, which
  // would make the live run look finished and leave it uncancellable, and it must
  // not publish its own discarded result as the latest one.
  const superseded = await finishAutoTagRun({
    runId: started?.runId,
    summary: {
      finishedAt: new Date().toISOString(),
      outcome: "cancelled",
      suggestedCount: 1,
      pendingCount: 1,
      candidateCount: 1,
      llmProcessedCount: 1,
      llmBatchCount: 1,
      llmFailedBatchCount: 0,
      newTagBudget: 0,
      vocabularySize: 0,
      blockedTagKeyCount: 0,
      blockedDroppedCount: 0,
      budgetDroppedCount: 0,
      unprocessedCount: 0
    }
  })

  assert.equal(superseded.reported, false)

  const settings = await getSettings()
  assert.equal(settings.autoTagRunState?.runId, winner?.runId)
  assert.equal(settings.lastAutoTagRun, undefined)
})

test("finishAutoTagRun reports and clears the state it owns", async () => {
  const mock = installChromeStorageMock()
  mock.setStoredValue(undefined)

  const started = await beginAutoTagRunState({ phase: "heuristics", total: 4 })
  assert.ok(started?.runId)

  const finished = await finishAutoTagRun({
    runId: started?.runId,
    summary: {
      finishedAt: "2026-08-21T00:00:00.000Z",
      outcome: "ok",
      suggestedCount: 2,
      pendingCount: 2,
      candidateCount: 4,
      llmProcessedCount: 0,
      llmBatchCount: 0,
      llmFailedBatchCount: 0,
      newTagBudget: 0,
      vocabularySize: 1,
      blockedTagKeyCount: 0,
      blockedDroppedCount: 0,
      budgetDroppedCount: 0,
      unprocessedCount: 0
    }
  })

  assert.equal(finished.reported, true)

  const settings = await getSettings()
  assert.equal(settings.autoTagRunState, undefined)
  assert.equal(settings.lastAutoTagRun?.outcome, "ok")
})

test("touchAutoTagRunState tells a superseded run it lost the state", async () => {
  const mock = installChromeStorageMock()
  mock.setStoredValue(undefined)

  const started = await beginAutoTagRunState({ phase: "llm", total: 8 })
  assert.ok(started?.runId)

  const own = await touchAutoTagRunState({
    runId: started?.runId,
    phase: "llm",
    processed: 2,
    total: 8
  })
  assert.equal(own.ownsState, true)
  assert.equal(own.state?.processed, 2)

  // A takeover replaces the state; the previous owner must be told to stop
  // rather than keep refreshing (and reading the cancel flag of) someone else's
  // state.
  const winner = await beginAutoTagRunState({ phase: "llm", total: 8 })
  const lost = await touchAutoTagRunState({
    runId: started?.runId,
    phase: "llm",
    processed: 3,
    total: 8
  })

  assert.equal(lost.ownsState, false)
  assert.equal(lost.state?.runId, winner?.runId)
  assert.equal(lost.state?.processed, 0)
})
