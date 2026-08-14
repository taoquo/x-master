import type { BookmarkTagRecord, Locale, TagRecord } from "../lib/types.ts"
import { getSyncErrorSummary, type SyncErrorKind } from "../lib/x/syncErrors.ts"
import type { BookmarkSortOrder } from "../lib/search/searchBookmarks.ts"
import type { OptionsCopy } from "./i18n/copy.ts"

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function haveSameItems(current: string[], next: string[]) {
  return current.length === next.length && current.every((value, index) => value === next[index])
}

export function formatTimestamp(value: string | undefined, locale: Locale) {
  if (!value) {
    return locale === "zh-CN" ? "尚未同步" : "Not synced yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed)
}

export function getSectionOverline(locale: Locale, zhLabel: string, enLabel: string) {
  return locale === "zh-CN" ? zhLabel : enLabel
}

export function formatCompactCount(value: number | undefined, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: value && value >= 1000 ? 1 : 0
  }).format(value ?? 0)
}

export function formatSyncErrorSummary(summary: { errorKind?: SyncErrorKind; errorSummary?: string }, locale: Locale) {
  return summary.errorKind ? getSyncErrorSummary(summary.errorKind, locale) : summary.errorSummary
}

export function getListCopyDensityClass(text: string, hasMedia: boolean, hasTags: boolean) {
  const textLength = text.trim().length

  if (hasMedia) {
    return "is-list-2line"
  }

  if (!hasTags && textLength <= 48) {
    return "is-list-1line"
  }

  if (hasTags || textLength >= 240) {
    return "is-list-2line"
  }

  return "is-list-3line"
}

export function getVisibleCardTagNames(tagNames: string[], viewMode: "grid" | "list") {
  if (viewMode !== "list" || tagNames.length <= 2) {
    return tagNames
  }

  return [...tagNames.slice(0, 2), `+${tagNames.length - 2}`]
}

export function getListCardTemplateClass(hasMedia: boolean, hasTags: boolean, copyDensityClass: string) {
  if (hasMedia) {
    return "options-result-card-list-template-media"
  }

  if (hasTags) {
    return "options-result-card-list-template-tagged"
  }

  if (copyDensityClass === "is-list-1line") {
    return "options-result-card-list-template-compact"
  }

  return "options-result-card-list-template-default"
}

export function isVideoMediaType(type: string | undefined) {
  return type === "video" || type === "animated_gif"
}

export function truncateText(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}...`
}

export function getTagNamesForBookmark(bookmarkId: string, bookmarkTags: BookmarkTagRecord[], tagsById: Map<string, TagRecord>) {
  return bookmarkTags
    .filter((bookmarkTag) => bookmarkTag.bookmarkId === bookmarkId)
    .map((bookmarkTag) => tagsById.get(bookmarkTag.tagId))
    .filter(Boolean) as TagRecord[]
}

export function getNextThemePreference(
  themePreference: "system" | "light" | "dark",
  resolvedTheme: "light" | "dark"
): "system" | "light" | "dark" {
  if (themePreference === "system") {
    return resolvedTheme === "dark" ? "light" : "dark"
  }

  if (themePreference === "dark") {
    return "light"
  }

  return "system"
}

export function createFieldId(scope: string, name: string) {
  return `${scope}-${name}`
}

export const SORT_ORDER_SEQUENCE: BookmarkSortOrder[] = ["timeline", "saved-asc", "created-desc", "likes-desc"]
export const INITIAL_RESULTS_RENDER_LIMIT = 80
export const RESULTS_RENDER_INCREMENT = 80
export const DEFAULT_SAVED_VIEW_NAME = "Saved view"
export const ENABLE_SAVED_VIEWS_UI = false

export interface ViewStateSnapshot {
  query: string
  activeTagIds: string[]
  activeAuthorHandles: string[]
  onlyWithMedia: boolean
  onlyLongform: boolean
  sortOrder: BookmarkSortOrder
  viewMode: "grid" | "list"
}

export function getSortLabel(copy: OptionsCopy, sortOrder: BookmarkSortOrder) {
  switch (sortOrder) {
    case "timeline":
      return copy.latestSaved
    case "saved-asc":
      return copy.oldestSaved
    case "created-desc":
      return copy.newestPublished
    case "likes-desc":
      return copy.mostLiked
    case "saved-desc":
    default:
      return copy.latestSaved
  }
}

export function getNextSortOrder(sortOrder: BookmarkSortOrder): BookmarkSortOrder {
  const currentIndex = SORT_ORDER_SEQUENCE.indexOf(sortOrder)
  return SORT_ORDER_SEQUENCE[(currentIndex + 1) % SORT_ORDER_SEQUENCE.length]
}
