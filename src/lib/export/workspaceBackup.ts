import type {
  BookmarkTagRecord,
  ExtensionSettings,
  SavedViewRecord,
  SyncRunRecord,
  SyncSummary,
  TagRecord
} from "../types.ts"
import type { BookmarkSortOrder } from "../search/searchBookmarks.ts"
import {
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  getBookmarksDb,
  LLM_ANALYSIS_STORE,
  requestToPromise,
  SYNC_RUNS_STORE,
  TAG_SUGGESTIONS_STORE,
  TAGS_STORE,
  transactionDone
} from "../storage/db.ts"
import { updateSettings } from "../storage/settings.ts"
import { canonicalTagKey } from "../tags/canonical.ts"
import { isSyncErrorKind } from "../x/syncErrors.ts"
import {
  WORKSPACE_EXPORT_VERSION,
  type WorkspaceExportBookmarkRecord,
  type WorkspaceExportPayload
} from "./exportBookmarks.ts"

export interface WorkspaceBackupCounts {
  bookmarks: number
  tags: number
  bookmarkTags: number
  latestSyncRun: number
}

export interface WorkspaceBackupValidationResult {
  payload: WorkspaceExportPayload
  counts: WorkspaceBackupCounts
  exportedAt: string
}

export interface WorkspaceRestoreResult {
  counts: WorkspaceBackupCounts
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${path} must be an object`)
  }

  return value
}

function requireString(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key]
  if (typeof value !== "string") {
    throw new Error(`${path}.${key} is required`)
  }

  return value
}

function requireNonEmptyString(record: Record<string, unknown>, key: string, path: string) {
  const value = requireString(record, key, path)
  if (!value.trim()) {
    throw new Error(`${path}.${key} is required`)
  }

  return value
}

function requireBoolean(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key]
  if (typeof value !== "boolean") {
    throw new Error(`${path}.${key} must be a boolean`)
  }

  return value
}

function requireNumber(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} must be a number`)
  }

  return value
}

function requireArray(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`${path}.${key} must be an array`)
  }

  return value
}

function requireStringArray(record: Record<string, unknown>, key: string, path: string) {
  const value = requireArray(record, key, path)
  if (value.some((item) => typeof item !== "string")) {
    throw new Error(`${path}.${key} must contain only strings`)
  }

  return value as string[]
}

function optionalString(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key]
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "string") {
    throw new Error(`${path}.${key} must be a string`)
  }

  return value
}

function optionalSyncErrorKind(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key]
  if (value === undefined) {
    return undefined
  }

  if (!isSyncErrorKind(value)) {
    throw new Error(`${path}.${key} is invalid`)
  }

  return value
}

const SAVED_VIEW_SORT_ORDERS = new Set<BookmarkSortOrder>(["timeline", "saved-desc", "saved-asc", "created-desc", "likes-desc"])

function validateSavedView(value: unknown, path: string): SavedViewRecord {
  const record = requireObject(value, path)
  const sortOrder = requireString(record, "sortOrder", path)
  const viewMode = requireString(record, "viewMode", path)

  if (!SAVED_VIEW_SORT_ORDERS.has(sortOrder as BookmarkSortOrder)) {
    throw new Error(`${path}.sortOrder is invalid`)
  }

  if (viewMode !== "grid" && viewMode !== "list") {
    throw new Error(`${path}.viewMode is invalid`)
  }

  return {
    id: requireNonEmptyString(record, "id", path),
    name: requireNonEmptyString(record, "name", path),
    createdAt: requireString(record, "createdAt", path),
    updatedAt: requireString(record, "updatedAt", path),
    query: requireString(record, "query", path),
    activeTagIds: requireStringArray(record, "activeTagIds", path),
    activeAuthorHandles: requireStringArray(record, "activeAuthorHandles", path),
    onlyWithMedia: requireBoolean(record, "onlyWithMedia", path),
    onlyLongform: requireBoolean(record, "onlyLongform", path),
    sortOrder: sortOrder as BookmarkSortOrder,
    viewMode
  }
}

function validateSyncSummary(value: unknown, path: string): SyncSummary {
  const record = requireObject(value, path)
  const status = requireString(record, "status", path)

  if (!["idle", "running", "success", "partial_success", "error"].includes(status)) {
    throw new Error(`${path}.status is invalid`)
  }

  return {
    status: status as SyncSummary["status"],
    fetchedCount: requireNumber(record, "fetchedCount", path),
    insertedCount: requireNumber(record, "insertedCount", path),
    updatedCount: requireNumber(record, "updatedCount", path),
    failedCount: requireNumber(record, "failedCount", path),
    lastSyncedAt: optionalString(record, "lastSyncedAt", path),
    errorKind: optionalSyncErrorKind(record, "errorKind", path),
    errorSummary: optionalString(record, "errorSummary", path)
  }
}

