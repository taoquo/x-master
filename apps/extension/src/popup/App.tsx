import React, { useEffect, useState } from "react"
import { loadWorkspaceData, runSync } from "../lib/runtime/popupClient.ts"
import type { Locale, WorkspaceData } from "../lib/types.ts"
import { createEmptySyncSummary } from "../lib/types.ts"
import { createEmptyWorkspaceStats } from "../lib/workspace/stats.ts"
import { ExtensionUiProvider, useExtensionUi } from "../ui/provider.tsx"
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

function getPopupAppCopy(locale: Locale) {
  if (locale === "zh-CN") {
    return {
      workspaceSnapshot: "工作区快照",
      workspaceDescription: "快速查看还有哪些内容等待整理。",
      appDescription: "更轻量的桌面胶囊，用于搜索、归档和手动同步。",
      totalBookmarks: "总书签数",
      unclassified: "未分类",
      openManager: "打开管理器",
      status: {
        idle: "空闲",
        running: "进行中",
        success: "成功",
        partial_success: "部分成功",
        error: "错误"
      }
    }
  }

  return {
    workspaceSnapshot: "Workspace snapshot",
    workspaceDescription: "A compact read on what still needs filing.",
    appDescription: "A lighter desktop capsule for search, filing, and manual sync.",
    totalBookmarks: "Total bookmarks",
    unclassified: "Unclassified",
    openManager: "Open manager",
    status: {
      idle: "idle",
      running: "running",
      success: "success",
      partial_success: "partial success",
      error: "error"
    }
  }
}

function PopupScreen() {
  const { locale } = useExtensionUi()
  const copy = getPopupAppCopy(locale)
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
    <main className="popup-shell min-h-[100dvh] w-[366px] max-w-full space-y-4 p-4">
      <SurfaceCard title={copy.workspaceSnapshot} description={copy.workspaceDescription} className="bg-white/42">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-[3rem] leading-[0.9] tracking-[-0.06em] text-ink">
                  X Bookmark Manager
                </h1>
                <p className="mt-3 max-w-[22ch] text-base leading-7 text-slate-800/82">
                  {copy.appDescription}
                </p>
              </div>
              <StatusBadge status={data.summary.status} label={copy.status[data.summary.status]} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel rounded-[1.7rem] p-4">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-700/72">{copy.totalBookmarks}</div>
                <div className="mt-3 font-sans text-[2.8rem] leading-none tracking-[-0.08em] text-slate-700">
                  {data.stats.totalBookmarks}
                </div>
              </div>
              <div className="glass-panel rounded-[1.7rem] p-4">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-700/72">{copy.unclassified}</div>
                <div className="mt-3 font-sans text-[2.8rem] leading-none tracking-[-0.08em] text-slate-700">
                  {data.stats.unclassifiedCount}
                </div>
              </div>
            </div>

            <button type="button" onClick={openManager} className="glass-button w-full justify-center">
              <AppIcon name="external" size={16} />
              <span>{copy.openManager}</span>
            </button>
          </div>
      </SurfaceCard>

      <SyncPanel summary={data.summary} isSyncing={isSyncing} onSync={handleSync} />
    </main>
  )
}

export default function App() {
  return (
    <ExtensionUiProvider>
      <PopupScreen />
    </ExtensionUiProvider>
  )
}
