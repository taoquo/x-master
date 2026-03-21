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

export interface SourceMaterialRecord extends BookmarkRecord {
  sourceKind?: "x-bookmark"
  contentFingerprint?: string
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

export interface KnowledgeCardProvenanceRecord {
  field: "theme" | "summary" | "key_excerpt" | "applicability"
  excerpt: string
  charStart?: number
  charEnd?: number
}

export interface KnowledgeCardQualitySignal {
  score: number
  needsReview: boolean
  warnings: string[]
  generatorVersion: string
}

export interface KnowledgeCardDraftRecord {
  id: string
  sourceMaterialId: string
  status: "draft" | "reviewed"
  title: string
  theme: string
  summary: string
  keyExcerpt: string
  applicability: string
  provenance: KnowledgeCardProvenanceRecord[]
  quality: KnowledgeCardQualitySignal
  generatedAt: string
  updatedAt: string
  sourceFingerprint: string
  lastGeneratedFromModel?: string
}

export interface AiGenerationSettings {
  enabled: boolean
  provider: "openai"
  apiKey: string
  model: string
}

export type ExportScope = "all" | "reviewed" | "reviewed-and-stale"
export type OnboardingStep = "sync-source" | "generate-cards" | "review-cards" | "export-vault" | "done"

export interface ExtensionSettings {
  schemaVersion: number
  lastSyncSummary: SyncSummary
  hasCompletedOnboarding: boolean
  aiGeneration: AiGenerationSettings
  exportScope: ExportScope
}

export interface PopupData {
  bookmarks: BookmarkRecord[]
  sourceMaterials: SourceMaterialRecord[]
  knowledgeCards: KnowledgeCardDraftRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  aiGeneration: AiGenerationSettings
  exportScope: ExportScope
  hasCompletedOnboarding: boolean
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
