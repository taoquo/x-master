import { runBookmarkSync } from "./syncBookmarks.ts"
import { getAllBookmarks } from "../lib/storage/bookmarksStore.ts"
import { getAllBookmarkLists, getAllLists } from "../lib/storage/listsStore.ts"
import { resetLocalData } from "../lib/storage/resetLocalData.ts"
import { getSettings } from "../lib/storage/settings.ts"
import { getLatestSyncRun } from "../lib/storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../lib/storage/tagsStore.ts"
import { LOAD_WORKSPACE_DATA_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "../lib/runtime/messages.ts"
import type { WorkspaceData } from "../lib/types.ts"
import { buildWorkspaceStats } from "../lib/workspace/stats.ts"

const OPTIONS_PAGE_PATH = "options.html"

interface BackgroundDependencies {
  loadWorkspaceData: () => Promise<WorkspaceData>
  resetData: () => Promise<unknown>
  runSync: () => Promise<unknown>
}

export function createBackgroundMessageHandler({ loadWorkspaceData, resetData, runSync }: BackgroundDependencies) {
  return async function handleMessage(message: { type: string }) {
    if (message.type === LOAD_WORKSPACE_DATA_MESSAGE) {
      return loadWorkspaceData()
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

async function loadWorkspaceData(): Promise<WorkspaceData> {
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
}

export async function openOrFocusOptionsPage() {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL || !chrome.tabs?.query || !chrome.tabs?.update || !chrome.tabs?.create) {
    return
  }

  const optionsUrl = chrome.runtime.getURL(OPTIONS_PAGE_PATH)
  const existingTabs = await chrome.tabs.query({ url: optionsUrl })
  const existingTab = existingTabs[0]

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true })

    if (existingTab.windowId !== undefined && chrome.windows?.update) {
      await chrome.windows.update(existingTab.windowId, { focused: true })
    }

    return
  }

  await chrome.tabs.create({ url: optionsUrl })
}

const handleMessage = createBackgroundMessageHandler({
  loadWorkspaceData,
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

if (typeof chrome !== "undefined" && chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(() => {
    void openOrFocusOptionsPage()
  })
}

export { handleMessage, OPTIONS_PAGE_PATH }
