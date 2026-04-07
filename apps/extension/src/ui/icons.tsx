import React from "react"
import {
  ArrowsClockwise,
  ArrowSquareOut,
  BookmarkSimple,
  Copy,
  FunnelSimple,
  ImageSquare,
  Info,
  MagnifyingGlass,
  PencilSimple,
  PlayCircle,
  Sparkle,
  Tag,
  Trash,
  Waveform,
  X
} from "@phosphor-icons/react"

type AppIconName =
  | "search"
  | "filter"
  | "external"
  | "copy"
  | "image"
  | "close"
  | "edit"
  | "trash"
  | "bookmark"
  | "tag"
  | "sync"
  | "sparkle"
  | "wave"
  | "info"
  | "play"

interface AppIconProps {
  name: AppIconName
  size?: number
  className?: string
}

export function AppIcon({ name, size = 18, className }: AppIconProps) {
  const commonProps = {
    size,
    weight: "regular" as const,
    className,
    "aria-hidden": true
  }

  switch (name) {
    case "search":
      return <MagnifyingGlass {...commonProps} />
    case "filter":
      return <FunnelSimple {...commonProps} />
    case "external":
      return <ArrowSquareOut {...commonProps} />
    case "copy":
      return <Copy {...commonProps} />
    case "image":
      return <ImageSquare {...commonProps} />
    case "close":
      return <X {...commonProps} />
    case "edit":
      return <PencilSimple {...commonProps} />
    case "trash":
      return <Trash {...commonProps} />
    case "bookmark":
      return <BookmarkSimple {...commonProps} />
    case "tag":
      return <Tag {...commonProps} />
    case "sync":
      return <ArrowsClockwise {...commonProps} />
    case "sparkle":
      return <Sparkle {...commonProps} />
    case "wave":
      return <Waveform {...commonProps} />
    case "info":
      return <Info {...commonProps} />
    case "play":
      return <PlayCircle {...commonProps} />
    default:
      return null
  }
}
