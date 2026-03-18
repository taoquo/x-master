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

export interface FolderRecord {
  id: string
  name: string
  parentId?: string
  createdAt: string
}

export interface BookmarkFolderRecord {
  bookmarkId: string
  folderId: string
  updatedAt: string
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

export interface ExtensionSettings {
  schemaVersion: number
  lastSyncSummary: SyncSummary
  hasCompletedOnboarding: boolean
}

export interface PopupData {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  bookmarkFolders: BookmarkFolderRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  summary: SyncSummary
  latestSyncRun: SyncRunRecord | null
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
