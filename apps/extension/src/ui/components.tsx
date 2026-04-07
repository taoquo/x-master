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
        <h1 className="max-w-[10ch] font-display text-[clamp(3.8rem,9vw,6.6rem)] leading-[0.9] tracking-[-0.06em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-[28ch] text-xl leading-[1.2] tracking-[-0.03em] text-slate-900/88 md:text-[2rem]">
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
    <section className={cn("glass-panel flex flex-col p-5 md:p-6", className)}>
      {title ? (
        <div className="mb-5">
          <h2 className="font-display text-[2.1rem] leading-none tracking-[-0.05em] text-ink">{title}</h2>
          {description ? <p className="mt-2 max-w-[30ch] text-sm leading-6 text-slate-700/78">{description}</p> : null}
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
    <div className="glass-panel relative overflow-hidden rounded-[2rem] p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(255,255,255,0.65),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(189,224,254,0.36),transparent_32%)]" />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-800/76">{label}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-end">
          <div className="font-sans text-[4rem] leading-none tracking-[-0.08em] text-slate-700">{value}</div>
          <p className="max-w-[18ch] text-[1.05rem] leading-7 text-slate-900/86">{hint}</p>
        </div>
        <div className={cn("mt-7 h-1 rounded-full bg-sky-500", accentClassName)} />
      </div>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-[2rem] p-8 text-left">
      <h3 className="font-display text-[1.9rem] leading-none tracking-[-0.05em] text-ink">{title}</h3>
      <p className="max-w-[40ch] text-sm leading-6 text-slate-700/76">{description}</p>
    </div>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium capitalize tracking-[0.04em] backdrop-blur-lg",
        getStatusClasses(status)
      )}>
      {status ?? "idle"}
    </span>
  )
}
