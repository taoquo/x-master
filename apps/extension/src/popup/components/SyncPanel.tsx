import React from "react"
import type { SyncSummary } from "../../lib/types.ts"

interface SyncPanelProps {
  summary: SyncSummary
  isSyncing: boolean
  onSync: () => Promise<void> | void
}

export function SyncPanel({ summary, isSyncing, onSync }: SyncPanelProps) {
  return (
    <section>
      <h2>Sync</h2>
      <p>Status: {summary.status}</p>
      <p>Fetched: {summary.fetchedCount}</p>
      <p>Inserted: {summary.insertedCount}</p>
      <p>Updated: {summary.updatedCount}</p>
      <p>Failed: {summary.failedCount}</p>
      {summary.lastSyncedAt ? <p>Last synced: {summary.lastSyncedAt}</p> : null}
      {summary.errorSummary ? <p>Error: {summary.errorSummary}</p> : null}
      <button type="button" onClick={() => void onSync()} disabled={isSyncing}>
        {isSyncing ? "Syncing..." : "Sync now"}
      </button>
    </section>
  )
}
