import { getAllBookmarks } from "../lib/storage/bookmarksStore.ts"
import { ensureBookmarksHaveFolders, getAllBookmarkFolders, getAllFolders } from "../lib/storage/foldersStore.ts"
import { resetLocalData } from "../lib/storage/resetLocalData.ts"
import { getSettings } from "../lib/storage/settings.ts"
import { getLatestSyncRun } from "../lib/storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../lib/storage/tagsStore.ts"
import { LOAD_POPUP_DATA_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "../lib/runtime/messages.ts"
import type { PopupData } from "../lib/types.ts"
import { runBookmarkSync } from "./syncBookmarks.ts"

interface BackgroundDependencies {
  loadPopupData: () => Promise<PopupData>
  resetData: () => Promise<unknown>
  runSync: () => Promise<unknown>
}

export function createBackgroundMessageHandler({ loadPopupData, resetData, runSync }: BackgroundDependencies) {
  return async function handleMessage(message: { type: string }) {
    if (message.type === LOAD_POPUP_DATA_MESSAGE) {
      return loadPopupData()
    }

    if (message.type === RESET_LOCAL_DATA_MESSAGE) {
      return resetData()
    }

    if (message.type === RUN_SYNC_MESSAGE) {
      return runSync()
    }

    throw new Error(`Unsupported message type: ${message.type}`)
  }
}

async function loadPopupData() {
  await ensureBookmarksHaveFolders()

  const [bookmarks, folders, bookmarkFolders, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
    getAllBookmarks(),
    getAllFolders(),
    getAllBookmarkFolders(),
    getAllTags(),
    getAllBookmarkTags(),
    getSettings(),
    getLatestSyncRun()
  ])

  return {
    bookmarks,
    folders,
    bookmarkFolders,
    tags,
    bookmarkTags,
    summary: settings.lastSyncSummary,
    latestSyncRun
  }
}

const handleMessage = createBackgroundMessageHandler({
  loadPopupData,
  resetData: async () => {
    await resetLocalData()
    return { success: true }
  },
  runSync: runBookmarkSync
})

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }))

    return true
  })
}

export { handleMessage }
