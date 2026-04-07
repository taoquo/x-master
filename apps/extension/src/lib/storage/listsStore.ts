import type { BookmarkListRecord, ListRecord } from "../types.ts"
import {
  BOOKMARK_LISTS_STORE,
  getBookmarksDb,
  LISTS_STORE,
  requestToPromise,
  transactionDone
} from "./db.ts"

export const INBOX_LIST_ID = "list-inbox"

function createInboxList(): ListRecord {
  return {
    id: INBOX_LIST_ID,
    name: "Inbox",
    createdAt: new Date().toISOString()
  }
}

function toListRecord(record: { id: string; name?: string; createdAt?: string } | undefined): ListRecord | null {
  if (!record?.id) {
    return null
  }

  return {
    id: record.id,
    name: String(record.name ?? "Untitled"),
    createdAt: String(record.createdAt ?? new Date().toISOString())
  }
}

function toBookmarkListRecord(
  record:
    | {
        bookmarkId: string
        listId?: string
        folderId?: string
        updatedAt?: string
      }
    | undefined
): BookmarkListRecord | null {
  if (!record?.bookmarkId) {
    return null
  }

  return {
    bookmarkId: record.bookmarkId,
    listId: String(record.listId ?? record.folderId ?? INBOX_LIST_ID),
    updatedAt: String(record.updatedAt ?? new Date().toISOString())
  }
}

export async function ensureInboxList(): Promise<ListRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(LISTS_STORE, "readwrite")
  const store = transaction.objectStore(LISTS_STORE)
  const existing = toListRecord((await requestToPromise(store.get(INBOX_LIST_ID))) as { id: string; name?: string; createdAt?: string } | undefined)

  if (existing) {
    await transactionDone(transaction)
    return existing
  }

  const inboxList = createInboxList()
  store.put(inboxList)
  await transactionDone(transaction)
  return inboxList
}

export async function getAllLists(): Promise<ListRecord[]> {
  await ensureInboxList()
  const db = await getBookmarksDb()
  const transaction = db.transaction(LISTS_STORE, "readonly")
  const store = transaction.objectStore(LISTS_STORE)
  const records = (await requestToPromise(store.getAll())) as Array<{ id: string; name?: string; createdAt?: string }>
  await transactionDone(transaction)

  return records
    .map(toListRecord)
    .filter(Boolean)
    .sort((left, right) => {
      if (!left || !right) {
        return 0
      }

      if (left.id === INBOX_LIST_ID) {
        return -1
      }

      if (right.id === INBOX_LIST_ID) {
        return 1
      }

      return left.name.localeCompare(right.name)
    }) as ListRecord[]
}

export async function createList({ name }: { name: string }): Promise<ListRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("List name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(LISTS_STORE, "readwrite")
  const store = transaction.objectStore(LISTS_STORE)
  const list: ListRecord = {
    id: `list-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: trimmedName,
    createdAt: new Date().toISOString()
  }

  store.put(list)
  await transactionDone(transaction)
  return list
}

export async function renameList({
  listId,
  name
}: {
  listId: string
  name: string
}): Promise<ListRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("List name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(LISTS_STORE, "readwrite")
  const store = transaction.objectStore(LISTS_STORE)
  const existing = toListRecord((await requestToPromise(store.get(listId))) as { id: string; name?: string; createdAt?: string } | undefined)

  if (!existing) {
    throw new Error("List not found")
  }

  if (existing.id === INBOX_LIST_ID) {
    throw new Error("Inbox cannot be renamed")
  }

  const updated: ListRecord = {
    ...existing,
    name: trimmedName
  }

  store.put(updated)
  await transactionDone(transaction)
  return updated
}

export async function getAllBookmarkLists(): Promise<BookmarkListRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_LISTS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARK_LISTS_STORE)
  const records = (await requestToPromise(store.getAll())) as Array<{
    bookmarkId: string
    listId?: string
    folderId?: string
    updatedAt?: string
  }>
  await transactionDone(transaction)

  return records.map(toBookmarkListRecord).filter(Boolean) as BookmarkListRecord[]
}

export async function moveBookmarkToList({
  bookmarkId,
  listId
}: {
  bookmarkId: string
  listId: string
}) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_LISTS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_LISTS_STORE)
  const bookmarkList: BookmarkListRecord = {
    bookmarkId,
    listId,
    updatedAt: new Date().toISOString()
  }

  store.put(bookmarkList)
  await transactionDone(transaction)
  return bookmarkList
}

export async function moveBookmarksToList({
  bookmarkIds,
  listId
}: {
  bookmarkIds: string[]
  listId: string
}) {
  if (!bookmarkIds.length) {
    return
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_LISTS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_LISTS_STORE)
  const updatedAt = new Date().toISOString()

  for (const bookmarkId of bookmarkIds) {
    store.put({
      bookmarkId,
      listId,
      updatedAt
    } satisfies BookmarkListRecord)
  }

  await transactionDone(transaction)
}

export async function assignBookmarksToInboxIfMissing(bookmarkIds: string[]) {
  if (!bookmarkIds.length) {
    return
  }

  await ensureInboxList()
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_LISTS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_LISTS_STORE)

  for (const bookmarkId of bookmarkIds) {
    const existing = toBookmarkListRecord(
      (await requestToPromise(store.get(bookmarkId))) as {
        bookmarkId: string
        listId?: string
        folderId?: string
        updatedAt?: string
      } | undefined
    )

    if (existing) {
      continue
    }

    store.put({
      bookmarkId,
      listId: INBOX_LIST_ID,
      updatedAt: new Date().toISOString()
    } satisfies BookmarkListRecord)
  }

  await transactionDone(transaction)
}

export async function deleteList(listId: string) {
  if (listId === INBOX_LIST_ID) {
    throw new Error("Inbox cannot be deleted")
  }

  await ensureInboxList()
  const db = await getBookmarksDb()
  const transaction = db.transaction([LISTS_STORE, BOOKMARK_LISTS_STORE], "readwrite")
  const listsStore = transaction.objectStore(LISTS_STORE)
  const bookmarkListsStore = transaction.objectStore(BOOKMARK_LISTS_STORE)
  const bookmarkLists = (await requestToPromise(bookmarkListsStore.getAll())) as Array<{
    bookmarkId: string
    listId?: string
    folderId?: string
    updatedAt?: string
  }>

  for (const record of bookmarkLists) {
    const bookmarkList = toBookmarkListRecord(record)
    if (!bookmarkList || bookmarkList.listId !== listId) {
      continue
    }

    bookmarkListsStore.put({
      bookmarkId: bookmarkList.bookmarkId,
      listId: INBOX_LIST_ID,
      updatedAt: new Date().toISOString()
    } satisfies BookmarkListRecord)
  }

  listsStore.delete(listId)
  await transactionDone(transaction)
}
