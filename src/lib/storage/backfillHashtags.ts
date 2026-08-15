import { extractHashtags } from "../x/parseBookmarks.ts"
import type { BookmarkRecord } from "../types.ts"
import { BOOKMARKS_STORE, RAW_PAYLOADS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"
import { getSettings, updateSettings } from "./settings.ts"

// One-time, idempotent backfill: extract hashtags for existing bookmarks from
// the raw tweet payloads captured during sync. Guarded by a settings flag so
// it only runs once per profile.
export async function backfillHashtagsFromRawPayloads() {
  const settings = await getSettings()

  if (settings.hashtagBackfillDone) {
    return { updatedCount: 0, skipped: true }
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARKS_STORE, RAW_PAYLOADS_STORE], "readwrite")
  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const rawPayloadsStore = transaction.objectStore(RAW_PAYLOADS_STORE)
  const bookmarks = (await requestToPromise(bookmarksStore.getAll())) as BookmarkRecord[]
  let updatedCount = 0

  for (const bookmark of bookmarks) {
    if (bookmark.hashtags !== undefined) {
      continue
    }

    const rawRecord = (await requestToPromise(rawPayloadsStore.get(bookmark.tweetId))) as
      | { payload?: { legacy?: unknown } }
      | undefined
    const hashtags = extractHashtags(rawRecord?.payload?.legacy)

    bookmarksStore.put({ ...bookmark, hashtags })
    updatedCount += 1
  }

  await transactionDone(transaction)
  await updateSettings({ hashtagBackfillDone: true })

  return { updatedCount, skipped: false }
}
