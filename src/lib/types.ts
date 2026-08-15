import type { SyncErrorKind } from "./x/syncErrors.ts"
import type { BookmarkSortOrder } from "./search/searchBookmarks.ts"

export interface BookmarkRecord {
  id?: string
  tweetId: string
  tweetUrl: string
  authorName: string
  authorHandle: string
  authorAvatarUrl?: string
  text: string
  createdAtOnX: string
  savedAt: string
  lastSeenAt?: string
  bookmarkTimelineRank?: number
  hashtags?: string[]
  media?: Array<{ type: string; url: string; posterUrl?: string; altText?: string }>
  metrics?: { likes: number; retweets: number; replies: number }
  updatedAt?: string
}

export interface RawPayloadRecord {
  tweetId: string
  payload: unknown
}

export interface SiteTweetDraft {
  tweetId: string
  tweetUrl: string
  authorName: string
  authorHandle: string
  authorAvatarUrl?: string
  text: string
  createdAtOnX: string
}

export interface TagRecord {
  id: string
  name: string
  createdAt: string
  aliases?: string[]
  updatedAt?: string
}

export interface BookmarkTagRecord {
  id: string
  bookmarkId: string
  tagId: string
  createdAt: string
}

export type TagSuggestionSource = "hashtag" | "author" | "keyword" | "llm"

export type TagSuggestionStatus = "pending" | "accepted" | "rejected"

export interface TagSuggestionRecord {
  id: string
  bookmarkId: string
  tagName: string
  source: TagSuggestionSource
  confidence: number
  status: TagSuggestionStatus
  createdAt: string
  resolvedAt?: string
}

export interface SavedViewRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  query: string
  activeTagIds: string[]
  activeAuthorHandles: string[]
  onlyWithMedia: boolean
  onlyLongform: boolean
  sortOrder: BookmarkSortOrder
  viewMode: "grid" | "list"
}

export interface SyncRunRecord {
  id: string
  status: "idle" | "running" | "success" | "partial_success" | "error"
  startedAt?: string
  finishedAt?: string
  fetchedCount: number
  insertedCount: number
  updatedCount: number
  failedCount: number
  errorKind?: SyncErrorKind
  errorSummary?: string
}

export interface SyncSummary {
  status: "idle" | "running" | "success" | "partial_success" | "error"
  fetchedCount: number
  insertedCount: number
  updatedCount: number
  failedCount: number
  lastSyncedAt?: string
  errorKind?: SyncErrorKind
  errorSummary?: string
}

export interface TagStat {
  tagId: string
  name: string
  count: number
}

export interface AuthorStat {
  authorHandle: string
  authorName: string
  count: number
}

export type Locale = "zh-CN" | "en"

export type ThemePreference = "system" | "light" | "dark"

export interface WorkspaceStats {
  totalBookmarks: number
  unclassifiedCount: number
  pendingSuggestionCount: number
  tagCounts: TagStat[]
  topAuthors: AuthorStat[]
}

export interface KeywordTagRule {
  keyword: string
  tagName: string
}

// closed  : never invent a tag, reuse the existing vocabulary only
// guarded : may invent a few tags per run, within an explicit budget (default)
// open    : may invent tags freely
export type TagVocabularyMode = "closed" | "guarded" | "open"

export interface AutoTagLlmSettings {
  enabled: boolean
  provider: "openai-compatible"
  baseUrl: string
  model: string
  batchSize: number
  maxBookmarksPerRun: number
  tagVocabularyMode: TagVocabularyMode
}

export interface AutoTagSettings {
  enabled: boolean
  runAfterSync: boolean
  heuristics: {
    useHashtags: boolean
    useAuthors: boolean
    keywordRules: KeywordTagRule[]
  }
  llm: AutoTagLlmSettings
  // Canonical keys of tags the user deleted on purpose. Auto-tagging never
  // suggests them again until the tag is re-created by hand.
  blockedTagKeys: string[]
}

export interface ExtensionSettings {
  schemaVersion: number
  locale: Locale
  themePreference: ThemePreference
  lastSyncSummary: SyncSummary
  syncStrategyVersion?: number
  hasCompletedInitialFullSync?: boolean
  hashtagBackfillDone?: boolean
  incrementalStopBufferPages?: number
  leftSidebarWidth?: number
  rightSidebarWidth?: number
  savedViews: SavedViewRecord[]
  autoTag: AutoTagSettings
}

export interface WorkspaceData {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  tagSuggestions: TagSuggestionRecord[]
  savedViews: SavedViewRecord[]
  summary: SyncSummary
  latestSyncRun: SyncRunRecord | null
  stats: WorkspaceStats
}

export interface SiteTweetTagState {
  bookmarkId: string
  tags: TagRecord[]
  selectedTagIds: string[]
  locale?: Locale
}

export interface SiteTweetCreateTagResult extends SiteTweetTagState {
  createdTag: TagRecord
}

export interface SiteTweetBookmarkSyncResult {
  bookmarkId: string
  enabled: boolean
}

export function createEmptySyncSummary(): SyncSummary {
  return {
    status: "idle",
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 0
  }
}
