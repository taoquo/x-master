import { createBackgroundMessageHandler } from "../../src/background/index.ts"
import { getAllBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { getAllBookmarkLists, getAllLists } from "../../src/lib/storage/listsStore.ts"
import { resetLocalData } from "../../src/lib/storage/resetLocalData.ts"
import { getSettings } from "../../src/lib/storage/settings.ts"
import { getLatestSyncRun } from "../../src/lib/storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { buildWorkspaceStats } from "../../src/lib/workspace/stats.ts"

export function installChromeRuntimeHarness({
  runSync
}: {
  runSync?: () => Promise<{ fetchedCount: number; insertedCount: number; updatedCount: number; failedCount: number }>
} = {}) {
  let storedSettings: unknown
  let openOptionsPageCallCount = 0

  const handler = createBackgroundMessageHandler({
    loadWorkspaceData: async () => {
      const [bookmarks, lists, bookmarkLists, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
        getAllBookmarks(),
        getAllLists(),
        getAllBookmarkLists(),
        getAllTags(),
        getAllBookmarkTags(),
        getSettings(),
        getLatestSyncRun()
      ])

      return {
        bookmarks,
        lists,
        bookmarkLists,
        tags,
        bookmarkTags,
        classificationRules: settings.classificationRules,
        summary: settings.lastSyncSummary,
        latestSyncRun,
        stats: buildWorkspaceStats({
          bookmarks,
          lists,
          bookmarkLists,
          tags,
          bookmarkTags
        })
      }
    },
    resetData: async () => {
      await resetLocalData()
      return { success: true }
    },
    runSync:
      runSync ??
      (async () => ({
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0
      }))
  })

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: { type: string }) => handler(message),
      openOptionsPage: async () => {
        openOptionsPageCallCount += 1
      },
      getURL: (path: string) => `chrome-extension://extension-id/${path}`
    },
    storage: {
      local: {
        get: async () => ({ settings: storedSettings }),
        set: async (value: Record<string, unknown>) => {
          storedSettings = value.settings
        }
      }
    },
    tabs: {
      query: async () => [],
      update: async () => {},
      create: async () => {}
    },
    windows: {
      update: async () => {}
    }
  }

  return {
    getOpenOptionsPageCallCount: () => openOptionsPageCallCount,
    getStoredSettings: () => storedSettings
  }
}