function validateSyncRun(value: unknown, path: string): SyncRunRecord {
  const record = requireObject(value, path)
  const status = requireString(record, "status", path)

  if (!["idle", "running", "success", "partial_success", "error"].includes(status)) {
    throw new Error(`${path}.status is invalid`)
  }

  return {
    id: requireString(record, "id", path),
    status: status as SyncRunRecord["status"],
    startedAt: optionalString(record, "startedAt", path),
    finishedAt: optionalString(record, "finishedAt", path),
    fetchedCount: requireNumber(record, "fetchedCount", path),
    insertedCount: requireNumber(record, "insertedCount", path),
    updatedCount: requireNumber(record, "updatedCount", path),
    failedCount: requireNumber(record, "failedCount", path),
    errorKind: optionalSyncErrorKind(record, "errorKind", path),
    errorSummary: optionalString(record, "errorSummary", path)
  }
}

function validateBookmark(value: unknown, path: string): WorkspaceExportBookmarkRecord {
  const record = requireObject(value, path)
  const media = record.media
  const metrics = record.metrics

  if (media !== undefined && !Array.isArray(media)) {
    throw new Error(`${path}.media must be an array`)
  }

  if (metrics !== undefined) {
    const metricRecord = requireObject(metrics, `${path}.metrics`)
    requireNumber(metricRecord, "likes", `${path}.metrics`)
    requireNumber(metricRecord, "retweets", `${path}.metrics`)
    requireNumber(metricRecord, "replies", `${path}.metrics`)
  }

  return {
    id: optionalString(record, "id", path),
    tweetId: requireNonEmptyString(record, "tweetId", path),
    tweetUrl: requireNonEmptyString(record, "tweetUrl", path),
    authorName: requireString(record, "authorName", path),
    authorHandle: requireString(record, "authorHandle", path),
    authorAvatarUrl: optionalString(record, "authorAvatarUrl", path),
    text: requireString(record, "text", path),
    createdAtOnX: requireString(record, "createdAtOnX", path),
    savedAt: requireString(record, "savedAt", path),
    lastSeenAt: optionalString(record, "lastSeenAt", path),
    bookmarkTimelineRank: record.bookmarkTimelineRank === undefined
      ? undefined
      : requireNumber(record, "bookmarkTimelineRank", path),
    media: media as WorkspaceExportBookmarkRecord["media"],
    metrics: metrics as WorkspaceExportBookmarkRecord["metrics"],
    updatedAt: optionalString(record, "updatedAt", path),
    // Hashtags are exported but were dropped on the way back in, so a restore
    // silently stripped every bookmark's hashtags. Raw payloads are not part of
    // a backup, so the one-time backfill could not recover them either, and the
    // hashtag rule lost its input for good.
    hashtags: record.hashtags === undefined
      ? undefined
      : requireStringArray(record, "hashtags", path)
  }
}

function validateTag(value: unknown, path: string): TagRecord {
  const record = requireObject(value, path)
  const tag: TagRecord = {
    id: requireNonEmptyString(record, "id", path),
    name: requireString(record, "name", path),
    createdAt: requireString(record, "createdAt", path)
  }

  // Optional since v2.1: merge history. Older backups simply have no aliases.
  if (record.aliases !== undefined) {
    tag.aliases = requireStringArray(record, "aliases", path)
  }

  // Optional since v2.2: two-level taxonomy. Older backups have no parentId.
  const parentId = optionalString(record, "parentId", path)
  if (parentId !== undefined) {
    tag.parentId = parentId
  }

  const updatedAt = optionalString(record, "updatedAt", path)
  if (updatedAt !== undefined) {
    tag.updatedAt = updatedAt
  }

  return tag
}

function validateBookmarkTag(value: unknown, path: string): BookmarkTagRecord {
  const record = requireObject(value, path)
  return {
    id: requireNonEmptyString(record, "id", path),
    bookmarkId: requireNonEmptyString(record, "bookmarkId", path),
    tagId: requireNonEmptyString(record, "tagId", path),
    createdAt: requireString(record, "createdAt", path)
  }
}

