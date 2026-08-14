import { getSettings } from "../storage/settings.ts"
import type { SyncSummary } from "../types.ts"
import { runSync, type RunSyncResponse } from "./popupClient.ts"

const DEFAULT_INTERVAL_MS = 300
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const FAST_POLL_ATTEMPTS = 3

interface WaitForSyncCompletionOptions {
  previousSummary?: SyncSummary
  readSettings?: typeof getSettings
  intervalMs?: number
  timeoutMs?: number
}

function hasSummaryChanged(summary: SyncSummary, previousSummary: SyncSummary | undefined) {
  if (!previousSummary) {
    return true
  }

  return summary.status !== previousSummary.status || summary.lastSyncedAt !== previousSummary.lastSyncedAt
}

export async function waitForSyncCompletion({
  previousSummary,
  readSettings = getSettings,
  intervalMs = DEFAULT_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: WaitForSyncCompletionOptions = {}): Promise<SyncSummary> {
  const startedAt = Date.now()
  let attempt = 0

  for (;;) {
    const settings = await readSettings()
    const summary = settings.lastSyncSummary

    if (summary.status !== "running" && hasSummaryChanged(summary, previousSummary)) {
      return summary
    }

    if (Date.now() - startedAt >= timeoutMs) {
      return summary
    }

    const delay = attempt < FAST_POLL_ATTEMPTS ? 0 : intervalMs
    attempt += 1
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

export async function runSyncAndWait({
  startSync = runSync,
  readSettings = getSettings,
  intervalMs,
  timeoutMs
}: {
  startSync?: () => Promise<RunSyncResponse>
  readSettings?: typeof getSettings
  intervalMs?: number
  timeoutMs?: number
} = {}): Promise<SyncSummary> {
  const previousSummary = (await readSettings()).lastSyncSummary
  const response = await startSync()

  if (!response.started && !response.alreadyRunning) {
    return previousSummary
  }

  return waitForSyncCompletion({ previousSummary, readSettings, intervalMs, timeoutMs })
}
