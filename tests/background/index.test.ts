import test from "node:test"
import assert from "node:assert/strict"
import { createBackgroundMessageHandler, openOrFocusOptionsPage, OPTIONS_PAGE_PATH } from "../../src/background/index.ts"
import {
  LOAD_WORKSPACE_DATA_MESSAGE,
  RESET_LOCAL_DATA_MESSAGE,
  RUN_SYNC_MESSAGE,
  SITE_TWEET_BOOKMARK_SYNC_MESSAGE,
  SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE,
  SITE_TWEET_TAGGING_PREPARE_MESSAGE,
  SITE_TWEET_TAGGING_SET_TAG_MESSAGE
} from "../../src/lib/runtime/messages.ts"

test("background message handler loads workspace data", async () => {
  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => ({
      bookmarks: [],
      lists: [],
      bookmarkLists: [],
      tags: [],
      bookmarkTags: [],
      classificationRules: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      stats: {
        totalBookmarks: 0,
        inboxCount: 0,
        unclassifiedCount: 0,
        listCounts: [],
        tagCounts: [],
        topAuthors: []
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

  const response = (await handler({ type: LOAD_WORKSPACE_DATA_MESSAGE })) as {
    bookmarks: unknown[]
    summary: { status: string }
    stats: { totalBookmarks: number }
  }

  assert.equal(response.summary.status, "idle")
  assert.equal(response.bookmarks.length, 0)
  assert.equal(response.stats.totalBookmarks, 0)
})

test("background message handler runs sync", async () => {
  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => ({
      bookmarks: [],
      lists: [],
      bookmarkLists: [],
      tags: [],
      bookmarkTags: [],
      classificationRules: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      stats: {
        totalBookmarks: 0,
        inboxCount: 0,
        unclassifiedCount: 0,
        listCounts: [],
        tagCounts: [],
        topAuthors: []
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
    loadWorkspaceData: async () => ({
      bookmarks: [],
      lists: [],
      bookmarkLists: [],
      tags: [],
      bookmarkTags: [],
      classificationRules: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      stats: {
        totalBookmarks: 0,
        inboxCount: 0,
        unclassifiedCount: 0,
        listCounts: [],
        tagCounts: [],
        topAuthors: []
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

test("background message handler prepares site tweet tagging state", async () => {
  let receivedTweetId: string | null = null

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => ({
      bookmarks: [],
      lists: [],
      bookmarkLists: [],
      tags: [],
      bookmarkTags: [],
      classificationRules: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      stats: {
        totalBookmarks: 0,
        inboxCount: 0,
        unclassifiedCount: 0,
        listCounts: [],
        tagCounts: [],
        topAuthors: []
      }
    }),
    resetData: async () => ({ success: true }),
    runSync: async () => ({
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0
    }),
    prepareSiteTweetTagging: async ({ tweet }) => {
      receivedTweetId = tweet.tweetId
      return {
        bookmarkId: tweet.tweetId,
        tags: [{ id: "tag-1", name: "AI", createdAt: "2026-04-01T00:00:00.000Z" }],
        selectedTagIds: ["tag-1"]
      }
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "tweet-123",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "tweet-123",
      createdTag: { id: "tag-2", name: "Research", createdAt: "2026-04-01T00:00:00.000Z" },
      tags: [],
      selectedTagIds: ["tag-2"]
    })
  })

  const response = await handler({
    type: SITE_TWEET_TAGGING_PREPARE_MESSAGE,
    tweet: {
      tweetId: "tweet-123",
      tweetUrl: "https://x.com/alice/status/tweet-123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Hello from X",
      createdAtOnX: "2026-04-01T00:00:00.000Z"
    }
  })

  assert.equal(receivedTweetId, "tweet-123")
  assert.deepEqual(response, {
    bookmarkId: "tweet-123",
    tags: [{ id: "tag-1", name: "AI", createdAt: "2026-04-01T00:00:00.000Z" }],
    selectedTagIds: ["tag-1"]
  })
})

test("background message handler routes site tag toggles and site tag creation", async () => {
  const calls: string[] = []

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => ({
      bookmarks: [],
      lists: [],
      bookmarkLists: [],
      tags: [],
      bookmarkTags: [],
      classificationRules: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      stats: {
        totalBookmarks: 0,
        inboxCount: 0,
        unclassifiedCount: 0,
        listCounts: [],
        tagCounts: [],
        topAuthors: []
      }
    }),
    resetData: async () => ({ success: true }),
    runSync: async () => ({
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "tweet-123",
      tags: [],
      selectedTagIds: []
    }),
    setSiteTweetTag: async ({ enabled }) => {
      calls.push(enabled ? "attach" : "detach")
      return {
        bookmarkId: "tweet-123",
        tags: [],
        selectedTagIds: enabled ? ["tag-1"] : []
      }
    },
    createSiteTweetTag: async ({ name }) => {
      calls.push(`create:${name}`)
      return {
        bookmarkId: "tweet-123",
        createdTag: { id: "tag-2", name, createdAt: "2026-04-01T00:00:00.000Z" },
        tags: [{ id: "tag-2", name, createdAt: "2026-04-01T00:00:00.000Z" }],
        selectedTagIds: ["tag-2"]
      }
    }
  })

  await handler({
    type: SITE_TWEET_TAGGING_SET_TAG_MESSAGE,
    bookmarkId: "tweet-123",
    tagId: "tag-1",
    enabled: true
  })
  await handler({
    type: SITE_TWEET_TAGGING_SET_TAG_MESSAGE,
    bookmarkId: "tweet-123",
    tagId: "tag-1",
    enabled: false
  })
  const created = await handler({
    type: SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE,
    bookmarkId: "tweet-123",
    name: "Research"
  })

  assert.deepEqual(calls, ["attach", "detach", "create:Research"])
  assert.deepEqual(created, {
    bookmarkId: "tweet-123",
    createdTag: { id: "tag-2", name: "Research", createdAt: "2026-04-01T00:00:00.000Z" },
    tags: [{ id: "tag-2", name: "Research", createdAt: "2026-04-01T00:00:00.000Z" }],
    selectedTagIds: ["tag-2"]
  })
})

test("background message handler routes site bookmark sync", async () => {
  const calls: Array<{ tweetId: string; enabled: boolean }> = []

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => ({
      bookmarks: [],
      lists: [],
      bookmarkLists: [],
      tags: [],
      bookmarkTags: [],
      classificationRules: [],
      latestSyncRun: null,
      summary: {
        status: "idle",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      },
      stats: {
        totalBookmarks: 0,
        inboxCount: 0,
        unclassifiedCount: 0,
        listCounts: [],
        tagCounts: [],
        topAuthors: []
      }
    }),
    resetData: async () => ({ success: true }),
    runSync: async () => ({
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    }),
    syncSiteTweetBookmark: async ({ tweet, enabled }) => {
      calls.push({ tweetId: tweet.tweetId, enabled })
      return { bookmarkId: tweet.tweetId, enabled }
    }
  })

  const response = await handler({
    type: SITE_TWEET_BOOKMARK_SYNC_MESSAGE,
    tweet: {
      tweetId: "tweet-123",
      tweetUrl: "https://x.com/alice/status/tweet-123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Hello from X",
      createdAtOnX: "2026-04-01T00:00:00.000Z"
    },
    enabled: false
  })

  assert.deepEqual(calls, [{ tweetId: "tweet-123", enabled: false }])
  assert.deepEqual(response, { bookmarkId: "tweet-123", enabled: false })
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