function validateSettings(value: unknown, path: string): WorkspaceExportPayload["settings"] {
  const record = requireObject(value, path)
  const locale = requireString(record, "locale", path)
  const themePreference = requireString(record, "themePreference", path)

  if (locale !== "en" && locale !== "zh-CN") {
    throw new Error(`${path}.locale is invalid`)
  }

  if (!["system", "light", "dark"].includes(themePreference)) {
    throw new Error(`${path}.themePreference is invalid`)
  }

  return {
    schemaVersion: requireNumber(record, "schemaVersion", path),
    locale,
    themePreference: themePreference as ExtensionSettings["themePreference"],
    savedViews: record.savedViews === undefined
      ? undefined
      : requireArray(record, "savedViews", path).map((savedView, index) =>
          validateSavedView(savedView, `${path}.savedViews[${index}]`)
        ),
    lastSyncSummary: record.lastSyncSummary === undefined
      ? undefined
      : validateSyncSummary(record.lastSyncSummary, `${path}.lastSyncSummary`),
    // Optional and free-form: an id from a newer version simply falls back to the
    // default provider on restore, and the model is a plain string either way.
    ...(typeof record.activeProviderId === "string" && record.activeProviderId.trim()
      ? { activeProviderId: record.activeProviderId.trim() }
      : {}),
    ...(typeof record.model === "string" && record.model.trim() ? { model: record.model.trim() } : {})
  }
}

function assertUniqueIds(records: Array<{ id?: string }>, path: string) {
  const seen = new Set<string>()

  records.forEach((record, index) => {
    if (!record.id) {
      return
    }

    if (seen.has(record.id)) {
      throw new Error(`${path}[${index}].id must be unique`)
    }

    seen.add(record.id)
  })
}

function buildCounts(payload: WorkspaceExportPayload): WorkspaceBackupCounts {
  return {
    bookmarks: payload.bookmarks.length,
    tags: payload.tags.length,
    bookmarkTags: payload.bookmarkTags.length,
    latestSyncRun: payload.latestSyncRun ? 1 : 0
  }
}

const SUPPORTED_EXPORT_VERSIONS = new Set([1, WORKSPACE_EXPORT_VERSION])

export function validateWorkspaceBackupText(text: string): WorkspaceBackupValidationResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Backup file must be valid JSON")
  }

  const record = requireObject(parsed, "backup")
  const exportVersion = record.exportVersion

  if (typeof exportVersion !== "number" || !SUPPORTED_EXPORT_VERSIONS.has(exportVersion)) {
    throw new Error(`Unsupported backup version: ${String(exportVersion)}`)
  }

  const exportedAt = requireString(record, "exportedAt", "backup")
  const bookmarks = requireArray(record, "bookmarks", "backup").map((bookmark, index) =>
    validateBookmark(bookmark, `bookmarks[${index}]`)
  )
  const tags = requireArray(record, "tags", "backup").map((tag, index) => validateTag(tag, `tags[${index}]`))
  const bookmarkTags = requireArray(record, "bookmarkTags", "backup").map((bookmarkTag, index) =>
    validateBookmarkTag(bookmarkTag, `bookmarkTags[${index}]`)
  )
  const summary = validateSyncSummary(record.summary, "summary")
  const settings = validateSettings(record.settings, "settings")
  const latestSyncRun = record.latestSyncRun === null ? null : validateSyncRun(record.latestSyncRun, "latestSyncRun")
  const payload: WorkspaceExportPayload = {
    exportVersion: WORKSPACE_EXPORT_VERSION,
    schemaVersion: requireNumber(record, "schemaVersion", "backup"),
    exportedAt,
    bookmarks,
    tags,
    bookmarkTags,
    settings,
    summary,
    latestSyncRun
  }

  assertUniqueIds(payload.tags, "tags")
  assertUniqueIds(payload.bookmarkTags, "bookmarkTags")

  const bookmarkIds = new Set(payload.bookmarks.map((bookmark) => bookmark.tweetId))
  const tagIds = new Set(payload.tags.map((tag) => tag.id))

  payload.bookmarkTags.forEach((bookmarkTag, index) => {
    if (!bookmarkIds.has(bookmarkTag.bookmarkId)) {
      throw new Error(`bookmarkTags[${index}].bookmarkId references a missing bookmark`)
    }

    if (!tagIds.has(bookmarkTag.tagId)) {
      throw new Error(`bookmarkTags[${index}].tagId references a missing tag`)
    }
  })

  // The taxonomy is capped at two levels, but a backup file is untrusted input: a
  // cyclic or three-level parent graph cannot be produced by this app's own
  // writes yet was accepted here, and restoring one produced a library whose
  // parent dropdown was locked or whose candidate list the store then rejected.
  const parentIdByTagId = new Map(payload.tags.map((tag) => [tag.id, tag.parentId]))

  payload.tags.forEach((tag, index) => {
    if (!tag.parentId) {
      return
    }

    if (tag.parentId === tag.id) {
      throw new Error(`tags[${index}].parentId cannot point at the tag itself`)
    }

    if (!tagIds.has(tag.parentId)) {
      throw new Error(`tags[${index}].parentId references a missing tag`)
    }

    const grandParentId = parentIdByTagId.get(tag.parentId)
    if (grandParentId) {
      throw new Error(`tags[${index}].parentId makes the tag hierarchy more than two levels deep`)
    }
  })

  return {
    payload,
    counts: buildCounts(payload),
    exportedAt
  }
}

