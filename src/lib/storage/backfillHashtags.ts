import { extractHashtags } from "../x/parseBookmarks.ts"
import type { BookmarkRecord } from "../types.ts"
import { BOOKMARKS_STORE, RAW_PAYLOADS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"
import { getSettings, updateSettings } from "./settings.ts"

// Kept in line with upsertBookmarks: one transaction per 500 records.
const BACKFILL_BATCH_SIZE = 500

// Idempotent backfill: extract hashtags for existing bookmarks from the raw tweet
// payloads captured during sync. The settings flag records that the one-time pass
// has happened, but it is not the only condition: `hashtags === undefined` means
// "unknown", which is also the state a bookmark arrives in when it is restored
// from a backup taken before the field existed. Trusting the flag alone left those
// bookmarks permanently without hashtags, because the backfill is the only thing
// that can fill them in.
export async function backfillHashtagsFromRawPayloads() {
  const settings = await getSettings()
  const db = await getBookmarksDb()
  const readTransaction = db.transaction(BOOKMARKS_STORE, "readonly")
  const allBookmarks = (await requestToPromise(readTransaction.objectStore(BOOKMARKS_STORE).getAll())) as BookmarkRecord[]
  await transactionDone(readTransaction)

  const pending = allBookmarks.filter((bookmark) => bookmark.hashtags === undefined)

  if (settings.hashtagBackfillDone && pending.length === 0) {
    return { updatedCount: 0, skipped: true }
  }

  let updatedCount = 0

  // Batched transactions: a single readwrite transaction spanning thousands of
  // records is long enough for the browser to abort it, which used to fail the
  // whole auto-tag run before the LLM step could start.
  for (let offset = 0; offset < pending.length; offset += BACKFILL_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BACKFILL_BATCH_SIZE)
    const transaction = db.transaction([BOOKMARKS_STORE, RAW_PAYLOADS_STORE], "readwrite")
    const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
    const rawPayloadsStore = transaction.objectStore(RAW_PAYLOADS_STORE)

    for (const snapshot of batch) {
      // Re-read inside the transaction instead of writing the snapshot back.
      // The snapshot was taken before this batch started, so writing it blind
      // reverted any bookmark edit made meanwhile and could resurrect a bookmark
      // that had been deleted in the gap.
      const current = (await requestToPromise(bookmarksStore.get(snapshot.tweetId))) as BookmarkRecord | undefined

      if (!current || current.hashtags !== undefined) {
        continue
      }

      const rawRecord = (await requestToPromise(rawPayloadsStore.get(current.tweetId))) as
        | { payload?: { legacy?: unknown } }
        | undefined

      // No raw payload means no evidence either way, so this records "known to
      // have no hashtags" (`[]`) rather than leaving it unknown. That is what
      // stops the bookmark from being retried on every future pass; a later sync
      // overwrites it from the parsed entities.
      bookmarksStore.put({ ...current, hashtags: extractHashtags(rawRecord?.payload?.legacy) })
      updatedCount += 1
    }

    await transactionDone(transaction)
  }

  await updateSettings({ hashtagBackfillDone: true })

  return { updatedCount, skipped: false }
}
