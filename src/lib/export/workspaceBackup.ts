import type {
  BookmarkListRecord,
  BookmarkRecord,
  BookmarkTagRecord,
  ClassificationRule,
  ExtensionSettings,
  ListRecord,
  SyncRunRecord,
  SyncSummary,
  TagRecord
} from "../types.ts"
import {
  BOOKMARK_LISTS_STORE,
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  getBookmarksDb,
  LISTS_STORE,
  requestToPromise,
  SYNC_RUNS_STORE,
  TAGS_STORE,
  transactionDone
} from "../storage/db.ts"
import { saveSettings } from "../storage/settings.ts"
import {
  WORKSPACE_EXPORT_VERSION,
  type WorkspaceExportBookmarkRecord,
  type WorkspaceExportPayload
} from "./exportBookmarks.ts"

export interface WorkspaceBackupCounts {
  bookmarks: number
  lists: number
  bookmarkLists: number
  tags: number
  bookmarkTags: number
  classificationRules: number
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
    updatedAt: optionalString(record, "updatedAt", path)
  }
}

function validateList(value: unknown, path: string): ListRecord {
  const record = requireObject(value, path)
  return {
    id: requireNonEmptyString(record, "id", path),
    name: requireString(record, "name", path),
    createdAt: requireString(record, "createdAt", path)
  }
}

function validateBookmarkList(value: unknown, path: string): BookmarkListRecord {
  const record = requireObject(value, path)
  return {
    bookmarkId: requireNonEmptyString(record, "bookmarkId", path),
    listId: requireNonEmptyString(record, "listId", path),
    updatedAt: requireString(record, "updatedAt", path)
  }
}

function validateTag(value: unknown, path: string): TagRecord {
  const record = requireObject(value, path)
  return {
    id: requireNonEmptyString(record, "id", path),
    name: requireString(record, "name", path),
    createdAt: requireString(record, "createdAt", path)
  }
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

function validateRule(value: unknown, path: string): ClassificationRule {
  const record = requireObject(value, path)
  return {
    id: requireNonEmptyString(record, "id", path),
    name: requireString(record, "name", path),
    enabled: requireBoolean(record, "enabled", path),
    authorHandles: requireStringArray(record, "authorHandles", path),
    keywords: requireStringArray(record, "keywords", path),
    requireMedia: requireBoolean(record, "requireMedia", path),
    requireLongform: requireBoolean(record, "requireLongform", path),
    targetTagIds: requireStringArray(record, "targetTagIds", path)
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
    classificationRules: requireArray(record, "classificationRules", path).map((rule, index) =>
      validateRule(rule, `${path}.classificationRules[${index}]`)
    ),
    lastSyncSummary: record.lastSyncSummary === undefined
      ? undefined
      : validateSyncSummary(record.lastSyncSummary, `${path}.lastSyncSummary`)
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
    lists: payload.lists.length,
    bookmarkLists: payload.bookmarkLists.length,
    tags: payload.tags.length,
    bookmarkTags: payload.bookmarkTags.length,
    classificationRules: payload.classificationRules.length,
    latestSyncRun: payload.latestSyncRun ? 1 : 0
  }
}

export function validateWorkspaceBackupText(text: string): WorkspaceBackupValidationResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Backup file must be valid JSON")
  }

  const record = requireObject(parsed, "backup")
  const exportVersion = record.exportVersion

  if (exportVersion !== WORKSPACE_EXPORT_VERSION) {
    throw new Error(`Unsupported backup version: ${String(exportVersion)}`)
  }

  const exportedAt = requireString(record, "exportedAt", "backup")
  const bookmarks = requireArray(record, "bookmarks", "backup").map((bookmark, index) =>
    validateBookmark(bookmark, `bookmarks[${index}]`)
  )
  const lists = requireArray(record, "lists", "backup").map((list, index) => validateList(list, `lists[${index}]`))
  const bookmarkLists = requireArray(record, "bookmarkLists", "backup").map((bookmarkList, index) =>
    validateBookmarkList(bookmarkList, `bookmarkLists[${index}]`)
  )
  const tags = requireArray(record, "tags", "backup").map((tag, index) => validateTag(tag, `tags[${index}]`))
  const bookmarkTags = requireArray(record, "bookmarkTags", "backup").map((bookmarkTag, index) =>
    validateBookmarkTag(bookmarkTag, `bookmarkTags[${index}]`)
  )
  const classificationRules = requireArray(record, "classificationRules", "backup").map((rule, index) =>
    validateRule(rule, `classificationRules[${index}]`)
  )
  const summary = validateSyncSummary(record.summary, "summary")
  const settings = validateSettings(record.settings, "settings")
  const latestSyncRun = record.latestSyncRun === null ? null : validateSyncRun(record.latestSyncRun, "latestSyncRun")
  const payload: WorkspaceExportPayload = {
    exportVersion,
    schemaVersion: requireNumber(record, "schemaVersion", "backup"),
    exportedAt,
    bookmarks,
    lists,
    bookmarkLists,
    tags,
    bookmarkTags,
    classificationRules,
    settings,
    summary,
    latestSyncRun
  }

  assertUniqueIds(payload.lists, "lists")
  assertUniqueIds(payload.tags, "tags")
  assertUniqueIds(payload.bookmarkTags, "bookmarkTags")
  assertUniqueIds(payload.classificationRules, "classificationRules")

  const bookmarkIds = new Set(payload.bookmarks.map((bookmark) => bookmark.tweetId))
  const listIds = new Set(payload.lists.map((list) => list.id))
  const tagIds = new Set(payload.tags.map((tag) => tag.id))

  payload.bookmarkLists.forEach((bookmarkList, index) => {
    if (!bookmarkIds.has(bookmarkList.bookmarkId)) {
      throw new Error(`bookmarkLists[${index}].bookmarkId references a missing bookmark`)
    }

    if (!listIds.has(bookmarkList.listId)) {
      throw new Error(`bookmarkLists[${index}].listId references a missing list`)
    }
  })

  payload.bookmarkTags.forEach((bookmarkTag, index) => {
    if (!bookmarkIds.has(bookmarkTag.bookmarkId)) {
      throw new Error(`bookmarkTags[${index}].bookmarkId references a missing bookmark`)
    }

    if (!tagIds.has(bookmarkTag.tagId)) {
      throw new Error(`bookmarkTags[${index}].tagId references a missing tag`)
    }
  })

  for (const [ruleIndex, rule] of payload.classificationRules.entries()) {
    rule.targetTagIds.forEach((tagId, tagIndex) => {
      if (!tagIds.has(tagId)) {
        throw new Error(`classificationRules[${ruleIndex}].targetTagIds[${tagIndex}] references a missing tag`)
      }
    })
  }

  return {
    payload,
    counts: buildCounts(payload),
    exportedAt
  }
}

