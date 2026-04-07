import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import {
  assignBookmarksToInboxIfMissing,
  createList,
  deleteList,
  ensureInboxList,
  getAllBookmarkLists,
  getAllLists,
  INBOX_LIST_ID,
  moveBookmarksToList,
  moveBookmarkToList
} from "../../src/lib/storage/listsStore.ts"

test("ensureInboxList creates the default Inbox list", async () => {
  await resetBookmarksDb()

  const inboxList = await ensureInboxList()
  const lists = await getAllLists()

  assert.equal(inboxList.id, INBOX_LIST_ID)
  assert.equal(lists.length, 1)
  assert.equal(lists[0].name, "Inbox")
})

test("assignBookmarksToInboxIfMissing puts imported bookmarks in Inbox", async () => {
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

  const bookmarkLists = await getAllBookmarkLists()
  assert.equal(bookmarkLists.length, 1)
  assert.equal(bookmarkLists[0].bookmarkId, "tweet-1")
  assert.equal(bookmarkLists[0].listId, INBOX_LIST_ID)
})

test("moveBookmarkToList and moveBookmarksToList update primary list assignment", async () => {
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
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      rawPayload: {}
    }
  ])

  await assignBookmarksToInboxIfMissing(["tweet-1", "tweet-2"])
  const researchList = await createList({ name: "Research" })
  const archiveList = await createList({ name: "Archive" })

  await moveBookmarkToList({ bookmarkId: "tweet-1", listId: researchList.id })
  await moveBookmarksToList({ bookmarkIds: ["tweet-1", "tweet-2"], listId: archiveList.id })

  const bookmarkLists = await getAllBookmarkLists()
  assert.equal(bookmarkLists.length, 2)
  assert.equal(bookmarkLists.every((bookmarkList) => bookmarkList.listId === archiveList.id), true)
})

test("deleteList keeps bookmarks and moves them back to Inbox", async () => {
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
  const researchList = await createList({ name: "Research" })
  await moveBookmarkToList({ bookmarkId: "tweet-1", listId: researchList.id })
  await deleteList(researchList.id)

  const lists = await getAllLists()
  const bookmarkLists = await getAllBookmarkLists()

  assert.equal(lists.some((list) => list.id === researchList.id), false)
  assert.equal(bookmarkLists[0].listId, INBOX_LIST_ID)
})
