import React from "react"
import type { SyncSummary } from "../../lib/types.ts"
import { AppIcon } from "../../ui/icons.tsx"
import { StatusBadge, SurfaceCard } from "../../ui/components.tsx"

function formatTimestamp(value?: string) {
  if (!value) {
    return "Not synced yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed)
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
  return (
    <SurfaceCard
      title="Sync"
      description="Manual full sync from X into the local bookmark library."
      className="bg-slate-950/80 text-white">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={summary.status} />
          <span className="text-sm text-white/65">{formatTimestamp(summary.lastSyncedAt)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-white">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50">Fetched</div>
            <div className="mt-1 font-mono text-2xl">{summary.fetchedCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50">Inserted</div>
            <div className="mt-1 font-mono text-2xl">{summary.insertedCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50">Updated</div>
            <div className="mt-1 font-mono text-2xl">{summary.updatedCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50">Failed</div>
            <div className="mt-1 font-mono text-2xl">{summary.failedCount}</div>
          </div>
        </div>

        {summary.errorSummary ? <p className="text-sm leading-6 text-red-200">Error: {summary.errorSummary}</p> : null}

        <button
          type="button"
          onClick={() => void onSync()}
          disabled={isSyncing}
          className="primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
          <AppIcon name="sync" size={16} />
          <span>{isSyncing ? "Syncing..." : "Sync now"}</span>
        </button>
      </div>
    </SurfaceCard>
  )
}
