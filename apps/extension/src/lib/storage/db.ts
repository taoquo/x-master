const DB_NAME = "x-bookmark-manager"
const DB_VERSION = 5
const BOOKMARKS_STORE = "bookmarks"
const LISTS_STORE = "folders"
const BOOKMARK_LISTS_STORE = "bookmark-folders"
const TAGS_STORE = "tags"
const BOOKMARK_TAGS_STORE = "bookmark-tags"
const SYNC_RUNS_STORE = "sync-runs"
const LEGACY_KNOWLEDGE_CARDS_STORE = "knowledge-cards"

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

      if (db.objectStoreNames.contains(LEGACY_KNOWLEDGE_CARDS_STORE)) {
        db.deleteObjectStore(LEGACY_KNOWLEDGE_CARDS_STORE)
      }

      if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
        db.createObjectStore(BOOKMARKS_STORE, { keyPath: "tweetId" })
      }

      if (!db.objectStoreNames.contains(LISTS_STORE)) {
        db.createObjectStore(LISTS_STORE, { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains(BOOKMARK_LISTS_STORE)) {
        db.createObjectStore(BOOKMARK_LISTS_STORE, { keyPath: "bookmarkId" })
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
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"))
    }
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

export {
  BOOKMARKS_STORE,
  LISTS_STORE,
  BOOKMARK_LISTS_STORE,
  TAGS_STORE,
  BOOKMARK_TAGS_STORE,
  SYNC_RUNS_STORE,
  DB_NAME,
  DB_VERSION
}
