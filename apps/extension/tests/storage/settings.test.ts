import test from "node:test"
import assert from "node:assert/strict"
import { getSettings, saveAiGenerationSettings, saveSettings } from "../../src/lib/storage/settings.ts"

test("getSettings returns defaults when chrome.storage.local is empty", async () => {
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

  const settings = await getSettings()

  assert.equal(settings.schemaVersion, 2)
  assert.equal(settings.hasCompletedOnboarding, false)
  assert.equal(settings.lastSyncSummary.status, "idle")
  assert.equal(settings.aiGeneration.enabled, false)
  assert.equal(settings.aiGeneration.model, "gpt-5-mini")
  assert.equal(settings.exportScope, "all")
})

test("saveSettings persists settings and getSettings returns them", async () => {
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

  await saveSettings({
    schemaVersion: 2,
    hasCompletedOnboarding: true,
    aiGeneration: {
      enabled: false,
      provider: "openai",
      apiKey: "",
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

  assert.equal(settings.schemaVersion, 2)
  assert.equal(settings.hasCompletedOnboarding, true)
  assert.equal(settings.lastSyncSummary.status, "success")
  assert.equal(settings.lastSyncSummary.lastSyncedAt, "2026-03-16T00:00:00.000Z")
  assert.equal(settings.exportScope, "all")
})

test("saveAiGenerationSettings persists ai generation config", async () => {
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

  await saveAiGenerationSettings({
    enabled: true,
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-5-mini"
  })

  const settings = await getSettings()

  assert.equal(settings.aiGeneration.enabled, true)
  assert.equal(settings.aiGeneration.apiKey, "sk-test")
  assert.equal(settings.aiGeneration.model, "gpt-5-mini")
})
