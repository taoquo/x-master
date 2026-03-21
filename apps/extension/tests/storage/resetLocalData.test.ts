import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { getAllKnowledgeCardDrafts, upsertKnowledgeCardDraftsForSourceMaterials } from "../../src/lib/storage/knowledgeCardsStore.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { createSyncRun, getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import { attachTagToBookmark, createTag, getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"

test("resetLocalData clears IndexedDB stores and resets extension settings", async () => {
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
    schemaVersion: 2,
    hasCompletedOnboarding: true,
    aiGeneration: {
      enabled: true,
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-5-mini"
    },
    exportScope: "reviewed",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-03-15T00:01:00.000Z",
      errorSummary: "old error"
    }
  })
  await upsertKnowledgeCardDraftsForSourceMaterials([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    }
  ])

  await resetLocalData()

  assert.equal((await getAllBookmarks()).length, 0)
  assert.equal((await getAllKnowledgeCardDrafts()).length, 0)
  assert.equal((await getAllTags()).length, 0)
  assert.equal((await getAllBookmarkTags()).length, 0)
  assert.equal(await getLatestSyncRun(), null)

  const settings = await getSettings()
  assert.equal(settings.schemaVersion, 2)
  assert.equal(settings.hasCompletedOnboarding, false)
  assert.equal(settings.lastSyncSummary.status, "idle")
  assert.equal(settings.lastSyncSummary.errorSummary, undefined)
  assert.equal(settings.exportScope, "all")
})
