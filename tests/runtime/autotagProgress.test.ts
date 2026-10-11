import test from "node:test"
import assert from "node:assert/strict"
import { AUTOTAG_PROGRESS_MESSAGE } from "../../src/lib/runtime/messages.ts"
import {
  broadcastAutoTagProgress,
  subscribeAutoTagProgress,
  type AutoTagProgress
} from "../../src/lib/runtime/autotagProgress.ts"

function installRuntimeMock() {
  const sent: unknown[] = []
  const listeners: Array<(message: unknown) => void> = []

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: unknown) => {
        sent.push(message)
      },
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          listeners.push(listener)
        },
        removeListener: (listener: (message: unknown) => void) => {
          const index = listeners.indexOf(listener)
          if (index >= 0) {
            listeners.splice(index, 1)
          }
        }
      }
    }
  }

  return { sent, listeners }
}

function removeChrome() {
  delete (globalThis as unknown as Record<string, unknown>).chrome
}

test("broadcastAutoTagProgress sends the autotag/progress message", async () => {
  const { sent } = installRuntimeMock()

  broadcastAutoTagProgress({ phase: "heuristics", processed: 3, total: 10 })
  await Promise.resolve()

  assert.deepEqual(sent, [
    {
      type: AUTOTAG_PROGRESS_MESSAGE,
      progress: { phase: "heuristics", processed: 3, total: 10 }
    }
  ])

  removeChrome()
})

test("broadcastAutoTagProgress swallows a missing listener", async () => {
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      // No listener connected (popup/options closed): sendMessage rejects.
      sendMessage: () => Promise.reject(new Error("Could not establish connection")),
      onMessage: { addListener: () => {}, removeListener: () => {} }
    }
  }

  // Progress is best-effort, so a rejected broadcast must not surface.
  broadcastAutoTagProgress({ phase: "llm", processed: 0, total: 0 })
  await new Promise((resolve) => setTimeout(resolve, 0))

  removeChrome()
})

test("subscribeAutoTagProgress forwards only well-formed progress messages", () => {
  const { listeners } = installRuntimeMock()
  const received: AutoTagProgress[] = []
  const unsubscribe = subscribeAutoTagProgress((progress) => received.push(progress))

  assert.equal(listeners.length, 1)

  listeners[0]({ type: AUTOTAG_PROGRESS_MESSAGE, progress: { phase: "llm", processed: 2, total: 8 } })
  // Unrelated traffic and malformed payloads are ignored rather than thrown on.
  listeners[0]({ type: "sync/progress", progress: { phase: "llm", processed: 1, total: 1 } })
  listeners[0]({ type: AUTOTAG_PROGRESS_MESSAGE, progress: { phase: "unknown", processed: 1, total: 1 } })
  listeners[0]({ type: AUTOTAG_PROGRESS_MESSAGE })
  listeners[0](null)

  assert.deepEqual(received, [{ phase: "llm", processed: 2, total: 8 }])

  unsubscribe()
  assert.equal(listeners.length, 0)

  removeChrome()
})

test("subscribeAutoTagProgress without a chrome runtime is a no-op", () => {
  removeChrome()

  const unsubscribe = subscribeAutoTagProgress(() => {
    throw new Error("must not be called")
  })

  assert.equal(typeof unsubscribe, "function")
  unsubscribe()
  // Broadcasting without a runtime must not throw either.
  broadcastAutoTagProgress({ phase: "heuristics", processed: 0, total: 1 })
})
