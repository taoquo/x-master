import React from "react"
import { cn } from "../utils.ts"
import type { OptionsCopy } from "../i18n/copy.ts"

export function BackgroundScene() {
  return null
}

export function InlineMessage({
  message,
  tone = "error",
  className
}: {
  message?: string | null
  tone?: "error" | "info"
  className?: string
}) {
  if (!message) {
    return null
  }

  return (
    <div
      className={cn(
        "folio-inline-message",
        tone === "error" ? "is-error" : "is-info",
        className
      )}>
      {message}
    </div>
  )
}

export function FeedStatusCard({
  testId,
  icon,
  overline,
  title,
  description,
  tone = "default",
  action
}: {
  testId: string
  icon: React.ReactNode
  overline: string
  title: string
  description: string
  tone?: "default" | "error"
  action?: React.ReactNode
}) {
  return (
    <div data-testid={testId} className={cn("options-feed-state-shell options-theme-panel", tone === "error" && "is-error")}>
      <div className="options-feed-state-icon">{icon}</div>
      <div className="space-y-3">
        <div className="options-feed-state-overline">{overline}</div>
        <h3 className="options-feed-state-title">{title}</h3>
        <p className="options-feed-state-copy">{description}</p>
      </div>
      {action ? <div className="options-feed-state-actions">{action}</div> : null}
    </div>
  )
}

export function FeedLoadingState({ copy }: { copy: OptionsCopy }) {
  return (
    <div data-testid="feed-loading-state" className="options-feed-skeleton-shell options-theme-panel">
      <div className="options-feed-skeleton-head">
        <div className="space-y-3">
          <div className="options-feed-state-overline">{copy.loadingFeedTitle}</div>
          <div className="h-5 w-56 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-[12px] bg-[var(--surface-muted)]" />
      </div>

      <div className="options-feed-skeleton-grid" aria-hidden="true">
        {[228, 276, 244, 296, 236, 260].map((height, index) => (
          <div key={`${height}-${index}`} className="options-feed-skeleton-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="h-4 w-[88%] animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="h-4 w-[64%] animate-pulse rounded-full bg-[var(--surface-muted)]" />
            </div>
            <div className="mt-5 animate-pulse rounded-[16px] bg-[var(--surface-muted)]" style={{ height }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FieldBlock({
  label,
  htmlFor,
  description,
  children,
  className,
  labelClassName
}: {
  label: string
  htmlFor: string
  description?: string
  children: React.ReactNode
  className?: string
  labelClassName?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className={cn("block text-[12px] font-normal leading-4 text-[var(--text-secondary)]", labelClassName)}>
        {label}
      </label>
      {children}
      {description ? <p className="options-meta-copy">{description}</p> : null}
    </div>
  )
}

export function TextInputField({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
  dataTestId,
  ariaLabel
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  className?: string
  dataTestId?: string
  ariaLabel?: string
}) {
  return (
    <input
      id={id}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      type={type}
      value={value}
      placeholder={placeholder}
      onInput={(event) => onChange(event.currentTarget.value)}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={cn("field-shell w-full", className)}
    />
  )
}
