import React from "react"
import { getStatusClasses } from "./theme.ts"

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function SectionHeader({
  title,
  description,
  actions
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="max-w-[10ch] font-sans text-[clamp(3rem,8vw,5rem)] leading-[0.92] tracking-[-0.06em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-[28ch] text-lg leading-[1.35] tracking-[-0.02em] text-slate-600 md:text-xl">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
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
      ? "workspace-surface flex flex-col"
      : "workspace-surface panel-surface flex flex-col rounded-[22px] p-5 md:p-6"

  return (
    <section className={cn(shellClassName, className)}>
      {title ? (
        <div className="mb-4 space-y-2">
          <h2 className="workspace-heading-lg">{title}</h2>
          {description ? <p className="workspace-copy">{description}</p> : null}
        </div>
      ) : null}
      <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </section>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  accentClassName
}: {
  label: string
  value: string
  hint: string
  accentClassName?: string
}) {
  return (
    <div className="panel-elevated relative overflow-hidden rounded-[20px] p-6">
      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-end">
          <div className="font-mono text-[3.3rem] leading-none tracking-[-0.06em] text-slate-900">{value}</div>
          <p className="max-w-[18ch] text-[0.92rem] leading-6 text-slate-600">{hint}</p>
        </div>
        <div className={cn("mt-6 h-px rounded-full bg-[var(--accent-bg)]", accentClassName)} />
      </div>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="workspace-empty-state">
      <h3 className="workspace-heading-md">{title}</h3>
      {description ? <p className="workspace-copy">{description}</p> : null}
    </div>
  )
}

export function StatusBadge({ status, label }: { status?: string; label?: string }) {
  return <span className={cn("workspace-badge", getStatusClasses(status))}>{label ?? status ?? "idle"}</span>
}
