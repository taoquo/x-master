import test from "node:test"
import assert from "node:assert/strict"
import {
  AUTO_TAG_CONTINUE_MAX_RUNS,
  registerAutoTagRunStarter,
  reportInterruptedAutoTagRun
} from "../../src/background/index.ts"
import { getSettings, saveSettings, updateSettings } from "../../src/lib/storage/settings.ts"
import { createEmptySyncSummary } from "../../src/lib/types.ts"
import type { AutoTagRunState } from "../../src/lib/types.ts"

function installStorage() {
  let stored: Record<string, unknown> = {}
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async (key?: string) => (typeof key === "string" ? { [key]: stored[key] } : { ...stored }),
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
        },
        setAccessLevel: async () => {}
      }
    }
  }
}

async function seedRun(overrides: { autoContinue?: boolean; cancelled?: boolean } = {}) {
  const now = new Date().toISOString()
  const state: AutoTagRunState = {
    runId: "run-1",
    startedAt: now,
    updatedAt: now,
    phase: "llm",
    processed: 4,
    total: 9,
    ...(overrides.cancelled ? { cancelRequested: true } : {})
  }

  await saveSettings({
    schemaVersion: 7,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    savedViews: [],
    autoTagRunState: state,
    autoTag: {
      enabled: true,
      runAfterSync: true,
      autoContinue: overrides.autoContinue ?? true,
      heuristics: { useHashtags: true, useAuthors: true, keywordRules: [] },
      blockedTagKeys: [],
      llm: {
        enabled: true,
        activeProviderId: "openai",
        baseUrl: "https://api.openai.com/v1",
        model: "m",
        batchSize: 25,
        maxBookmarksPerRun: 200,
        tagVocabularyMode: "guarded"
      }
    }
  } as never)
}

// A worker killed before finishRun used to leave no trace: the state was cleared, the
// panel kept showing the previous result, and the user saw progress vanish with no
// explanation. The run state exists precisely so that this is reportable.
test("a run whose worker died is reported as interrupted and continued", async () => {
  installStorage()
  await seedRun()

  let starts = 0
  registerAutoTagRunStarter(async () => {
    starts += 1
    return { started: true }
  })

  const result = await reportInterruptedAutoTagRun("startup")

  assert.equal(result.reported, true)
  assert.equal(result.continued, true)

  const settings = await getSettings()
  assert.equal(settings.lastAutoTagRun?.outcome, "interrupted")
  assert.equal(settings.lastAutoTagRun?.unprocessedCount, 5, "the leftover queue is reported")
  assert.equal(settings.autoTagRunState, undefined, "the dead run's state must not linger")
  assert.equal(starts, 1)
  assert.equal(settings.autoTagContinueCount, 1, "the continuation chain is counted")
})

test("a run the user cancelled is reported but never continued", async () => {
  installStorage()
  await seedRun({ cancelled: true })

  let starts = 0
  registerAutoTagRunStarter(async () => {
    starts += 1
    return { started: true }
  })

  const result = await reportInterruptedAutoTagRun("startup")

  assert.equal(result.reported, true)
  assert.equal(result.continued, false)
  assert.equal(starts, 0, "an explicit stop must not be overridden by auto-continue")
  assert.equal((await getSettings()).lastAutoTagRun?.outcome, "cancelled")
})

test("auto-continue honours the setting", async () => {
  installStorage()
  await seedRun({ autoContinue: false })

  let starts = 0
  registerAutoTagRunStarter(async () => {
    starts += 1
    return { started: true }
  })

  const result = await reportInterruptedAutoTagRun("startup")

  assert.equal(result.reported, true)
  assert.equal(result.continued, false)
  assert.equal(starts, 0)
})

// A tick fires while a worker is alive and a run is healthy. It must not be mistaken
// for an interruption, or every keep-alive alarm would end the run it is protecting.
test("a keep-alive tick leaves a healthy run alone", async () => {
  installStorage()
  await seedRun()

  const result = await reportInterruptedAutoTagRun("tick")

  assert.equal(result.reported, false)
  assert.equal((await getSettings()).autoTagRunState?.runId, "run-1", "a live run keeps its state")
})

// A run that keeps dying must not keep asking for another invocation; each
// continuation is a fresh service-worker call, and an unbounded chain is a loop.
test("the continuation chain stops at the cap", async () => {
  installStorage()
  await seedRun()
  await updateSettings({ autoTagContinueCount: AUTO_TAG_CONTINUE_MAX_RUNS })

  let starts = 0
  registerAutoTagRunStarter(async () => {
    starts += 1
    return { started: true }
  })

  const result = await reportInterruptedAutoTagRun("startup")

  assert.equal(result.reported, true)
  assert.equal(result.continued, false, "the cap must be enforced")
  assert.equal(starts, 0)
})