export async function restoreWorkspaceBackup(payload: WorkspaceExportPayload): Promise<WorkspaceRestoreResult> {
  const validation = validateWorkspaceBackupText(JSON.stringify(payload))
  const db = await getBookmarksDb()
  // Suggestions and the analysis ledger are derived from the bookmark set being
  // replaced, so they are cleared with it. Left behind they outlive their
  // bookmarks: a pending row still counts towards the sidebar badge that no
  // bookmark can ever resolve, and an analysis row claims a verdict for a
  // bookmark the backup may not even contain.
  const transaction = db.transaction(
    [
      BOOKMARKS_STORE,
      TAGS_STORE,
      BOOKMARK_TAGS_STORE,
      SYNC_RUNS_STORE,
      TAG_SUGGESTIONS_STORE,
      LLM_ANALYSIS_STORE
    ],
    "readwrite"
  )

  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const syncRunsStore = transaction.objectStore(SYNC_RUNS_STORE)

  await Promise.all([
    requestToPromise(bookmarksStore.clear()),
    requestToPromise(tagsStore.clear()),
    requestToPromise(bookmarkTagsStore.clear()),
    requestToPromise(syncRunsStore.clear()),
    requestToPromise(transaction.objectStore(TAG_SUGGESTIONS_STORE).clear()),
    requestToPromise(transaction.objectStore(LLM_ANALYSIS_STORE).clear())
  ])

  for (const bookmark of validation.payload.bookmarks) {
    bookmarksStore.put(bookmark)
  }

  for (const tag of validation.payload.tags) {
    tagsStore.put(tag)
  }

  for (const bookmarkTag of validation.payload.bookmarkTags) {
    bookmarkTagsStore.put(bookmarkTag)
  }

  if (validation.payload.latestSyncRun) {
    syncRunsStore.put(validation.payload.latestSyncRun)
  }

  await transactionDone(transaction)
  // Backups only carry a subset of settings, so merge instead of overwriting to
  // keep local-only config (auto-tag, sidebar widths, ...) intact.
  await updateSettings((current) => {
    // A tag name blocked by an earlier delete would otherwise survive the restore:
    // the tag comes back, but the rule engine and the LLM still refuse to suggest
    // it, so whole subjects silently stop being auto-taggable after an import.
    const restoredKeys = new Set<string>()
    for (const tag of validation.payload.tags) {
      restoredKeys.add(canonicalTagKey(tag.name))
      for (const alias of tag.aliases ?? []) {
        restoredKeys.add(canonicalTagKey(alias))
      }
    }
    restoredKeys.delete("")

    return {
      schemaVersion: validation.payload.settings.schemaVersion,
      locale: validation.payload.settings.locale,
      themePreference: validation.payload.settings.themePreference,
      lastSyncSummary: validation.payload.settings.lastSyncSummary ?? validation.payload.summary,
      savedViews: validation.payload.settings.savedViews ?? [],
      // Any in-flight run was working against the bookmark set that just got
      // replaced. Clearing the state stops it at its next batch boundary instead of
      // letting it write suggestions for bookmarks that are gone.
      autoTagRunState: undefined,
      autoTag: {
        ...current.autoTag,
        // The picked provider and model travel with a backup; the endpoint and the
        // credential deliberately do not, so a restore never repoints this install
        // at another machine's gateway. An id this version does not know is reduced
        // to the default by normalizeSettings rather than left unresolvable.
        llm: {
          ...current.autoTag.llm,
          ...(validation.payload.settings.activeProviderId
            ? { activeProviderId: validation.payload.settings.activeProviderId }
            : {}),
          ...(validation.payload.settings.model ? { model: validation.payload.settings.model } : {})
        },
        blockedTagKeys: current.autoTag.blockedTagKeys.filter((key) => !restoredKeys.has(key))
      }
    }
  })

  return {
    counts: validation.counts
  }
}
