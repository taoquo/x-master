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
  bodyClassName
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("panel-surface flex flex-col rounded-[22px] p-5 md:p-6", className)}>
      {title ? (
        <div className="mb-4">
          <h2 className="workspace-title-lg text-ink">{title}</h2>
          {description ? <p className="workspace-body mt-2 max-w-[34ch]">{description}</p> : null}
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
    <div className="panel-elevated flex flex-col gap-3 rounded-[20px] p-8 text-left">
      <h3 className="workspace-title-md text-ink">{title}</h3>
      {description ? <p className="workspace-body max-w-[40ch]">{description}</p> : null}
    </div>
  )
}

export function StatusBadge({ status, label }: { status?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize tracking-[0.08em] backdrop-blur-lg",
        getStatusClasses(status)
      )}>
      {label ?? status ?? "idle"}
    </span>
  )
}
