const DB_NAME = "x-bookmark-manager"
const DB_VERSION = 3
const BOOKMARKS_STORE = "bookmarks"
const FOLDERS_STORE = "folders"
const BOOKMARK_FOLDERS_STORE = "bookmark-folders"
const TAGS_STORE = "tags"
const BOOKMARK_TAGS_STORE = "bookmark-tags"
const SYNC_RUNS_STORE = "sync-runs"

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

      if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
        db.createObjectStore(BOOKMARKS_STORE, { keyPath: "tweetId" })
      }

      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        const foldersStore = db.createObjectStore(FOLDERS_STORE, { keyPath: "id" })
        foldersStore.createIndex("parentId", "parentId", { unique: false })
      }

      if (!db.objectStoreNames.contains(BOOKMARK_FOLDERS_STORE)) {
        const bookmarkFoldersStore = db.createObjectStore(BOOKMARK_FOLDERS_STORE, { keyPath: "bookmarkId" })
        bookmarkFoldersStore.createIndex("folderId", "folderId", { unique: false })
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
  FOLDERS_STORE,
  BOOKMARK_FOLDERS_STORE,
  TAGS_STORE,
  BOOKMARK_TAGS_STORE,
  SYNC_RUNS_STORE,
  DB_NAME,
  DB_VERSION
}
