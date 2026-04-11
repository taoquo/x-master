import test from "node:test"
import assert from "node:assert/strict"
import {
  getSettings,
  removeTagFromClassificationRules,
  saveClassificationRules,
  saveSettings
} from "../../src/lib/storage/settings.ts"
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

  assert.equal(settings.schemaVersion, 3)
  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "system")
  assert.equal(settings.lastSyncSummary.status, "idle")
  assert.deepEqual(settings.classificationRules, [])
})

test("saveClassificationRules persists deterministic rule settings", async () => {
  installChromeStorageMock()

  await saveClassificationRules([
    {
      id: "rule-1",
      name: "AI",
      enabled: true,
      authorHandles: ["alice"],
      keywords: ["agent"],
      requireMedia: false,
      requireLongform: true,
      targetTagIds: ["tag-ai"]
    }
  ])

  const settings = await getSettings()

  assert.equal(settings.classificationRules.length, 1)
  assert.equal(settings.classificationRules[0].name, "AI")
  assert.equal(settings.classificationRules[0].requireLongform, true)
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

  assert.equal(settings.schemaVersion, 3)
  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "system")
  assert.equal(settings.lastSyncSummary.status, "success")
  assert.equal(settings.lastSyncSummary.lastSyncedAt, "2026-03-16T00:00:00.000Z")
  assert.deepEqual(settings.classificationRules, [])
})

test("saveSettings persists locale and theme preferences", async () => {
  installChromeStorageMock()

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const settings = await getSettings()

  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "dark")
})

test("removeTagFromClassificationRules strips deleted tag ids from every rule", async () => {
  installChromeStorageMock()

  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: [
      {
        id: "rule-1",
        name: "AI",
        enabled: true,
        authorHandles: [],
        keywords: ["agent"],
        requireMedia: false,
        requireLongform: false,
        targetTagIds: ["tag-ai", "tag-keep"]
      }
    ]
  })

  await removeTagFromClassificationRules("tag-ai")
  const settings = await getSettings()

  assert.deepEqual(settings.classificationRules[0].targetTagIds, ["tag-keep"])
})
