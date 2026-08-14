import { getAllBookmarks, upsertBookmarks } from "../lib/storage/bookmarksStore.ts"
import { upsertRawPayloads } from "../lib/storage/rawPayloadsStore.ts"
import { getSettings, saveSettings } from "../lib/storage/settings.ts"
import { createSyncRun } from "../lib/storage/syncRunsStore.ts"
import {
  createEmptySyncSummary,
  type BookmarkRecord,
  type ExtensionSettings,
  type RawPayloadRecord,
  type SyncSummary,
  type SyncRunRecord
} from "../lib/types.ts"
import { extractCsrfToken, getXCookieHeader } from "../lib/x/auth.ts"
import { fetchBookmarksPage } from "../lib/x/client.ts"
import { fetchAllBookmarks } from "../lib/x/paginateBookmarks.ts"
import { normalizeSyncError } from "../lib/x/syncErrors.ts"

const DEFAULT_SYNC_LIMIT = 10000
const DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES = 3
const SYNC_STRATEGY_VERSION = 1

interface SyncResult {
  fetchedCount: number
  insertedCount: number
  updatedCount: number
  failedCount: number
}

interface RunBookmarkSyncOptions {
  getXCookieHeader?: typeof getXCookieHeader
  fetchAllBookmarks?: typeof fetchAllBookmarks
  fetchBookmarksPage?: typeof fetchBookmarksPage
  syncLimit?: number
  upsertBookmarks?: (bookmarks: BookmarkRecord[]) => Promise<{ insertedCount: number; updatedCount: number }>
  upsertRawPayloads?: (rawPayloads: RawPayloadRecord[]) => Promise<void>
  createSyncRun?: (syncRun: SyncRunRecord) => Promise<void>
  updateSyncSummary?: (summary: SyncSummary) => Promise<void>
  getSettings?: typeof getSettings
  saveSettings?: (settings: ExtensionSettings) => Promise<void>
}

type SaveCompleteSettings = (settings: ExtensionSettings) => Promise<void>

function createSummary(summary: Partial<SyncSummary>): SyncSummary {
  return {
    ...createEmptySyncSummary(),
    ...summary
  }
}

async function defaultUpdateSyncSummary(
  summary: SyncSummary,
  readSettings: typeof getSettings,
  writeSettings: SaveCompleteSettings
) {
  const settings = await readSettings()
  const lastSyncSummary: SyncSummary = {
    ...settings.lastSyncSummary,
    ...summary
  }

  if (summary.errorKind === undefined) {
    delete lastSyncSummary.errorKind
  }

  if (summary.errorSummary === undefined) {
    delete lastSyncSummary.errorSummary
  }

  await writeSettings({
    ...settings,
    lastSyncSummary
  })
}

async function persistSummary(
  summary: SyncSummary,
  updateSyncSummary: RunBookmarkSyncOptions["updateSyncSummary"],
  readSettings: typeof getSettings,
  writeSettings: SaveCompleteSettings
) {
  if (updateSyncSummary) {
    await updateSyncSummary(summary)
    return
  }

  await defaultUpdateSyncSummary(summary, readSettings, writeSettings)
}

