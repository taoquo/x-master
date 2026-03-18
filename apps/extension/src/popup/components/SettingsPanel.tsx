import React from "react"
import type { BookmarkRecord, SyncRunRecord, TagRecord } from "../../lib/types.ts"

interface SettingsPanelProps {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  latestSyncRun: SyncRunRecord | null
  onExport: () => string | Promise<string>
  onReset: () => Promise<void> | void
  isResetting: boolean
  compact?: boolean
}

export function SettingsPanel({
  bookmarks,
  tags,
  latestSyncRun,
  onExport,
  onReset,
  isResetting,
  compact = false
}: SettingsPanelProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: 8,
        padding: compact ? 12 : 16,
        border: "1px solid #dde7f0",
        borderRadius: 12,
        background: "#f8fbff"
      }}>
      <h2 style={{ margin: 0, fontSize: compact ? 16 : 20 }}>Workspace</h2>
      <p>Bookmarks stored: {bookmarks.length}</p>
      <p>Tags stored: {tags.length}</p>
      <p>Latest sync status: {latestSyncRun?.status ?? "idle"}</p>
      {latestSyncRun?.startedAt ? <p>Latest sync started: {latestSyncRun.startedAt}</p> : null}
      {latestSyncRun?.finishedAt ? <p>Latest sync finished: {latestSyncRun.finishedAt}</p> : null}
      {latestSyncRun?.errorSummary ? <p>Latest sync error: {latestSyncRun.errorSummary}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void onExport()}>
          Export bookmarks
        </button>
        <button type="button" onClick={() => void onReset()} disabled={isResetting}>
          {isResetting ? "Resetting..." : "Reset local data"}
        </button>
      </div>
    </section>
  )
}
