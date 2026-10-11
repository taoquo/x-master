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
