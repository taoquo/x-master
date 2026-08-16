import { extractHashtags } from "../x/parseBookmarks.ts"
import type { BookmarkRecord } from "../types.ts"
import { BOOKMARKS_STORE, RAW_PAYLOADS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"
import { getSettings, updateSettings } from "./settings.ts"

// Kept in line with upsertBookmarks: one transaction per 500 records.
const BACKFILL_BATCH_SIZE = 500

// One-time, idempotent backfill: extract hashtags for existing bookmarks from
// the raw tweet payloads captured during sync. Guarded by a settings flag so
// it only runs once per profile.
export async function backfillHashtagsFromRawPayloads() {
  const settings = await getSettings()

  if (settings.hashtagBackfillDone) {
    return { updatedCount: 0, skipped: true }
  }

  const db = await getBookmarksDb()
  const readTransaction = db.transaction(BOOKMARKS_STORE, "readonly")
  const allBookmarks = (await requestToPromise(readTransaction.objectStore(BOOKMARKS_STORE).getAll())) as BookmarkRecord[]
  await transactionDone(readTransaction)

  const pending = allBookmarks.filter((bookmark) => bookmark.hashtags === undefined)
  let updatedCount = 0

  // Batched transactions: a single readwrite transaction spanning thousands of
  // records is long enough for the browser to abort it, which used to fail the
  // whole auto-tag run before the LLM step could start.
  for (let offset = 0; offset < pending.length; offset += BACKFILL_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BACKFILL_BATCH_SIZE)
    const transaction = db.transaction([BOOKMARKS_STORE, RAW_PAYLOADS_STORE], "readwrite")
    const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
    const rawPayloadsStore = transaction.objectStore(RAW_PAYLOADS_STORE)

    for (const bookmark of batch) {
      const rawRecord = (await requestToPromise(rawPayloadsStore.get(bookmark.tweetId))) as
        | { payload?: { legacy?: unknown } }
        | undefined
      const hashtags = extractHashtags(rawRecord?.payload?.legacy)

      bookmarksStore.put({ ...bookmark, hashtags })
      updatedCount += 1
    }

    await transactionDone(transaction)
  }

  await updateSettings({ hashtagBackfillDone: true })

  return { updatedCount, skipped: false }
}
