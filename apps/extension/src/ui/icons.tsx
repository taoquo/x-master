import React from "react"

type AppIconName =
  | "dashboard"
  | "inbox"
  | "library"
  | "settings"
  | "chevron-left"
  | "chevron-right"
  | "search"
  | "filter"
  | "external"
  | "copy"
  | "image"
  | "heart"
  | "close"
  | "edit"
  | "trash"

interface AppIconProps {
  name: AppIconName
  size?: number
  stroke?: number
}

export function AppIcon({ name, size = 18, stroke = 1.8 }: AppIconProps) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: stroke
  }

  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      )
    case "inbox":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M4 6.5h16v10.5H4z" />
          <path {...commonProps} d="M4 14h4l2 3h4l2-3h4" />
        </svg>
      )
    case "library":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M5 5.5h14v13H5z" />
          <path {...commonProps} d="M8 9.5h8M8 13h6" />
        </svg>
      )
    case "settings":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path
            {...commonProps}
            d="M12 3.75l1.2 2.48 2.73.4-1.97 1.92.47 2.72L12 10.5l-2.43 1.27.47-2.72-1.97-1.92 2.73-.4z"
          />
          <circle {...commonProps} cx="12" cy="15.5" r="4.5" />
        </svg>
      )
    case "chevron-left":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M14.5 6.5L9 12l5.5 5.5" />
        </svg>
      )
    case "chevron-right":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M9.5 6.5L15 12l-5.5 5.5" />
        </svg>
      )
    case "search":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <circle {...commonProps} cx="11" cy="11" r="6" />
          <path {...commonProps} d="M20 20l-4.35-4.35" />
        </svg>
      )
    case "filter":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      )
    case "external":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M13 5h6v6" />
          <path {...commonProps} d="M19 5l-9 9" />
          <path {...commonProps} d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
      )
    case "copy":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect {...commonProps} x="9" y="9" width="10" height="10" rx="2" />
          <path {...commonProps} d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
        </svg>
      )
    case "image":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect {...commonProps} x="4" y="5" width="16" height="14" rx="2" />
          <circle {...commonProps} cx="9" cy="10" r="1.6" />
          <path {...commonProps} d="M20 16l-4.5-4.5-6 6" />
        </svg>
      )
    case "heart":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path
            {...commonProps}
            d="M12 20s-6.5-3.92-8.5-7.57C1.92 9.52 3.13 6 6.56 6c2.03 0 3.15 1.17 3.94 2.31C11.29 7.17 12.41 6 14.44 6 17.87 6 19.08 9.52 20.5 12.43 18.5 16.08 12 20 12 20z"
          />
        </svg>
      )
    case "close":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M6 6l12 12M18 6l-12 12" />
        </svg>
      )
    case "edit":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M4 20h4l10-10-4-4L4 16v4z" />
          <path {...commonProps} d="M13 7l4 4" />
        </svg>
      )
    case "trash":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <path {...commonProps} d="M4 7h16" />
          <path {...commonProps} d="M9 7V5h6v2" />
          <path {...commonProps} d="M7 7l1 12h8l1-12" />
          <path {...commonProps} d="M10 11v5M14 11v5" />
        </svg>
      )
    default:
      return null
  }
}
