import { SYNC_PROGRESS_MESSAGE } from "./messages.ts"

export interface SyncProgress {
  pageCount: number
  fetchedCount: number
}

interface SyncProgressMessage {
  type: typeof SYNC_PROGRESS_MESSAGE
  progress: SyncProgress
}

function isSyncProgressMessage(message: unknown): message is SyncProgressMessage {
  if (!message || typeof message !== "object") {
    return false
  }

  const candidate = message as { type?: unknown; progress?: unknown }
  if (candidate.type !== SYNC_PROGRESS_MESSAGE || !candidate.progress || typeof candidate.progress !== "object") {
    return false
  }

  const progress = candidate.progress as { pageCount?: unknown; fetchedCount?: unknown }
  return typeof progress.pageCount === "number" && typeof progress.fetchedCount === "number"
}

export function broadcastSyncProgress(progress: SyncProgress) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return
  }

  try {
    // No listener may be connected (popup/options closed); swallow the rejection.
    const result = chrome.runtime.sendMessage({ type: SYNC_PROGRESS_MESSAGE, progress }) as Promise<unknown> | undefined
    void result?.catch?.(() => {})
  } catch {
    // Ignore broadcast failures; progress is best-effort.
  }
}

export function subscribeSyncProgress(listener: (progress: SyncProgress) => void): () => void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    return () => {}
  }

  const handleMessage = (message: unknown) => {
    if (isSyncProgressMessage(message)) {
      listener(message.progress)
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  return () => {
    chrome.runtime.onMessage.removeListener(handleMessage)
  }
}

// Substitutes the counters into a copy template. It used to hardcode both
// locales, which is how a third locale would have silently rendered Chinese or
// English, and it put user-facing text in a runtime module that has no access to
// the translation table.
export function formatSyncProgressLabel(template: string, progress: SyncProgress) {
  return template
    .replace("{pages}", String(progress.pageCount))
    .replace("{items}", String(progress.fetchedCount))
}
