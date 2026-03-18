import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import {
  assignBookmarksToInboxIfMissing,
  buildFolderTree,
  createFolder,
  ensureBookmarksHaveFolders,
  ensureInboxFolder,
  getAllBookmarkFolders,
  getAllFolders,
  getDescendantFolderIds,
  INBOX_FOLDER_ID,
  moveBookmarkToFolder
} from "../../src/lib/storage/foldersStore.ts"

test("ensureInboxFolder creates a default Inbox folder", async () => {
  await resetBookmarksDb()

  const inboxFolder = await ensureInboxFolder()
  const folders = await getAllFolders()

  assert.equal(inboxFolder.id, INBOX_FOLDER_ID)
  assert.equal(folders.length, 1)
  assert.equal(folders[0].name, "Inbox")
})

test("createFolder supports nested folders and buildFolderTree nests them recursively", async () => {
  await resetBookmarksDb()

  await ensureInboxFolder()
  const parentFolder = await createFolder({ name: "Projects" })
  const childFolder = await createFolder({ name: "AI", parentId: parentFolder.id })
  const folders = await getAllFolders()
  const tree = buildFolderTree(folders)

  const projectNode = tree.find((node) => node.id === parentFolder.id)
  assert.ok(projectNode)
  assert.equal(projectNode?.children.length, 1)
  assert.equal(projectNode?.children[0].id, childFolder.id)
})

test("ensureBookmarksHaveFolders assigns existing bookmarks to Inbox", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  await ensureBookmarksHaveFolders()

  const bookmarkFolders = await getAllBookmarkFolders()
  assert.equal(bookmarkFolders.length, 1)
  assert.equal(bookmarkFolders[0].bookmarkId, "tweet-1")
  assert.equal(bookmarkFolders[0].folderId, INBOX_FOLDER_ID)
})

test("moveBookmarkToFolder updates bookmark assignment", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  await assignBookmarksToInboxIfMissing(["tweet-1"])
  const folder = await createFolder({ name: "Projects" })
  await moveBookmarkToFolder({ bookmarkId: "tweet-1", folderId: folder.id })

  const bookmarkFolders = await getAllBookmarkFolders()
  assert.equal(bookmarkFolders.length, 1)
  assert.equal(bookmarkFolders[0].folderId, folder.id)
})

test("getDescendantFolderIds includes selected folder and descendants", async () => {
  await resetBookmarksDb()

  const inboxFolder = await ensureInboxFolder()
  const parentFolder = await createFolder({ name: "Projects" })
  const childFolder = await createFolder({ name: "AI", parentId: parentFolder.id })
  const folders = await getAllFolders()
  const ids = getDescendantFolderIds(folders, parentFolder.id)

  assert.equal(ids.has(parentFolder.id), true)
  assert.equal(ids.has(childFolder.id), true)
  assert.equal(ids.has(inboxFolder.id), false)
})
