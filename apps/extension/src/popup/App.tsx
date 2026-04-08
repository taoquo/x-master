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
      workspaceSnapshot: "工作区入口",
      workspaceDescription: "同步状态与本地库存。",
      appDescription: "查看当前书签库存，触发同步，然后进入完整工作台。",
      inventory: "本地库存",
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
    workspaceSnapshot: "Workspace entry",
    workspaceDescription: "Sync status and local inventory.",
    appDescription: "Check the current bookmark inventory, run sync, then jump into the full workspace.",
    inventory: "Local inventory",
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
    <main data-testid="popup-shell" className="popup-shell min-h-[100dvh] w-[366px] max-w-full space-y-4 p-4">
      <SurfaceCard
        title={copy.workspaceSnapshot}
        description={copy.workspaceDescription}
        className="rounded-[24px]"
        bodyClassName="gap-5"
      >
          <div data-testid="popup-overview-panel" className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="workspace-overline">{copy.inventory}</div>
                <h1 className="mt-2 font-sans text-[2.35rem] leading-[0.92] tracking-[-0.06em] text-ink">
                  X Bookmark Manager
                </h1>
                <p className="mt-3 max-w-[24ch] text-sm leading-6 text-slate-600">
                  {copy.appDescription}
                </p>
              </div>
              <StatusBadge status={data.summary.status} label={copy.status[data.summary.status]} />
            </div>

            <div data-testid="popup-stats-grid" className="grid grid-cols-2 gap-3">
              <div className="panel-elevated rounded-[18px] p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{copy.totalBookmarks}</div>
                <div className="mt-3 font-mono text-[2.4rem] leading-none tracking-[-0.04em] text-slate-900">
                  {data.stats.totalBookmarks}
                </div>
              </div>
              <div className="panel-elevated rounded-[18px] p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{copy.unclassified}</div>
                <div className="mt-3 font-mono text-[2.4rem] leading-none tracking-[-0.04em] text-slate-900">
                  {data.stats.unclassifiedCount}
                </div>
              </div>
            </div>

            <div data-testid="popup-actions-panel" className="flex gap-2">
              <button type="button" onClick={openManager} className="glass-button flex-1 justify-center">
                <AppIcon name="external" size={16} />
                <span>{copy.openManager}</span>
              </button>
            </div>
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
