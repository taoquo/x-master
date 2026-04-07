import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { createList, getAllBookmarkLists, getAllLists, moveBookmarkToList } from "../../src/lib/storage/listsStore.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { createSyncRun, getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import { attachTagToBookmark, createTag, getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"

test("resetLocalData clears IndexedDB stores and resets reduced extension settings", async () => {
  let storedValue: unknown

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async (value: Record<string, unknown>) => {
          storedValue = value.settings
        }
      }
    }
  }

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

  const researchList = await createList({ name: "Research" })
  await moveBookmarkToList({ bookmarkId: "tweet-1", listId: researchList.id })

  const tag = await createTag({ name: "research" })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: tag.id })
  await createSyncRun({
    id: "sync-1",
    status: "success",
    startedAt: "2026-03-15T00:00:00.000Z",
    finishedAt: "2026-03-15T00:01:00.000Z",
    fetchedCount: 1,
    insertedCount: 1,
    updatedCount: 0,
    failedCount: 0
  })
  await saveSettings({
    schemaVersion: 3,
    lastSyncSummary: {
      status: "success",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-03-15T00:01:00.000Z",
      errorSummary: "old error"
    },
    classificationRules: [
      {
        id: "rule-1",
        name: "AI",
        enabled: true,
        authorHandles: ["alice"],
        keywords: ["hello"],
        requireMedia: false,
        requireLongform: false,
        targetTagIds: [tag.id]
      }
    ]
  })

  await resetLocalData()

  assert.equal((await getAllBookmarks()).length, 0)
  assert.equal((await getAllLists()).length, 1)
  assert.equal((await getAllBookmarkLists()).length, 0)
  assert.equal((await getAllTags()).length, 0)
  assert.equal((await getAllBookmarkTags()).length, 0)
  assert.equal(await getLatestSyncRun(), null)

  const settings = await getSettings()
  assert.equal(settings.schemaVersion, 3)
  assert.equal(settings.lastSyncSummary.status, "idle")
  assert.equal(settings.lastSyncSummary.errorSummary, undefined)
  assert.deepEqual(settings.classificationRules, [])
})
