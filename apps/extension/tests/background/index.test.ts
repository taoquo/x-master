import test from "node:test"
import assert from "node:assert/strict"
import { createBackgroundMessageHandler, openOrFocusOptionsPage, OPTIONS_PAGE_PATH } from "../../src/background/index.ts"
import { LOAD_POPUP_DATA_MESSAGE, REGENERATE_CARD_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "../../src/lib/runtime/messages.ts"

test("background message handler loads popup data", async () => {
  const handler = createBackgroundMessageHandler({
    loadPopupData: async () => ({
      bookmarks: [],
      sourceMaterials: [],
      knowledgeCards: [],
      tags: [],
      bookmarkTags: [],
      aiGeneration: {
        enabled: false,
        provider: "openai",
        apiKey: "",
        model: "gpt-5-mini"
      },
      exportScope: "all",
      hasCompletedOnboarding: false,
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
    }),
    regenerateCard: async () => ({ success: true })
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
      sourceMaterials: [],
      knowledgeCards: [],
      tags: [],
      bookmarkTags: [],
      aiGeneration: {
        enabled: false,
        provider: "openai",
        apiKey: "",
        model: "gpt-5-mini"
      },
      exportScope: "all",
      hasCompletedOnboarding: false,
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
    }),
    regenerateCard: async () => ({ success: true })
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
      sourceMaterials: [],
      knowledgeCards: [],
      tags: [],
      bookmarkTags: [],
      aiGeneration: {
        enabled: false,
        provider: "openai",
        apiKey: "",
        model: "gpt-5-mini"
      },
      exportScope: "all",
      hasCompletedOnboarding: false,
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
    }),
    regenerateCard: async () => ({ success: true })
  })

  const response = (await handler({ type: RESET_LOCAL_DATA_MESSAGE })) as { success: boolean }

  assert.equal(response.success, true)
})

test("background message handler regenerates a single knowledge card draft", async () => {
  let receivedCardId: string | null = null

  const handler = createBackgroundMessageHandler({
    loadPopupData: async () => ({
      bookmarks: [],
      sourceMaterials: [],
      knowledgeCards: [],
      tags: [],
      bookmarkTags: [],
      aiGeneration: {
        enabled: false,
        provider: "openai",
        apiKey: "",
        model: "gpt-5-mini"
      },
      exportScope: "all",
      hasCompletedOnboarding: false,
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
    }),
    regenerateCard: async (cardId) => {
      receivedCardId = cardId
      return { success: true }
    }
  })

  const response = (await handler({ type: REGENERATE_CARD_MESSAGE, cardId: "card-1" })) as { success: boolean }

  assert.equal(receivedCardId, "card-1")
  assert.equal(response.success, true)
})

test("openOrFocusOptionsPage focuses an existing options tab", async () => {
  let updatedTabId: number | null = null
  let focusedWindowId: number | null = null

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://extension-id/${path}`
    },
    tabs: {
      query: async () => [{ id: 12, windowId: 34 }],
      update: async (tabId: number) => {
        updatedTabId = tabId
      },
      create: async () => {}
    },
    windows: {
      update: async (windowId: number) => {
        focusedWindowId = windowId
      }
    }
  }

  await openOrFocusOptionsPage()

  assert.equal(updatedTabId, 12)
  assert.equal(focusedWindowId, 34)
})

test("openOrFocusOptionsPage creates a new options tab when none exist", async () => {
  let createdTabUrl: string | null = null

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://extension-id/${path}`
    },
    tabs: {
      query: async () => [],
      update: async () => {},
      create: async ({ url }: { url: string }) => {
        createdTabUrl = url
      }
    }
  }

  await openOrFocusOptionsPage()

  assert.equal(createdTabUrl, `chrome-extension://extension-id/${OPTIONS_PAGE_PATH}`)
})
