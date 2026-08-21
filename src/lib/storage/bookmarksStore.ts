import type { BookmarkRecord, SiteTweetDraft } from "../types.ts"
import {
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  LLM_ANALYSIS_STORE,
  RAW_PAYLOADS_STORE,
  getBookmarksDb,
  requestToPromise,
  transactionDone
} from "./db.ts"
import type { BookmarkTagRecord } from "../types.ts"

type StoredBookmark = BookmarkRecord & { updatedAt?: string; id?: string }

const UPSERT_BATCH_SIZE = 500

export async function upsertBookmarks(bookmarks: BookmarkRecord[]) {
  let insertedCount = 0
  let updatedCount = 0

  if (!bookmarks.length) {
    return { insertedCount, updatedCount }
  }

  const db = await getBookmarksDb()

  for (let offset = 0; offset < bookmarks.length; offset += UPSERT_BATCH_SIZE) {
    const batch = bookmarks.slice(offset, offset + UPSERT_BATCH_SIZE)
    const transaction = db.transaction(BOOKMARKS_STORE, "readwrite")
    const store = transaction.objectStore(BOOKMARKS_STORE)
    const existingRecords = await Promise.all(
      batch.map((bookmark) => requestToPromise(store.get(bookmark.tweetId)) as Promise<StoredBookmark | undefined>)
    )
    const timestamp = new Date().toISOString()
    const pendingPuts = new Map<string, StoredBookmark>()

    batch.forEach((bookmark, index) => {
      const { rawPayload: _legacyRawPayload, ...bookmarkFields } = bookmark as BookmarkRecord & { rawPayload?: unknown }
      const existing = pendingPuts.get(bookmark.tweetId) ?? existingRecords[index]
      const savedAt = String(existing?.savedAt ?? bookmark.savedAt ?? timestamp)
      const lastSeenAt = String(bookmark.lastSeenAt ?? bookmark.savedAt ?? existing?.lastSeenAt ?? existing?.savedAt ?? timestamp)

      const nextRecord: StoredBookmark = {
        ...existing,
        ...bookmarkFields,
        savedAt,
        lastSeenAt,
        authorAvatarUrl: bookmark.authorAvatarUrl ?? existing?.authorAvatarUrl,
        bookmarkTimelineRank: bookmark.bookmarkTimelineRank ?? existing?.bookmarkTimelineRank,
        id: bookmark.id ?? bookmark.tweetId,
        updatedAt: timestamp
      }

      store.put(nextRecord)
      pendingPuts.set(bookmark.tweetId, nextRecord)

      if (existing) {
        updatedCount += 1
      } else {
        insertedCount += 1
      }
    })

    await transactionDone(transaction)
  }

  return { insertedCount, updatedCount }
}

export async function getAllBookmarks() {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarks = await requestToPromise(store.getAll())
  await transactionDone(transaction)

  return (bookmarks as StoredBookmark[]).sort((left, right) => {
    return String(right.savedAt ?? "").localeCompare(String(left.savedAt ?? ""))
  })
}

export async function getAllBookmarkIds() {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  const keys = await requestToPromise(store.getAllKeys())
  await transactionDone(transaction)

  return keys.map((key) => String(key))
}

export async function upsertBookmarkSnapshot(snapshot: SiteTweetDraft): Promise<BookmarkRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  const existing = (await requestToPromise(store.get(snapshot.tweetId))) as StoredBookmark | undefined
  const now = new Date().toISOString()
  const temporaryTimelineRank = -Date.now()

  const nextBookmark: StoredBookmark = {
    id: existing?.id ?? snapshot.tweetId,
    tweetId: snapshot.tweetId,
    tweetUrl: existing?.tweetUrl || snapshot.tweetUrl,
    authorName: existing?.authorName || snapshot.authorName,
    authorHandle: existing?.authorHandle || snapshot.authorHandle,
    authorAvatarUrl: existing?.authorAvatarUrl || snapshot.authorAvatarUrl,
    text: existing?.text || snapshot.text,
    createdAtOnX: existing?.createdAtOnX || snapshot.createdAtOnX,
    savedAt: existing?.savedAt || now,
    lastSeenAt: now,
    bookmarkTimelineRank: existing?.bookmarkTimelineRank ?? temporaryTimelineRank,
    media: existing?.media,
    metrics: existing?.metrics,
    updatedAt: now
  }

  store.put(nextBookmark)
  await transactionDone(transaction)

  return nextBookmark
}

export async function removeBookmarkSnapshot(bookmarkId: string) {
  const db = await getBookmarksDb()
  // The analysis ledger is keyed by bookmark, so it has to be cleaned up with
  // the bookmark. A row left behind would claim a re-added bookmark was already
  // analyzed and keep it out of the queue forever.
  const transaction = db.transaction(
    [BOOKMARKS_STORE, BOOKMARK_TAGS_STORE, RAW_PAYLOADS_STORE, LLM_ANALYSIS_STORE],
    "readwrite"
  )
  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const relatedBookmarkTags = (await requestToPromise(bookmarkTagsStore.index("bookmarkId").getAll(bookmarkId))) as BookmarkTagRecord[]

  bookmarksStore.delete(bookmarkId)
  transaction.objectStore(RAW_PAYLOADS_STORE).delete(bookmarkId)
  transaction.objectStore(LLM_ANALYSIS_STORE).delete(bookmarkId)

  for (const bookmarkTag of relatedBookmarkTags) {
    bookmarkTagsStore.delete(bookmarkTag.id)
  }

  await transactionDone(transaction)
}
