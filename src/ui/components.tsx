import React from "react"
import { getStatusClasses } from "./theme.ts"

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}


export function SurfaceCard({
  title,
  description,
  children,
  className,
  bodyClassName,
  chrome = "default"
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  chrome?: "default" | "bare"
}) {
  const shellClassName =
    chrome === "bare"
      ? "workspace-surface folio-surface-card flex flex-col"
      : "workspace-surface folio-surface-card panel-surface flex flex-col rounded-[22px] p-5 md:p-6"

  return (
    <section className={cn(shellClassName, className)}>
      {title ? (
        <div className="folio-surface-card-header mb-4 space-y-2">
          <h2 className="workspace-heading-lg">{title}</h2>
          {description ? <p className="workspace-copy">{description}</p> : null}
        </div>
      ) : null}
      <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </section>
  )
}



function formatStatusLabel(status?: string) {
  if (!status) {
    return "IDLE"
  }

  switch (status) {
    case "running":
      return "SYNCING"
    case "partial":
      return "PARTIAL"
    case "error":
      return "ERROR"
    case "success":
      return "SUCCESS"
    case "idle":
    default:
      return status.toUpperCase()
  }
}

export function StatusBadge({ status, label }: { status?: string; label?: string }) {
  return <span className={cn("workspace-badge folio-status-badge", getStatusClasses(status))}>{label ?? formatStatusLabel(status)}</span>
}

export interface AutoTagProgressLabels {
  analyzing: string
  phaseHeuristics: string
  phaseLlm: string
  waiting: string
  stalled: string
  cancel: string
  cancelling: string
  elapsed: string
  remaining: string
}

// The one place a run's state is shown. It answers three different questions with
// the same widget: how far along it is, whether it is waiting on the provider, and
// whether it has in fact stopped. The last two are why a plain percentage was not
// enough — a bar frozen at 40% for a minute is indistinguishable from a dead run.
export function AutoTagProgressBar({
  testId,
  progress,
  labels,
  onCancel
}: {
  testId: string
  progress: {
    percent: number
    processed: number
    total: number
    phase: "heuristics" | "llm"
    status: "running" | "waiting" | "cancelling"
    isStalled: boolean
    waitingSecondsLeft?: number
    secondsSinceHeartbeat: number
    elapsedSeconds: number
    etaSeconds?: number
    model?: string
  }
  labels: AutoTagProgressLabels
  onCancel: () => void
}) {
  const isIndeterminate = progress.status === "waiting" || progress.isStalled
  const statusLine =
    progress.status === "cancelling"
      ? labels.cancelling
      : progress.status === "waiting"
        ? `${labels.waiting}${progress.waitingSecondsLeft ? ` ${progress.waitingSecondsLeft}s` : ""}`
        : progress.isStalled
          ? labels.stalled.replace("{seconds}", String(progress.secondsSinceHeartbeat))
          : labels.analyzing

  return (
    <div
      data-testid={testId}
      data-status={progress.status}
      data-stalled={progress.isStalled ? "true" : "false"}
      className={cn("options-autotag-progress", progress.isStalled && "options-autotag-progress-stalled")}>
      <div className="options-autotag-progress-head">
        <span className="options-autotag-progress-phase">
          {progress.phase === "heuristics" ? labels.phaseHeuristics : labels.phaseLlm}
        </span>
        <span className="options-autotag-progress-count font-mono" data-testid={`${testId}-count`}>
          {progress.processed}/{progress.total}
        </span>
      </div>

      <div
        className="options-autotag-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        // An indeterminate state reports no value, so assistive tech does not
        // announce a number that means nothing.
        {...(isIndeterminate ? {} : { "aria-valuenow": progress.percent })}
        aria-label={statusLine}>
        <div
          className={cn("options-autotag-progress-fill", isIndeterminate && "options-autotag-progress-fill-indeterminate")}
          style={isIndeterminate ? undefined : { width: `${progress.percent}%` }}
        />
      </div>

      <div className="options-autotag-progress-foot">
        <span data-testid={`${testId}-status`}>{statusLine}</span>
        <span className="options-meta-copy">
          {labels.elapsed.replace("{seconds}", String(progress.elapsedSeconds))}
          {progress.etaSeconds !== undefined
            ? ` · ${labels.remaining.replace("{seconds}", String(progress.etaSeconds))}`
            : ""}
        </span>
        <button
          type="button"
          data-testid={`${testId}-cancel`}
          className="chip-button options-chip-muted"
          disabled={progress.status === "cancelling"}
          onClick={onCancel}>
          {progress.status === "cancelling" ? labels.cancelling : labels.cancel}
        </button>
      </div>
    </div>
  )
}
