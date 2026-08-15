import { AUTOTAG_PROGRESS_MESSAGE } from "./messages.ts"

export interface AutoTagProgress {
  phase: "heuristics" | "llm"
  processed: number
  total: number
}

interface AutoTagProgressMessage {
  type: typeof AUTOTAG_PROGRESS_MESSAGE
  progress: AutoTagProgress
}

function isAutoTagProgressMessage(message: unknown): message is AutoTagProgressMessage {
  if (!message || typeof message !== "object") {
    return false
  }

  const candidate = message as { type?: unknown; progress?: unknown }
  if (candidate.type !== AUTOTAG_PROGRESS_MESSAGE || !candidate.progress || typeof candidate.progress !== "object") {
    return false
  }

  const progress = candidate.progress as { phase?: unknown; processed?: unknown; total?: unknown }
  return (
    (progress.phase === "heuristics" || progress.phase === "llm") &&
    typeof progress.processed === "number" &&
    typeof progress.total === "number"
  )
}

export function broadcastAutoTagProgress(progress: AutoTagProgress) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return
  }

  try {
    // No listener may be connected (popup/options closed); swallow the rejection.
    const result = chrome.runtime.sendMessage({ type: AUTOTAG_PROGRESS_MESSAGE, progress }) as
      | Promise<unknown>
      | undefined
    void result?.catch?.(() => {})
  } catch {
    // Ignore broadcast failures; progress is best-effort.
  }
}

export function subscribeAutoTagProgress(listener: (progress: AutoTagProgress) => void): () => void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    return () => {}
  }

  const handleMessage = (message: unknown) => {
    if (isAutoTagProgressMessage(message)) {
      listener(message.progress)
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  return () => {
    chrome.runtime.onMessage.removeListener(handleMessage)
  }
}
