import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createSyncRun, getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import {
  attachTagToBookmark,
  attachTagToBookmarks,
  createTag,
  detachTagFromBookmark,
  getAllBookmarkTags,
  getAllTags,
  listBookmarksByTag,
  listTagsForBookmark
} from "../../src/lib/storage/tagsStore.ts"

test("createTag stores a tag and getAllTags returns it", async () => {
  await resetBookmarksDb()

  const created = await createTag({ name: "research" })
  const tags = await getAllTags()

  assert.equal(created.name, "research")
  assert.equal(tags.length, 1)
  assert.equal(tags[0].name, "research")
})

test("attachTagToBookmark stores a unique bookmark-tag relation and list helpers resolve both sides", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "taggable",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  const tag = await createTag({ name: "follow-up" })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: tag.id })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: tag.id })

  const bookmarkTags = await getAllBookmarkTags()
  const bookmarkSide = await listTagsForBookmark("tweet-1")
  const tagSide = await listBookmarksByTag(tag.id)

  assert.equal(bookmarkTags.length, 1)
  assert.equal(bookmarkSide.length, 1)
  assert.equal(bookmarkSide[0].name, "follow-up")
  assert.equal(tagSide.length, 1)
  assert.equal(tagSide[0].tweetId, "tweet-1")
})

test("detachTagFromBookmark removes the relation", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "taggable",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  const tag = await createTag({ name: "follow-up" })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: tag.id })
  await detachTagFromBookmark({ bookmarkId: "tweet-1", tagId: tag.id })

  const bookmarkTags = await getAllBookmarkTags()

  assert.equal(bookmarkTags.length, 0)
})

test("attachTagToBookmarks stores one relation per bookmark", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "taggable",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "taggable too",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      rawPayload: {}
    }
  ])

  const tag = await createTag({ name: "follow-up" })
  await attachTagToBookmarks({ bookmarkIds: ["tweet-1", "tweet-2"], tagId: tag.id })

  const bookmarkTags = await getAllBookmarkTags()
  assert.equal(bookmarkTags.length, 2)
  assert.equal(bookmarkTags.every((bookmarkTag) => bookmarkTag.tagId === tag.id), true)
})

test("createSyncRun stores sync runs in IndexedDB and getLatestSyncRun returns the newest one", async () => {
  await resetBookmarksDb()

  await createSyncRun({
    id: "sync-1",
    status: "success",
    startedAt: "2026-03-15T00:00:00.000Z",
    finishedAt: "2026-03-15T00:01:00.000Z",
    fetchedCount: 10,
    insertedCount: 8,
    updatedCount: 2,
    failedCount: 0
  })

  await createSyncRun({
    id: "sync-2",
    status: "partial_success",
    startedAt: "2026-03-15T00:02:00.000Z",
    finishedAt: "2026-03-15T00:03:00.000Z",
    fetchedCount: 12,
    insertedCount: 7,
    updatedCount: 4,
    failedCount: 1
  })

  const syncRun = await getLatestSyncRun()

  assert.equal(syncRun?.id, "sync-2")
  assert.equal(syncRun?.status, "partial_success")
  assert.equal(syncRun?.updatedCount, 4)
})
