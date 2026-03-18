import type { BookmarkFolderRecord, FolderRecord } from "../types.ts"
import {
  BOOKMARK_FOLDERS_STORE,
  BOOKMARKS_STORE,
  FOLDERS_STORE,
  getBookmarksDb,
  requestToPromise,
  transactionDone
} from "./db.ts"

export const INBOX_FOLDER_ID = "folder-inbox"

export interface FolderTreeNode extends FolderRecord {
  children: FolderTreeNode[]
}

function createInboxFolder(): FolderRecord {
  return {
    id: INBOX_FOLDER_ID,
    name: "Inbox",
    createdAt: new Date().toISOString()
  }
}

export async function ensureInboxFolder(): Promise<FolderRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(FOLDERS_STORE, "readwrite")
  const store = transaction.objectStore(FOLDERS_STORE)
  const existing = await requestToPromise(store.get(INBOX_FOLDER_ID))

  if (existing) {
    await transactionDone(transaction)
    return existing as FolderRecord
  }

  const inboxFolder = createInboxFolder()
  store.put(inboxFolder)
  await transactionDone(transaction)
  return inboxFolder
}

export async function createFolder({
  name,
  parentId
}: {
  name: string
  parentId?: string
}): Promise<FolderRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("Folder name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(FOLDERS_STORE, "readwrite")
  const store = transaction.objectStore(FOLDERS_STORE)
  const folder: FolderRecord = {
    id: `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: trimmedName,
    parentId,
    createdAt: new Date().toISOString()
  }

  store.put(folder)
  await transactionDone(transaction)
  return folder
}

export async function getAllFolders(): Promise<FolderRecord[]> {
  await ensureInboxFolder()
  const db = await getBookmarksDb()
  const transaction = db.transaction(FOLDERS_STORE, "readonly")
  const store = transaction.objectStore(FOLDERS_STORE)
  const folders = await requestToPromise(store.getAll())
  await transactionDone(transaction)

  return (folders as FolderRecord[]).sort((left, right) => {
    if (left.id === INBOX_FOLDER_ID) {
      return -1
    }

    if (right.id === INBOX_FOLDER_ID) {
      return 1
    }

    return left.name.localeCompare(right.name)
  })
}

export async function getAllBookmarkFolders(): Promise<BookmarkFolderRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_FOLDERS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARK_FOLDERS_STORE)
  const bookmarkFolders = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return bookmarkFolders as BookmarkFolderRecord[]
}

export async function moveBookmarkToFolder({
  bookmarkId,
  folderId
}: {
  bookmarkId: string
  folderId: string
}) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_FOLDERS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_FOLDERS_STORE)
  const bookmarkFolder: BookmarkFolderRecord = {
    bookmarkId,
    folderId,
    updatedAt: new Date().toISOString()
  }

  store.put(bookmarkFolder)
  await transactionDone(transaction)
  return bookmarkFolder
}

export async function moveBookmarksToFolder({
  bookmarkIds,
  folderId
}: {
  bookmarkIds: string[]
  folderId: string
}) {
  if (!bookmarkIds.length) {
    return
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_FOLDERS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_FOLDERS_STORE)
  const updatedAt = new Date().toISOString()

  for (const bookmarkId of bookmarkIds) {
    store.put({
      bookmarkId,
      folderId,
      updatedAt
    } satisfies BookmarkFolderRecord)
  }

  await transactionDone(transaction)
}

export async function assignBookmarksToInboxIfMissing(bookmarkIds: string[]) {
  if (!bookmarkIds.length) {
    return
  }

  const inboxFolder = await ensureInboxFolder()
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_FOLDERS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_FOLDERS_STORE)

  for (const bookmarkId of bookmarkIds) {
    const existing = await requestToPromise(store.get(bookmarkId))

    if (!existing) {
      store.put({
        bookmarkId,
        folderId: inboxFolder.id,
        updatedAt: new Date().toISOString()
      } satisfies BookmarkFolderRecord)
    }
  }

  await transactionDone(transaction)
}

export async function ensureBookmarksHaveFolders() {
  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARKS_STORE, BOOKMARK_FOLDERS_STORE], "readonly")
  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarks = await requestToPromise(bookmarksStore.getAll())
  await transactionDone(transaction)

  await assignBookmarksToInboxIfMissing((bookmarks as Array<{ tweetId: string }>).map((bookmark) => bookmark.tweetId))
}

export function buildFolderTree(folders: FolderRecord[]): FolderTreeNode[] {
  const nodeById = new Map<string, FolderTreeNode>()
  const roots: FolderTreeNode[] = []

  for (const folder of folders) {
    nodeById.set(folder.id, {
      ...folder,
      children: []
    })
  }

  for (const folder of folders) {
    const node = nodeById.get(folder.id)
    if (!node) {
      continue
    }

    if (folder.parentId && nodeById.has(folder.parentId)) {
      nodeById.get(folder.parentId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((left, right) => {
      if (left.id === INBOX_FOLDER_ID) {
        return -1
      }

      if (right.id === INBOX_FOLDER_ID) {
        return 1
      }

      return left.name.localeCompare(right.name)
    })

    for (const node of nodes) {
      sortNodes(node.children)
    }
  }

  sortNodes(roots)
  return roots
}

export function getDescendantFolderIds(folders: FolderRecord[], folderId: string) {
  const childrenByParentId = new Map<string, string[]>()

  for (const folder of folders) {
    if (!folder.parentId) {
      continue
    }

    const siblings = childrenByParentId.get(folder.parentId) ?? []
    siblings.push(folder.id)
    childrenByParentId.set(folder.parentId, siblings)
  }

  const ids = new Set<string>()
  const stack = [folderId]

  while (stack.length > 0) {
    const currentFolderId = stack.pop()
    if (!currentFolderId || ids.has(currentFolderId)) {
      continue
    }

    ids.add(currentFolderId)
    const childIds = childrenByParentId.get(currentFolderId) ?? []
    stack.push(...childIds)
  }

  return ids
}
