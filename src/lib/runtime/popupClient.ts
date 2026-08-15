import { createEmptySyncSummary, type WorkspaceData } from "../types.ts"
import { createEmptyWorkspaceStats } from "../workspace/stats.ts"
import { LOAD_WORKSPACE_DATA_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "./messages.ts"

function assertNoRuntimeError<T>(response: T | { error: string }): T {
  if (typeof response === "object" && response !== null && "error" in response) {
    throw new Error(response.error)
  }

  return response as T
}

function createEmptyWorkspaceData(): WorkspaceData {
  return {
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
    savedViews: [],
    tagSuggestions: [],
    summary: createEmptySyncSummary(),
    latestSyncRun: null,
    stats: createEmptyWorkspaceStats()
  }
}

export async function loadWorkspaceData(): Promise<WorkspaceData> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return createEmptyWorkspaceData()
  }

  return assertNoRuntimeError(await chrome.runtime.sendMessage({ type: LOAD_WORKSPACE_DATA_MESSAGE }))
}

export interface RunSyncResponse {
  started: boolean
  alreadyRunning?: boolean
}

export async function runSync(): Promise<RunSyncResponse> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { started: false }
  }

  return assertNoRuntimeError<RunSyncResponse>(await chrome.runtime.sendMessage({ type: RUN_SYNC_MESSAGE }))
}

export async function resetStoredData() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { success: true }
  }

  return assertNoRuntimeError(await chrome.runtime.sendMessage({ type: RESET_LOCAL_DATA_MESSAGE }))
}
