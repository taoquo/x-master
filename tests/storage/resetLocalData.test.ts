import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { DB_NAME, DB_VERSION, resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { createSyncRun, getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import { attachTagToBookmark, createTag, getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { getSecrets, saveSecrets } from "../../src/lib/storage/secrets.ts"

function openIndependentBookmarksDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open independent IndexedDB connection"))
  })
}

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
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "system",
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

  await resetLocalData()

  assert.equal((await getAllBookmarks()).length, 0)
  assert.equal((await getAllTags()).length, 0)
  assert.equal((await getAllBookmarkTags()).length, 0)
  assert.equal(await getLatestSyncRun(), null)

  const settings = await getSettings()
  assert.equal(settings.schemaVersion, 6)
  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "system")
  assert.equal(settings.lastSyncSummary.status, "idle")
  assert.equal(settings.lastSyncSummary.errorSummary, undefined)
  assert.equal(settings.syncStrategyVersion, 1)
  assert.equal(settings.hasCompletedInitialFullSync, false)
  assert.equal(settings.incrementalStopBufferPages, 3)
})

test("resetLocalData clears the stored LLM API key", async () => {
  const store: Record<string, unknown> = {}

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key?: string) => (key ? { [key]: store[key] } : { ...store }),
        set: async (value: Record<string, unknown>) => {
          Object.assign(store, value)
        }
      }
    }
  }

  await saveSecrets({ llmApiKey: "sk-live-must-not-survive-reset" })
  assert.equal((await getSecrets()).llmApiKey, "sk-live-must-not-survive-reset")

  await resetLocalData()

  // The key lives in its own storage key, so it used to survive a full reset even
  // though the confirmation promises every local setting is cleared.
  assert.deepEqual(await getSecrets(), {})
})

test("resetLocalData is not blocked by another open IndexedDB connection", async () => {
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

  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-open-connection",
      tweetUrl: "https://x.com/alice/status/tweet-open-connection",
      authorName: "Alice",
      authorHandle: "alice",
      text: "open connection should not block reset",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
    }
  ])

  const independentDb = await openIndependentBookmarksDb()

  try {
    await resetLocalData()

    assert.equal((await getAllBookmarks()).length, 0)
    assert.equal((await getSettings()).locale, "en")
  } finally {
    independentDb.close()
    await resetBookmarksDb()
  }
})