function restoreBookmark(bookmark: WorkspaceExportBookmarkRecord): BookmarkRecord {
  return {
    ...bookmark,
    rawPayload: {
      source: "workspace-restore"
    }
  }
}

export async function restoreWorkspaceBackup(payload: WorkspaceExportPayload): Promise<WorkspaceRestoreResult> {
  const validation = validateWorkspaceBackupText(JSON.stringify(payload))
  const db = await getBookmarksDb()
  const transaction = db.transaction(
    [BOOKMARKS_STORE, LISTS_STORE, BOOKMARK_LISTS_STORE, TAGS_STORE, BOOKMARK_TAGS_STORE, SYNC_RUNS_STORE],
    "readwrite"
  )

  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const listsStore = transaction.objectStore(LISTS_STORE)
  const bookmarkListsStore = transaction.objectStore(BOOKMARK_LISTS_STORE)
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const syncRunsStore = transaction.objectStore(SYNC_RUNS_STORE)

  await Promise.all([
    requestToPromise(bookmarksStore.clear()),
    requestToPromise(listsStore.clear()),
    requestToPromise(bookmarkListsStore.clear()),
    requestToPromise(tagsStore.clear()),
    requestToPromise(bookmarkTagsStore.clear()),
    requestToPromise(syncRunsStore.clear())
  ])

  for (const bookmark of validation.payload.bookmarks) {
    bookmarksStore.put(restoreBookmark(bookmark))
  }

  for (const list of validation.payload.lists) {
    listsStore.put(list)
  }

  for (const bookmarkList of validation.payload.bookmarkLists) {
    bookmarkListsStore.put(bookmarkList)
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
  await saveSettings({
    schemaVersion: validation.payload.settings.schemaVersion,
    locale: validation.payload.settings.locale,
    themePreference: validation.payload.settings.themePreference,
    lastSyncSummary: validation.payload.settings.lastSyncSummary ?? validation.payload.summary,
    classificationRules: validation.payload.classificationRules
  })

  return {
    counts: validation.counts
  }
}
