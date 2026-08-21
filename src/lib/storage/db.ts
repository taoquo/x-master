const DB_NAME = "x-bookmark-manager"
const DB_VERSION = 9
const BOOKMARKS_STORE = "bookmarks"
const TAGS_STORE = "tags"
const BOOKMARK_TAGS_STORE = "bookmark-tags"
const SYNC_RUNS_STORE = "sync-runs"
const RAW_PAYLOADS_STORE = "raw-payloads"
const TAG_SUGGESTIONS_STORE = "tag-suggestions"
// Ledger of what the LLM has already looked at. "Analyzed" used to be inferred
// from suggestion rows, which only exist when the model actually returned a
// usable tag, so every bookmark it deliberately skipped was re-sent on every
// later run and kept newer bookmarks out of the candidate window.
const LLM_ANALYSIS_STORE = "llm-analysis"
const LEGACY_KNOWLEDGE_CARDS_STORE = "knowledge-cards"
const LEGACY_LISTS_STORE = "folders"
const LEGACY_BOOKMARK_LISTS_STORE = "bookmark-folders"

type RequestResult<T> = T extends IDBRequest<infer TResult> ? TResult : never

let dbPromise: Promise<IDBDatabase> | null = null

function openBookmarksDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      const upgradeTransaction = request.transaction

      if (db.objectStoreNames.contains(LEGACY_KNOWLEDGE_CARDS_STORE)) {
        db.deleteObjectStore(LEGACY_KNOWLEDGE_CARDS_STORE)
      }

      if (db.objectStoreNames.contains(LEGACY_LISTS_STORE)) {
        db.deleteObjectStore(LEGACY_LISTS_STORE)
      }

      if (db.objectStoreNames.contains(LEGACY_BOOKMARK_LISTS_STORE)) {
        db.deleteObjectStore(LEGACY_BOOKMARK_LISTS_STORE)
      }

      if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
        db.createObjectStore(BOOKMARKS_STORE, { keyPath: "tweetId" })
      }

      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        db.createObjectStore(TAGS_STORE, { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains(BOOKMARK_TAGS_STORE)) {
        const bookmarkTagsStore = db.createObjectStore(BOOKMARK_TAGS_STORE, { keyPath: "id" })
        bookmarkTagsStore.createIndex("bookmarkId", "bookmarkId", { unique: false })
        bookmarkTagsStore.createIndex("tagId", "tagId", { unique: false })
      }

      if (!db.objectStoreNames.contains(SYNC_RUNS_STORE)) {
        db.createObjectStore(SYNC_RUNS_STORE, { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains(RAW_PAYLOADS_STORE)) {
        db.createObjectStore(RAW_PAYLOADS_STORE, { keyPath: "tweetId" })
        migrateRawPayloadsOutOfBookmarks(upgradeTransaction)
      }

      if (!db.objectStoreNames.contains(TAG_SUGGESTIONS_STORE)) {
        const tagSuggestionsStore = db.createObjectStore(TAG_SUGGESTIONS_STORE, { keyPath: "id" })
        tagSuggestionsStore.createIndex("bookmarkId", "bookmarkId", { unique: false })
        tagSuggestionsStore.createIndex("status", "status", { unique: false })
      }

      if (!db.objectStoreNames.contains(LLM_ANALYSIS_STORE)) {
        db.createObjectStore(LLM_ANALYSIS_STORE, { keyPath: "bookmarkId" })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"))
    }
  })
}

function migrateRawPayloadsOutOfBookmarks(upgradeTransaction: IDBTransaction | null) {
  if (!upgradeTransaction) {
    return
  }

  const bookmarksStore = upgradeTransaction.objectStore(BOOKMARKS_STORE)
  const rawPayloadsStore = upgradeTransaction.objectStore(RAW_PAYLOADS_STORE)
  const cursorRequest = bookmarksStore.openCursor()

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) {
      return
    }

    const bookmark = cursor.value as {
      tweetId?: string
      rawPayload?: unknown
      media?: Array<{ type?: string; url?: string; posterUrl?: string; altText?: string }>
    }
    if (bookmark && "rawPayload" in bookmark) {
      const { rawPayload, ...rest } = bookmark
      if (bookmark.tweetId && rawPayload !== undefined) {
        rawPayloadsStore.put({ tweetId: bookmark.tweetId, payload: rawPayload })
      }
      cursor.update({
        ...rest,
        media: backfillPosterUrls(bookmark.media, rawPayload)
      })
    }

    cursor.continue()
  }
}

function backfillPosterUrls(
  media: Array<{ type?: string; url?: string; posterUrl?: string; altText?: string }> | undefined,
  rawPayload: unknown
) {
  if (!media?.length) {
    return media
  }

  const rawMedia = (rawPayload as { legacy?: { extended_entities?: { media?: Array<Record<string, unknown>> } } } | null | undefined)
    ?.legacy?.extended_entities?.media

  if (!Array.isArray(rawMedia)) {
    return media
  }

  return media.map((item, index) => {
    if (item.posterUrl) {
      return item
    }

    const rawItem = rawMedia[index]
    const posterUrl = rawItem?.media_url_https ?? rawItem?.media_url

    if (typeof posterUrl !== "string" || !posterUrl) {
      return item
    }

    return { ...item, posterUrl }
  })
}

export function requestToPromise<TRequest extends IDBRequest>(request: TRequest) {
  return new Promise<RequestResult<TRequest>>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result as RequestResult<TRequest>)
    }

    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"))
    }
  })
}

export function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"))
  })
}

export async function getBookmarksDb() {
  dbPromise ??= openBookmarksDb()
  return dbPromise
}

export async function resetBookmarksDb() {
  const currentDbPromise = dbPromise
  dbPromise = null

  if (currentDbPromise) {
    const currentDb = await currentDbPromise
    currentDb.close()
  }

  if (typeof indexedDB === "undefined") {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error("Failed to delete IndexedDB database"))
    request.onblocked = () => reject(new Error("Deleting IndexedDB database was blocked"))
  })
}

export async function clearBookmarksDbStores() {
  const db = await getBookmarksDb()
  const transaction = db.transaction(
    [
      BOOKMARKS_STORE,
      TAGS_STORE,
      BOOKMARK_TAGS_STORE,
      SYNC_RUNS_STORE,
      RAW_PAYLOADS_STORE,
      TAG_SUGGESTIONS_STORE,
      LLM_ANALYSIS_STORE
    ],
    "readwrite"
  )

  for (const storeName of transaction.objectStoreNames) {
    transaction.objectStore(storeName).clear()
  }

  await transactionDone(transaction)
}

export {
  BOOKMARKS_STORE,
  TAGS_STORE,
  BOOKMARK_TAGS_STORE,
  SYNC_RUNS_STORE,
  RAW_PAYLOADS_STORE,
  TAG_SUGGESTIONS_STORE,
  LLM_ANALYSIS_STORE,
  DB_NAME,
  DB_VERSION
}
