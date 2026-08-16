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
  deleteTag,
  deleteTags,
  detachTagFromBookmark,
  getAllBookmarkTags,
  getAllTags,
  listBookmarksByTag,
  listTagsForBookmark,
  mergeTags,
  renameTag,
  setTagParent,
  updateTagAliases
} from "../../src/lib/storage/tagsStore.ts"

test("createTag stores a tag and getAllTags returns it", async () => {
  await resetBookmarksDb()

  const created = await createTag({ name: "research" })
  const tags = await getAllTags()

  assert.equal(created.name, "research")
  assert.equal(tags.length, 1)
  assert.equal(tags[0].name, "research")
})

test("createTag reuses the existing tag when the canonical key already exists", async () => {
  await resetBookmarksDb()

  const first = await createTag({ name: "AI Agents" })
  const second = await createTag({ name: "  #ai-agent " })
  const other = await createTag({ name: "Rust" })

  assert.equal(second.id, first.id)
  assert.equal(second.name, "AI Agents")
  assert.notEqual(other.id, first.id)
  assert.equal((await getAllTags()).length, 2)
})

test("mergeTags remaps relations, keeps source names as aliases and deletes the sources", async () => {
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "one",
      createdAtOnX: "2026-01-01T00:00:00.000Z",
      savedAt: "2026-01-01T00:00:00.000Z"
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/alice/status/tweet-2",
      authorName: "Alice",
      authorHandle: "alice",
      text: "two",
      createdAtOnX: "2026-01-01T00:00:00.000Z",
      savedAt: "2026-01-01T00:00:00.000Z"
    }
  ])

  const target = await createTag({ name: "LLM" })
  const sourceA = await createTag({ name: "Large Language Model" })
  const sourceB = await createTag({ name: "GPT" })

  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: target.id })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: sourceA.id })
  await attachTagToBookmark({ bookmarkId: "tweet-2", tagId: sourceB.id })

  const result = await mergeTags({ sourceTagIds: [sourceA.id, sourceB.id, target.id, sourceA.id], targetTagId: target.id })

  assert.deepEqual(result.mergedTagIds, [sourceA.id, sourceB.id])
  // tweet-1 already had the target tag, so only tweet-2 produces a new relation.
  assert.equal(result.remappedCount, 1)
  assert.deepEqual(result.target.aliases, ["Large Language Model", "GPT"])

  const tags = await getAllTags()
  assert.deepEqual(
    tags.map((tag) => tag.id),
    [target.id]
  )

  const bookmarkTags = await getAllBookmarkTags()
  assert.deepEqual(
    bookmarkTags.map((relation) => relation.id).sort(),
    [`tweet-1:${target.id}`, `tweet-2:${target.id}`].sort()
  )

  assert.equal((await listBookmarksByTag(target.id)).length, 2)
})

test("mergeTags is idempotent and rejects an unknown target", async () => {
  await resetBookmarksDb()

  const target = await createTag({ name: "LLM" })

  const noop = await mergeTags({ sourceTagIds: [], targetTagId: target.id })
  assert.deepEqual(noop.mergedTagIds, [])
  assert.equal(noop.remappedCount, 0)
  assert.equal(noop.target.aliases, undefined)

  const missing = await mergeTags({ sourceTagIds: ["tag-missing"], targetTagId: target.id })
  assert.deepEqual(missing.mergedTagIds, [])

  await assert.rejects(
    () => mergeTags({ sourceTagIds: [target.id], targetTagId: "tag-unknown" }),
    /Target tag not found/
  )
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
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "taggable too",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
    }
  ])

  const tag = await createTag({ name: "follow-up" })
  await attachTagToBookmarks({ bookmarkIds: ["tweet-1", "tweet-2"], tagId: tag.id })

  const bookmarkTags = await getAllBookmarkTags()
  assert.equal(bookmarkTags.length, 2)
  assert.equal(bookmarkTags.every((bookmarkTag) => bookmarkTag.tagId === tag.id), true)
})

test("renameTag updates the stored tag name", async () => {
  await resetBookmarksDb()

  const created = await createTag({ name: "follow-up" })
  const renamed = await renameTag({ tagId: created.id, name: "deep-read" })
  const tags = await getAllTags()

  assert.equal(renamed.name, "deep-read")
  assert.equal(tags[0]?.name, "deep-read")
})

test("deleteTag removes the tag and all of its bookmark relations", async () => {
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
    }
  ])

  const tag = await createTag({ name: "follow-up" })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: tag.id })
  await deleteTag(tag.id)

  const tags = await getAllTags()
  const bookmarkTags = await getAllBookmarkTags()

  assert.equal(tags.length, 0)
  assert.equal(bookmarkTags.length, 0)
})

