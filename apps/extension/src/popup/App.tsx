import React, { useEffect, useState } from "react"
import { loadWorkspaceData, runSync } from "../lib/runtime/popupClient.ts"
import type { WorkspaceData } from "../lib/types.ts"
import { createEmptySyncSummary } from "../lib/types.ts"
import { createEmptyWorkspaceStats } from "../lib/workspace/stats.ts"
import { ExtensionUiProvider } from "../ui/provider.tsx"
import { AppIcon } from "../ui/icons.tsx"
import { StatusBadge, SurfaceCard } from "../ui/components.tsx"
import { SyncPanel } from "./components/SyncPanel.tsx"

function createEmptyWorkspaceData(): WorkspaceData {
  return {
    bookmarks: [],
    lists: [],
    bookmarkLists: [],
    tags: [],
    bookmarkTags: [],
    classificationRules: [],
    summary: createEmptySyncSummary(),
    latestSyncRun: null,
    stats: createEmptyWorkspaceStats()
  }
}

function openManager() {
  if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
    void chrome.runtime.openOptionsPage()
  }
}

export default function App() {
  const [data, setData] = useState<WorkspaceData>(createEmptyWorkspaceData())
  const [isSyncing, setIsSyncing] = useState(false)

  async function refreshData() {
    const nextData = await loadWorkspaceData()
    setData(nextData)
  }

  useEffect(() => {
    void refreshData()
  }, [])

  async function handleSync() {
    setIsSyncing(true)

    try {
      await runSync()
    } finally {
      await refreshData()
      setIsSyncing(false)
    }
  }

  return (
    <ExtensionUiProvider>
      <main className="min-h-[100dvh] w-[366px] max-w-full space-y-4 bg-[radial-gradient(circle_at_top_left,rgba(233,213,162,0.34),transparent_25%),radial-gradient(circle_at_top_right,rgba(172,230,226,0.34),transparent_25%),linear-gradient(180deg,#f7f2e9_0%,#eaf0ec_58%,#f7f2e9_100%)] p-4">
        <SurfaceCard title="Workspace snapshot" description="A compact read on what still needs filing." className="bg-white/42">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-[3rem] leading-[0.9] tracking-[-0.06em] text-ink">
                  X Bookmark Manager
                </h1>
                <p className="mt-3 max-w-[22ch] text-base leading-7 text-slate-800/82">
                  A lighter desktop capsule for search, filing, and manual sync.
                </p>
              </div>
              <StatusBadge status={data.summary.status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded-[1.7rem] p-4">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-700/72">Total bookmarks</div>
                <div className="mt-3 font-sans text-[2.8rem] leading-none tracking-[-0.08em] text-slate-700">
                  {data.stats.totalBookmarks}
                </div>
              </div>
              <div className="glass-panel rounded-[1.7rem] p-4">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-700/72">Unclassified</div>
                <div className="mt-3 font-sans text-[2.8rem] leading-none tracking-[-0.08em] text-slate-700">
                  {data.stats.unclassifiedCount}
                </div>
              </div>
            </div>

            <button type="button" onClick={openManager} className="glass-button w-full justify-center">
              <AppIcon name="external" size={16} />
              <span>Open manager</span>
            </button>
          </div>
        </SurfaceCard>

        <SyncPanel summary={data.summary} isSyncing={isSyncing} onSync={handleSync} />
      </main>
    </ExtensionUiProvider>
  )
}
