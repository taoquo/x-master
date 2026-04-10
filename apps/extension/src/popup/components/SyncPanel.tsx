import React from "react"
import type { Locale, SyncSummary } from "../../lib/types.ts"
import { AppIcon } from "../../ui/icons.tsx"
import { StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { useExtensionUi } from "../../ui/provider.tsx"

function formatTimestamp(value: string | undefined, locale: Locale) {
  if (!value) {
    return locale === "zh-CN" ? "尚未同步" : "Not synced yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed)
}

function getPopupCopy(locale: Locale) {
  if (locale === "zh-CN") {
    return {
      sync: "同步运行",
      syncDescription: "从 X 拉取书签并写入本地工作区。",
      lastSync: "最近同步",
      fetched: "抓取",
      inserted: "新增",
      updated: "更新",
      failed: "失败",
      syncing: "同步中...",
      syncNow: "立即同步",
      error: "错误",
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
    sync: "Sync run",
    syncDescription: "Pull bookmarks from X and write them into the local workspace.",
    lastSync: "Last sync",
    fetched: "Fetched",
    inserted: "Inserted",
    updated: "Updated",
    failed: "Failed",
    syncing: "Syncing...",
    syncNow: "Sync now",
    error: "Error",
    status: {
      idle: "idle",
      running: "running",
      success: "success",
      partial_success: "partial success",
      error: "error"
    }
  }
}

export function SyncPanel({
  summary,
  isSyncing,
  onSync
}: {
  summary: SyncSummary
  isSyncing: boolean
  onSync: () => Promise<void>
}) {
  const { locale } = useExtensionUi()
  const copy = getPopupCopy(locale)
  const statusLabel = copy.status[summary.status]

  return (
    <SurfaceCard
      title={copy.sync}
      description={copy.syncDescription}
      className="rounded-[24px] bg-slate-950/80 text-white"
      bodyClassName="space-y-5"
    >
      <div data-testid="popup-sync-panel" className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={summary.status} label={statusLabel} />
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">{copy.lastSync}</div>
            <span className="mt-1 block text-sm text-white/70">{formatTimestamp(summary.lastSyncedAt, locale)}</span>
          </div>
        </div>

        <div data-testid="popup-sync-stats" className="grid grid-cols-2 gap-3 text-white">
          <div className="panel-elevated rounded-[16px] p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">{copy.fetched}</div>
            <div className="mt-1 font-mono text-2xl">{summary.fetchedCount}</div>
          </div>
          <div className="panel-elevated rounded-[16px] p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">{copy.inserted}</div>
            <div className="mt-1 font-mono text-2xl">{summary.insertedCount}</div>
          </div>
          <div className="panel-elevated rounded-[16px] p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">{copy.updated}</div>
            <div className="mt-1 font-mono text-2xl">{summary.updatedCount}</div>
          </div>
          <div className="panel-elevated rounded-[16px] p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/42">{copy.failed}</div>
            <div className="mt-1 font-mono text-2xl">{summary.failedCount}</div>
          </div>
        </div>

        {summary.errorSummary ? <p className="text-sm leading-6 text-red-200">{copy.error}: {summary.errorSummary}</p> : null}

        <button
          type="button"
          onClick={() => void onSync()}
          disabled={isSyncing}
          className="primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
          <AppIcon name="sync" size={16} />
          <span>{isSyncing ? copy.syncing : copy.syncNow}</span>
        </button>
      </div>
    </SurfaceCard>
  )
}
