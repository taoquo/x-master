import React from "react"
import {
  ArrowsClockwise,
  ArrowsDownUp,
  ArrowSquareOut,
  BookmarkSimple,
  ChatCircle,
  Check,
  Copy,
  FunnelSimple,
  Gear,
  GlobeSimple,
  Hash,
  ImageSquare,
  Info,
  List,
  MagnifyingGlass,
  Moon,
  Heart,
  PencilSimple,
  PlayCircle,
  ShareNetwork,
  Sparkle,
  SquaresFour,
  Sun,
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
  | "globe"
  | "hash"
  | "check"
  | "settings"
  | "sun"
  | "moon"
  | "grid"
  | "list"
  | "sort"
  | "comment"
  | "heart"
  | "share"

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
    case "globe":
      return <GlobeSimple {...commonProps} />
    case "hash":
      return <Hash {...commonProps} />
    case "check":
      return <Check {...commonProps} />
    case "settings":
      return <Gear {...commonProps} />
    case "sun":
      return <Sun {...commonProps} />
    case "moon":
      return <Moon {...commonProps} />
    case "grid":
      return <SquaresFour {...commonProps} />
    case "list":
      return <List {...commonProps} />
    case "sort":
      return <ArrowsDownUp {...commonProps} />
    case "comment":
      return <ChatCircle {...commonProps} />
    case "heart":
      return <Heart {...commonProps} />
    case "share":
      return <ShareNetwork {...commonProps} />
    default:
      return null
  }
}
