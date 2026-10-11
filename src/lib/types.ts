import type { SyncErrorKind } from "./x/syncErrors.ts"
import type { ModelCapabilities } from "./llm/types.ts"
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
  parentId?: string
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

// Why the LLM produced nothing for a bookmark. Only "tagged" leaves suggestion
// rows behind, which is exactly why the other three need their own record: a
// bookmark the model deliberately skipped is still a bookmark it has seen.
export type LlmAnalysisOutcome = "tagged" | "no-topic" | "all-blocked" | "budget-dropped"

// One row per bookmark the LLM has looked at. This is the ledger that makes a
// run idempotent; without it "already analyzed" was inferred from suggestion
// rows and every zero-result bookmark was re-sent forever.
export interface LlmAnalysisRecord {
  bookmarkId: string
  analyzedAt: string
  // Invalidation inputs. A verdict is only reusable while the question is
  // unchanged: a new prompt, a different model, or edited bookmark text all
  // make the stored answer stale and the bookmark eligible again.
  promptVersion: number
  model: string
  contentHash: string
  outcome: LlmAnalysisOutcome
  tagCount: number
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

// One provider's credential. Lives in chrome.storage.local only, never in a
// backup. Everything except `kind` is optional so that adding an OAuth field later
// needs no storage migration.
export interface StoredLlmCredential {
  kind?: "api-key" | "oauth"
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  accountLabel?: string
}

export interface AutoTagLlmSettings {
  enabled: boolean
  // Which definition in src/lib/llm/providers.ts drives this configuration.
  activeProviderId: string
  baseUrl: string
  model: string
  // Azure routes by deployment name and pins an API version; both are provider
  // *config*, not credentials.
  deploymentName?: string
  apiVersion?: string
  batchSize: number
  // How many batches may be in flight at once. 1 restores strictly serial runs.
  concurrency?: number
  maxBookmarksPerRun: number
  tagVocabularyMode: TagVocabularyMode
  // Explicit override of the built-in capability table: the escape hatch for a
  // model the table does not know yet.
  capabilityOverrides?: Partial<ModelCapabilities>
  // What a previous run learned the hard way (a gateway that rejected a
  // parameter), keyed `${providerId}::${model}`.
  learnedCapabilities?: Record<string, Partial<ModelCapabilities>>
  // Legacy single-provider field. Never written any more; still accepted on read.
  provider?: "openai-compatible"
}

export interface AutoTagSettings {
  enabled: boolean
  runAfterSync: boolean
  // When a run stops at the wall-clock limit with bookmarks still queued, start
  // another one instead of leaving the user to click again. Each continuation is a
  // fresh service-worker invocation, which is the only way past Chrome's per
  // invocation limit; the count is capped so a stuck run cannot spin.
  autoContinue?: boolean
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

// Why a run produced no LLM suggestions. Persisted so the settings panel can
// explain a silent run instead of leaving the user guessing.
export type AutoTagRunOutcome =
  | "ok"
  | "disabled"
  | "llm-disabled"
  | "missing-api-key"
  | "no-candidates"
  // The vocabulary is empty and the mode forbids inventing tags, so the LLM
  // has nothing to choose from. Without its own outcome this ran as "ok" and
  // reported "done, 0 suggestions" while never issuing a single request.
  | "empty-vocabulary"
  // The model answered, but every tag it proposed is on the block list left
  // behind by deleted tags. Without its own outcome this looked like a success
  // that produced nothing.
  | "all-blocked"
  // The model answered, but every tag it proposed was new and the run had no
  // new-tag budget left. Also a "successful" run that stores nothing.
  | "budget-exhausted"
  // The worker died before finishRun. Without its own outcome the run left no
  // trace at all: the state was cleared, the panel kept showing the previous
  // result, and nothing told the user a run had even been interrupted.
  | "interrupted"
  // The run hit its wall-clock budget before it worked through the candidate
  // window. Batches already persisted are kept; this is a partial success, not
  // a failure, and it must stay distinguishable from both so the user knows to
  // simply run again rather than go hunting for a broken gateway.
  | "timed-out"
  // The user asked the run to stop. Same partial-success shape as "timed-out".
  | "cancelled"
  | "failed"

export interface AutoTagRunSummary {
  finishedAt: string
  outcome: AutoTagRunOutcome
  suggestedCount: number
  pendingCount: number
  candidateCount: number
  llmProcessedCount: number
  llmBatchCount: number
  llmFailedBatchCount: number
  newTagBudget: number
  vocabularySize: number
  // Canonical keys of deliberately deleted tags. Surfaced because a long block
  // list silently starves both the rules and the LLM.
  blockedTagKeyCount?: number
  // Suggestions dropped by that block list during this run.
  blockedDroppedCount?: number
  // Suggestions dropped because the run had no new-tag budget left.
  budgetDroppedCount?: number
  // Candidates the run never reached because it stopped early (deadline or
  // cancel). Non-zero means "run again to continue", which is a very different
  // instruction from every other zero-result outcome.
  unprocessedCount?: number
  error?: string
}

// Live state of an in-flight run, persisted so an interrupted run leaves a
// trace. Without it a run killed mid-flight (service worker recycled, browser
// closed) wrote nothing at all and the panel just showed the previous result
// while looking frozen.
// What the run is doing right now. `waiting` is the honest answer to "is it stuck
// or is the provider slow?": the heartbeat is fresh but no batch is progressing.
export type AutoTagRunStatus = "running" | "waiting" | "cancelling"

export interface AutoTagRunState {
  // Identifies the run that owns this state. A takeover replaces the state
  // wholesale, so a superseded run can tell the state is no longer its own and
  // must neither clear nor overwrite the run that replaced it.
  runId?: string
  startedAt: string
  // Heartbeat, refreshed after every batch. A state whose heartbeat stopped
  // moving is how a dead run is told apart from a slow one.
  updatedAt: string
  phase: "heuristics" | "llm"
  processed: number
  total: number
  // Set by the options page; read back by the pipeline after each batch, which
  // is why the heartbeat write and the cancel read are the same round-trip.
  cancelRequested?: boolean
  // --- progress detail (all optional, so an older state stays valid) ---
  status?: AutoTagRunStatus
  // Which unit of work is in flight, so the UI can say "waiting" instead of
  // showing a frozen bar.
  inFlight?: boolean
  batchStartedAt?: string
  // When a provider asked us to back off, the wall clock we are waiting until.
  waitingUntilMs?: number
  waitingReason?: string
  attempt?: number
  // Which model produced the numbers, so the user knows what is running.
  providerId?: string
  model?: string
  lastErrorKind?: string
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
  lastAutoTagRun?: AutoTagRunSummary
  autoTagRunState?: AutoTagRunState
  // How many times the current chain of runs has been continued automatically.
  // Reset when a run ends on its own or the user starts one, so a run that cannot
  // make progress stops asking for another service-worker invocation.
  autoTagContinueCount?: number
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
