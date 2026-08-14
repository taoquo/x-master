import test from "node:test"
import assert from "node:assert/strict"
import { runSyncAndWait, waitForSyncCompletion } from "../../src/lib/runtime/syncStatus.ts"
import { createDefaultSettings } from "../../src/lib/storage/settings.ts"
import type { ExtensionSettings, SyncSummary } from "../../src/lib/types.ts"

function settingsWithSummary(summary: Partial<SyncSummary>): ExtensionSettings {
  const settings = createDefaultSettings()

  return {
    ...settings,
    lastSyncSummary: {
      ...settings.lastSyncSummary,
      ...summary
    }
  }
}

test("waitForSyncCompletion polls until the summary leaves running", async () => {
  const summaries: SyncSummary[] = [
    settingsWithSummary({ status: "running" }).lastSyncSummary,
    settingsWithSummary({ status: "running" }).lastSyncSummary,
    settingsWithSummary({ status: "success", fetchedCount: 12, lastSyncedAt: "2026-08-14T00:00:00.000Z" }).lastSyncSummary
  ]
  let readCount = 0

  const summary = await waitForSyncCompletion({
    readSettings: async () => {
      const index = Math.min(readCount, summaries.length - 1)
      readCount += 1
      return settingsWithSummary(summaries[index])
    },
    intervalMs: 1
  })

  assert.equal(summary.status, "success")
  assert.equal(summary.fetchedCount, 12)
  assert.ok(readCount >= 3)
})

test("waitForSyncCompletion waits for the summary to change from the pre-sync snapshot", async () => {
  const previousSummary = settingsWithSummary({
    status: "success",
    lastSyncedAt: "2026-08-14T00:00:00.000Z"
  }).lastSyncSummary
  let readCount = 0

  const summary = await waitForSyncCompletion({
    previousSummary,
    readSettings: async () => {
      readCount += 1
      if (readCount < 3) {
        return settingsWithSummary(previousSummary)
      }

      return settingsWithSummary({
        status: "success",
        lastSyncedAt: "2026-08-14T01:00:00.000Z"
      })
    },
    intervalMs: 1
  })

  assert.equal(summary.lastSyncedAt, "2026-08-14T01:00:00.000Z")
  assert.equal(readCount, 3)
})

test("waitForSyncCompletion returns the running summary once the timeout elapses", async () => {
  const summary = await waitForSyncCompletion({
    readSettings: async () => settingsWithSummary({ status: "running" }),
    intervalMs: 1,
    timeoutMs: 5
  })

  assert.equal(summary.status, "running")
})

test("runSyncAndWait skips polling when the sync did not start", async () => {
  let readCount = 0

  const summary = await runSyncAndWait({
    startSync: async () => ({ started: false }),
    readSettings: async () => {
      readCount += 1
      return settingsWithSummary({ status: "idle" })
    }
  })

  assert.equal(summary.status, "idle")
  assert.equal(readCount, 1)
})

test("runSyncAndWait polls to completion after the sync starts", async () => {
  let readCount = 0

  const summary = await runSyncAndWait({
    startSync: async () => ({ started: true }),
    readSettings: async () => {
      readCount += 1
      if (readCount < 4) {
        return settingsWithSummary({ status: "running" })
      }

      return settingsWithSummary({ status: "error", errorSummary: "boom", lastSyncedAt: "2026-08-14T02:00:00.000Z" })
    },
    intervalMs: 1
  })

  assert.equal(summary.status, "error")
  assert.equal(summary.errorSummary, "boom")
})
