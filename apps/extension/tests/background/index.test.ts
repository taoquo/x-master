import test from "node:test"
import assert from "node:assert/strict"
import { createBackgroundMessageHandler } from "../../src/background/index.ts"
import { LOAD_POPUP_DATA_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "../../src/lib/runtime/messages.ts"

test("background message handler loads popup data", async () => {
  const handler = createBackgroundMessageHandler({
    loadPopupData: async () => ({
      bookmarks: [],
      folders: [],
      bookmarkFolders: [],
      tags: [],
      bookmarkTags: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      }
    }),
    resetData: async () => ({ success: true }),
    runSync: async () => ({
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0
    })
  })

  const response = (await handler({ type: LOAD_POPUP_DATA_MESSAGE })) as {
    bookmarks: unknown[]
    summary: { status: string }
  }

  assert.equal(response.summary.status, "idle")
  assert.equal(response.bookmarks.length, 0)
})

test("background message handler runs sync", async () => {
  const handler = createBackgroundMessageHandler({
    loadPopupData: async () => ({
      bookmarks: [],
      folders: [],
      bookmarkFolders: [],
      tags: [],
      bookmarkTags: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      }
    }),
    resetData: async () => ({ success: true }),
    runSync: async () => ({
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0
    })
  })

  const response = (await handler({ type: RUN_SYNC_MESSAGE })) as {
    fetchedCount: number
    insertedCount: number
  }

  assert.equal(response.fetchedCount, 1)
  assert.equal(response.insertedCount, 1)
})

test("background message handler resets local data", async () => {
  const handler = createBackgroundMessageHandler({
    loadPopupData: async () => ({
      bookmarks: [],
      folders: [],
      bookmarkFolders: [],
      tags: [],
      bookmarkTags: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      }
    }),
    resetData: async () => ({ success: true }),
    runSync: async () => ({
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0
    })
  })

  const response = (await handler({ type: RESET_LOCAL_DATA_MESSAGE })) as { success: boolean }

  assert.equal(response.success, true)
})