test("deleteTags removes every listed tag, its relations and unparents survivors", async () => {
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
    }
  ])

  const theme = await createTag({ name: "ai" })
  const child = await createTag({ name: "ai agents" })
  const doomed = await createTag({ name: "misc" })
  const survivor = await createTag({ name: "rust" })
  await setTagParent({ tagId: child.id, parentId: theme.id })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: doomed.id })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: survivor.id })

  const result = await deleteTags([theme.id, doomed.id, "tag-unknown", ""])

  assert.deepEqual(result.deletedTagIds.sort(), [doomed.id, theme.id, "tag-unknown"].sort())

  const tags = await getAllTags()
  assert.deepEqual(tags.map((tag) => tag.id).sort(), [child.id, survivor.id].sort())
  // The surviving child no longer points at the deleted theme.
  assert.equal(tags.find((tag) => tag.id === child.id)?.parentId, undefined)

  const bookmarkTags = await getAllBookmarkTags()
  assert.deepEqual(bookmarkTags.map((relation) => relation.tagId), [survivor.id])
})

test("deleteTags is a no-op for an empty list", async () => {
  await resetBookmarksDb()

  const tag = await createTag({ name: "keep" })
  const result = await deleteTags([])

  assert.deepEqual(result.deletedTagIds, [])
  assert.deepEqual((await getAllTags()).map((item) => item.id), [tag.id])
})

test("setTagParent assigns and clears a parent tag", async () => {
  await resetBookmarksDb()

  const theme = await createTag({ name: "ai" })
  const child = await createTag({ name: "ai agents" })

  const parented = await setTagParent({ tagId: child.id, parentId: theme.id })
  assert.equal(parented.parentId, theme.id)
  assert.ok(parented.updatedAt)

  const cleared = await setTagParent({ tagId: child.id })
  assert.equal(cleared.parentId, undefined)
  assert.equal(Object.hasOwn(cleared, "parentId"), false)

  const stored = await getAllTags()
  assert.equal(stored.find((tag) => tag.id === child.id)?.parentId, undefined)
})

test("setTagParent rejects self parenting, unknown parents and a third level", async () => {
  await resetBookmarksDb()

  const theme = await createTag({ name: "ai" })
  const child = await createTag({ name: "ai agents" })
  const grandchild = await createTag({ name: "agent memory" })
  await setTagParent({ tagId: child.id, parentId: theme.id })

  await assert.rejects(() => setTagParent({ tagId: child.id, parentId: child.id }), /own parent/)
  await assert.rejects(() => setTagParent({ tagId: child.id, parentId: "tag-missing" }), /Parent tag not found/)
  // theme already has a child, so it cannot become a child itself.
  await assert.rejects(() => setTagParent({ tagId: theme.id, parentId: grandchild.id }), /two levels/)
  // child already has a parent, so it cannot become a parent.
  await assert.rejects(() => setTagParent({ tagId: grandchild.id, parentId: child.id }), /two levels/)
  await assert.rejects(() => setTagParent({ tagId: "tag-missing", parentId: theme.id }), /Tag not found/)
})

test("updateTagAliases normalizes aliases and drops collisions", async () => {
  await resetBookmarksDb()

  const tag = await createTag({ name: "ai agents" })
  await createTag({ name: "design" })

  const updated = await updateTagAliases({
    tagId: tag.id,
    aliases: ["  #Agentic  ", "agentic", "AI Agent", "design", "", "LLM Agents"]
  })

  assert.deepEqual(updated.aliases, ["Agentic", "LLM Agents"])

  const emptied = await updateTagAliases({ tagId: tag.id, aliases: ["   "] })
  assert.equal(emptied.aliases, undefined)
  assert.equal(Object.hasOwn(emptied, "aliases"), false)
  await assert.rejects(() => updateTagAliases({ tagId: "tag-missing", aliases: [] }), /Tag not found/)
})

test("deleteTag and mergeTags keep the hierarchy consistent", async () => {
  await resetBookmarksDb()

  const theme = await createTag({ name: "ai" })
  const child = await createTag({ name: "ai agents" })
  await setTagParent({ tagId: child.id, parentId: theme.id })
  await deleteTag(theme.id)

  const afterDelete = await getAllTags()
  assert.equal(afterDelete.length, 1)
  assert.equal(afterDelete[0].parentId, undefined)

  const survivor = await createTag({ name: "tooling" })
  const doomedTheme = await createTag({ name: "infra" })
  const orphanedChild = await createTag({ name: "kubernetes" })
  await setTagParent({ tagId: orphanedChild.id, parentId: doomedTheme.id })
  await mergeTags({ sourceTagIds: [doomedTheme.id], targetTagId: survivor.id })

  const afterMerge = await getAllTags()
  assert.equal(afterMerge.some((tag) => tag.id === doomedTheme.id), false)
  assert.equal(afterMerge.find((tag) => tag.id === orphanedChild.id)?.parentId, survivor.id)
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
