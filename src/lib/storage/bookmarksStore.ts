import type { BookmarkRecord, SiteTweetDraft } from "../types.ts"
import {
  BOOKMARK_LISTS_STORE,
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  getBookmarksDb,
  requestToPromise,
  transactionDone
} from "./db.ts"
import type { BookmarkTagRecord } from "../types.ts"

type StoredBookmark = BookmarkRecord & { updatedAt?: string; id?: string }

export async function upsertBookmarks(bookmarks: BookmarkRecord[]) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  let insertedCount = 0
  let updatedCount = 0

  for (const bookmark of bookmarks) {
    const existing = (await requestToPromise(store.get(bookmark.tweetId))) as StoredBookmark | undefined
    const timestamp = new Date().toISOString()
    const savedAt = String(existing?.savedAt ?? bookmark.savedAt ?? timestamp)
    const lastSeenAt = String(bookmark.lastSeenAt ?? bookmark.savedAt ?? existing?.lastSeenAt ?? existing?.savedAt ?? timestamp)

    store.put({
      ...existing,
      ...bookmark,
      savedAt,
      lastSeenAt,
      bookmarkTimelineRank: bookmark.bookmarkTimelineRank ?? existing?.bookmarkTimelineRank,
      id: bookmark.id ?? bookmark.tweetId,
      updatedAt: timestamp
    })

    if (existing) {
      updatedCount += 1
    } else {
      insertedCount += 1
    }
  }

  await transactionDone(transaction)

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
    text: existing?.text || snapshot.text,
    createdAtOnX: existing?.createdAtOnX || snapshot.createdAtOnX,
    savedAt: existing?.savedAt || now,
    lastSeenAt: now,
    bookmarkTimelineRank: existing?.bookmarkTimelineRank ?? temporaryTimelineRank,
    media: existing?.media,
    metrics: existing?.metrics,
    rawPayload: existing?.rawPayload ?? { source: "site-inline-tagging" },
    updatedAt: now
  }

  store.put(nextBookmark)
  await transactionDone(transaction)

  return nextBookmark
}

export async function removeBookmarkSnapshot(bookmarkId: string) {
  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARKS_STORE, BOOKMARK_LISTS_STORE, BOOKMARK_TAGS_STORE], "readwrite")
  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarkListsStore = transaction.objectStore(BOOKMARK_LISTS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const relatedBookmarkTags = (await requestToPromise(bookmarkTagsStore.index("bookmarkId").getAll(bookmarkId))) as BookmarkTagRecord[]

  bookmarksStore.delete(bookmarkId)
  bookmarkListsStore.delete(bookmarkId)

  for (const bookmarkTag of relatedBookmarkTags) {
    bookmarkTagsStore.delete(bookmarkTag.id)
  }

  await transactionDone(transaction)
}
