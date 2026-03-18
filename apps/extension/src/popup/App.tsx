import React, { useEffect, useState } from "react"
import type { PopupData } from "../lib/types.ts"
import { createEmptySyncSummary } from "../lib/types.ts"
import { loadPopupData, runSync } from "../lib/runtime/popupClient.ts"

function openWorkspace() {
  if (typeof chrome === "undefined" || !chrome.sidePanel?.open) {
    return
  }

  void chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
}

export default function App() {
  const [data, setData] = useState<PopupData>({
    bookmarks: [],
    folders: [],
    bookmarkFolders: [],
    tags: [],
    bookmarkTags: [],
    summary: createEmptySyncSummary(),
    latestSyncRun: null
  })
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    void refreshPopupData()
  }, [])

  async function refreshPopupData() {
    const nextData = await loadPopupData()
    setData(nextData)
  }

  async function handleSync() {
    setIsSyncing(true)

    try {
      await runSync()
    } catch {
      // The background sync persists the failed summary, refresh after the request settles.
    } finally {
      await refreshPopupData()
      setIsSyncing(false)
    }
  }

  return (
    <main
      style={{
        width: 360,
        maxWidth: "100%",
        display: "grid",
        gap: 14,
        padding: 16,
        boxSizing: "border-box",
        background: "linear-gradient(180deg, #f7fbff 0%, #eef4f8 100%)",
        color: "#102a43"
      }}>
      <section
        style={{
          display: "grid",
          gap: 8,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>X Bookmark Manager</h1>
        <p style={{ margin: 0, color: "#52606d" }}>Quick sync and jump into the full workspace.</p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 8,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Sync</h2>
        <p style={{ margin: 0 }}>Status: {data.summary.status}</p>
        <p style={{ margin: 0 }}>Fetched: {data.summary.fetchedCount}</p>
        <p style={{ margin: 0 }}>Inserted: {data.summary.insertedCount}</p>
        <p style={{ margin: 0 }}>Updated: {data.summary.updatedCount}</p>
        <p style={{ margin: 0 }}>Failed: {data.summary.failedCount}</p>
        {data.summary.lastSyncedAt ? <p style={{ margin: 0 }}>Last synced: {data.summary.lastSyncedAt}</p> : null}
        {data.summary.errorSummary ? <p style={{ margin: 0 }}>Error: {data.summary.errorSummary}</p> : null}
        <button type="button" onClick={() => void handleSync()} disabled={isSyncing}>
          {isSyncing ? "Syncing..." : "Sync now"}
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gap: 8,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Overview</h2>
        <p style={{ margin: 0 }}>Bookmarks: {data.bookmarks.length}</p>
        <p style={{ margin: 0 }}>Tags: {data.tags.length}</p>
        <p style={{ margin: 0 }}>Latest sync status: {data.latestSyncRun?.status ?? "idle"}</p>
        {data.latestSyncRun?.finishedAt ? <p style={{ margin: 0 }}>Latest sync finished: {data.latestSyncRun.finishedAt}</p> : null}
      </section>

      <button type="button" onClick={openWorkspace}>
        Open workspace
      </button>
    </main>
  )
}