export async function runBookmarkSync({
  getXCookieHeader: getCookieHeader = getXCookieHeader,
  fetchAllBookmarks: paginateBookmarks = fetchAllBookmarks,
  fetchBookmarksPage: loadBookmarksPage = fetchBookmarksPage,
  syncLimit = DEFAULT_SYNC_LIMIT,
  upsertBookmarks: saveBookmarks = upsertBookmarks,
  upsertRawPayloads: saveRawPayloads = upsertRawPayloads,
  createSyncRun: persistSyncRun = createSyncRun,
  updateSyncSummary,
  getSettings: readSettings = getSettings,
  saveSettings: writeSettings = saveSettings
}: RunBookmarkSyncOptions = {}): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const syncRunId = `sync-${startedAt}`

  await persistSummary(
    createSummary({
      status: "running",
      errorKind: undefined,
      errorSummary: undefined
    }),
    updateSyncSummary,
    readSettings,
    writeSettings
  )

  await persistSyncRun({
    id: syncRunId,
    status: "running",
    startedAt,
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 0
  })

  try {
    const settings = await readSettings()
    const cookieHeader = await getCookieHeader()
    const csrfToken = extractCsrfToken(cookieHeader)
    const hasCompletedInitialFullSync = Boolean(settings.hasCompletedInitialFullSync)
    const incrementalStopBufferPages =
      settings.incrementalStopBufferPages && settings.incrementalStopBufferPages > 0
        ? settings.incrementalStopBufferPages
        : DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES
    const knownBookmarkIds = hasCompletedInitialFullSync
      ? new Set((await getAllBookmarks()).map((bookmark) => bookmark.tweetId))
      : null
    const { bookmarks, failedCount } = await paginateBookmarks({
      limit: syncLimit,
      stopAfterConsecutiveKnownPages: hasCompletedInitialFullSync ? incrementalStopBufferPages : undefined,
      isExistingBookmark: knownBookmarkIds
        ? (bookmark) => {
            const tweetId = bookmark.tweetId
            if (!tweetId) {
              return false
            }

            const isKnown = knownBookmarkIds.has(tweetId)
            if (!isKnown) {
              knownBookmarkIds.add(tweetId)
            }

            return isKnown
          }
        : undefined,
      fetchPage: ({ cursor }) =>
        loadBookmarksPage({
          cursor,
          requestContext: {
            cookieHeader,
            csrfToken
          }
        })
    })

    const rawPayloads: RawPayloadRecord[] = []
    const normalizedBookmarks = bookmarks.map((bookmark) => {
      const { rawPayload, ...bookmarkFields } = bookmark as BookmarkRecord & { rawPayload?: unknown }

      if (bookmarkFields.tweetId && rawPayload !== undefined) {
        rawPayloads.push({ tweetId: bookmarkFields.tweetId, payload: rawPayload })
      }

      return bookmarkFields as BookmarkRecord
    })
    const { insertedCount, updatedCount } = await saveBookmarks(normalizedBookmarks)
    await saveRawPayloads(rawPayloads)

    if (!hasCompletedInitialFullSync) {
      await writeSettings({
        ...settings,
        syncStrategyVersion: SYNC_STRATEGY_VERSION,
        hasCompletedInitialFullSync: true,
        incrementalStopBufferPages
      })
    }

    const finishedAt = new Date().toISOString()
    const status = failedCount > 0 ? "partial_success" : "success"
    const summary = createSummary({
      status,
      fetchedCount: normalizedBookmarks.length,
      insertedCount,
      updatedCount,
      failedCount,
      lastSyncedAt: finishedAt,
      errorKind: undefined,
      errorSummary: undefined
    })

    await persistSyncRun({
      id: syncRunId,
      status,
      startedAt,
      finishedAt,
      fetchedCount: normalizedBookmarks.length,
      insertedCount,
      updatedCount,
      failedCount
    })

    await persistSummary(summary, updateSyncSummary, readSettings, writeSettings)

    return {
      fetchedCount: normalizedBookmarks.length,
      insertedCount,
      updatedCount,
      failedCount
    }
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const { kind: errorKind, summary: errorSummary } = normalizeSyncError(error)
    const summary = createSummary({
      status: "error",
      failedCount: 1,
      lastSyncedAt: finishedAt,
      errorKind,
      errorSummary
    })

    await persistSyncRun({
      id: syncRunId,
      status: "error",
      startedAt,
      finishedAt,
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 1,
      errorKind,
      errorSummary
    })

    await persistSummary(summary, updateSyncSummary, readSettings, writeSettings)
    throw new Error(errorSummary)
  }
}
