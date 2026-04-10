export interface BookmarkRecord {
  id?: string
  tweetId: string
  tweetUrl: string
  authorName: string
  authorHandle: string
  text: string
  createdAtOnX: string
  savedAt: string
  media?: Array<{ type: string; url: string; altText?: string }>
  metrics?: { likes: number; retweets: number; replies: number }
  rawPayload: unknown
  updatedAt?: string
}

export interface SiteTweetDraft {
  tweetId: string
  tweetUrl: string
  authorName: string
  authorHandle: string
  text: string
  createdAtOnX: string
}

export interface TagRecord {
  id: string
  name: string
  createdAt: string
}

export interface BookmarkTagRecord {
  id: string
  bookmarkId: string
  tagId: string
  createdAt: string
}

export interface ListRecord {
  id: string
  name: string
  createdAt: string
}

export interface BookmarkListRecord {
  bookmarkId: string
  listId: string
  updatedAt: string
}

export interface ClassificationRule {
  id: string
  name: string
  enabled: boolean
  authorHandles: string[]
  keywords: string[]
  requireMedia: boolean
  requireLongform: boolean
  targetTagIds: string[]
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
  errorSummary?: string
}

export interface SyncSummary {
  status: "idle" | "running" | "success" | "partial_success" | "error"
  fetchedCount: number
  insertedCount: number
  updatedCount: number
  failedCount: number
  lastSyncedAt?: string
  errorSummary?: string
}

export interface ListStat {
  listId: string
  name: string
  count: number
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
  inboxCount: number
  unclassifiedCount: number
  listCounts: ListStat[]
  tagCounts: TagStat[]
  topAuthors: AuthorStat[]
}

export interface ExtensionSettings {
  schemaVersion: number
  locale: Locale
  themePreference: ThemePreference
  lastSyncSummary: SyncSummary
  classificationRules: ClassificationRule[]
}

export interface WorkspaceData {
  bookmarks: BookmarkRecord[]
  lists: ListRecord[]
  bookmarkLists: BookmarkListRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  classificationRules: ClassificationRule[]
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
