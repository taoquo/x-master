import { collectRuleTagAssignments } from "../lib/classification/rules.ts"
import { assignBookmarksToInboxIfMissing } from "../lib/storage/listsStore.ts"
import { upsertBookmarks } from "../lib/storage/bookmarksStore.ts"
import { getSettings, saveSettings } from "../lib/storage/settings.ts"
import { createSyncRun } from "../lib/storage/syncRunsStore.ts"
import { attachBookmarkTags, getAllBookmarkTags, getAllTags } from "../lib/storage/tagsStore.ts"
import { createEmptySyncSummary, type BookmarkRecord, type SyncSummary, type SyncRunRecord } from "../lib/types.ts"
import { extractCsrfToken, getXCookieHeader } from "../lib/x/auth.ts"
import { fetchBookmarksPage } from "../lib/x/client.ts"
import { fetchAllBookmarks } from "../lib/x/paginateBookmarks.ts"

const DEFAULT_SYNC_LIMIT = 1000

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
  assignBookmarksToInboxIfMissing?: (bookmarkIds: string[]) => Promise<void>
  getAllBookmarkTags?: typeof getAllBookmarkTags
  attachBookmarkTags?: (relations: Array<{ bookmarkId: string; tagId: string }>) => Promise<number>
  getAllTags?: typeof getAllTags
  createSyncRun?: (syncRun: SyncRunRecord) => Promise<void>
  updateSyncSummary?: (summary: SyncSummary) => Promise<void>
  getSettings?: typeof getSettings
  saveSettings?: typeof saveSettings
}

function createSummary(summary: Partial<SyncSummary>): SyncSummary {
  return {
    ...createEmptySyncSummary(),
    ...summary
  }
}

async function defaultUpdateSyncSummary(
  summary: SyncSummary,
  readSettings: typeof getSettings,
  writeSettings: typeof saveSettings
) {
  const settings = await readSettings()
  await writeSettings({
    ...settings,
    lastSyncSummary: {
      ...settings.lastSyncSummary,
      ...summary
    }
  })
}

async function persistSummary(
  summary: SyncSummary,
  updateSyncSummary: RunBookmarkSyncOptions["updateSyncSummary"],
  readSettings: typeof getSettings,
  writeSettings: typeof saveSettings
) {
  if (updateSyncSummary) {
    await updateSyncSummary(summary)
    return
  }

  await defaultUpdateSyncSummary(summary, readSettings, writeSettings)
}

function toErrorSummary(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function runBookmarkSync({
  getXCookieHeader: getCookieHeader = getXCookieHeader,
  fetchAllBookmarks: paginateBookmarks = fetchAllBookmarks,
  fetchBookmarksPage: loadBookmarksPage = fetchBookmarksPage,
  syncLimit = DEFAULT_SYNC_LIMIT,
  upsertBookmarks: saveBookmarks = upsertBookmarks,
  assignBookmarksToInboxIfMissing: ensureBookmarkLists = assignBookmarksToInboxIfMissing,
  getAllBookmarkTags: loadBookmarkTags = getAllBookmarkTags,
  attachBookmarkTags: saveBookmarkTags = attachBookmarkTags,
  getAllTags: loadTags = getAllTags,
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
    const { bookmarks, failedCount } = await paginateBookmarks({
      limit: syncLimit,
      fetchPage: ({ cursor }) =>
        loadBookmarksPage({
          cursor,
          requestContext: {
            cookieHeader,
            csrfToken
          }
        })
    })

    const normalizedBookmarks = bookmarks as BookmarkRecord[]
    const { insertedCount, updatedCount } = await saveBookmarks(normalizedBookmarks)
    await ensureBookmarkLists(normalizedBookmarks.map((bookmark) => bookmark.tweetId))

    const [bookmarkTags, tags] = await Promise.all([loadBookmarkTags(), loadTags()])
    const ruleAssignments = collectRuleTagAssignments({
      bookmarks: normalizedBookmarks,
      rules: settings.classificationRules,
      existingBookmarkTags: bookmarkTags,
      validTagIds: new Set(tags.map((tag) => tag.id))
    })

    if (ruleAssignments.length > 0) {
      await saveBookmarkTags(ruleAssignments)
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
    const errorSummary = toErrorSummary(error)
    const summary = createSummary({
      status: "error",
      failedCount: 1,
      lastSyncedAt: finishedAt,
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
      errorSummary
    })

    await persistSummary(summary, updateSyncSummary, readSettings, writeSettings)
    throw error
  }
}
