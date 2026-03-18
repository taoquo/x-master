import { createEmptySyncSummary, type PopupData } from "../types.ts"
import { LOAD_POPUP_DATA_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "./messages.ts"

function assertNoRuntimeError<T>(response: T | { error: string }): T {
  if (typeof response === "object" && response !== null && "error" in response) {
    throw new Error(response.error)
  }

  return response as T
}

export async function loadPopupData(): Promise<PopupData> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      bookmarks: [],
      folders: [],
      bookmarkFolders: [],
      tags: [],
      bookmarkTags: [],
      summary: createEmptySyncSummary(),
      latestSyncRun: null
    }
  }

  return assertNoRuntimeError(await chrome.runtime.sendMessage({ type: LOAD_POPUP_DATA_MESSAGE }))
}

export async function runSync() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    }
  }

  return assertNoRuntimeError(await chrome.runtime.sendMessage({ type: RUN_SYNC_MESSAGE }))
}

export async function resetStoredData() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { success: true }
  }

  return assertNoRuntimeError(await chrome.runtime.sendMessage({ type: RESET_LOCAL_DATA_MESSAGE }))
}
