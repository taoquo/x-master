import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import App from "../../src/popup/App.tsx"

function render(ui: React.ReactElement) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  const container = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(container)

  act(() => {
    root.render(ui)
  })

  return { container, dom }
}

test("Popup renders sync console data and refreshes after sync", async () => {
  const loadResponses = [
    {
      bookmarks: [{ tweetId: "1", tweetUrl: "https://x.com/alice/status/1", authorName: "Alice", authorHandle: "alice", text: "hello", createdAtOnX: "2026-03-15T00:00:00.000Z", savedAt: "2026-03-15T00:01:00.000Z", rawPayload: {} }],
      folders: [{ id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" }],
      bookmarkFolders: [{ bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-16T00:00:00.000Z" }],
      tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
      bookmarkTags: [],
      latestSyncRun: null,
      summary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 }
    },
    {
      bookmarks: [{ tweetId: "1", tweetUrl: "https://x.com/alice/status/1", authorName: "Alice", authorHandle: "alice", text: "hello", createdAtOnX: "2026-03-15T00:00:00.000Z", savedAt: "2026-03-15T00:01:00.000Z", rawPayload: {} }],
      folders: [{ id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" }],
      bookmarkFolders: [{ bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-16T00:00:00.000Z" }],
      tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
      bookmarkTags: [],
      latestSyncRun: {
        id: "sync-1",
        status: "success",
        startedAt: "2026-03-16T00:00:00.000Z",
        finishedAt: "2026-03-16T00:01:00.000Z",
        fetchedCount: 1,
        insertedCount: 1,
        updatedCount: 0,
        failedCount: 0
      },
      summary: {
        status: "success",
        fetchedCount: 1,
        insertedCount: 1,
        updatedCount: 0,
        failedCount: 0,
        lastSyncedAt: "2026-03-16T00:01:00.000Z"
      }
    }
  ]

  let loadIndex = 0

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: { type: string }) => {
        if (message.type === "popup/load") {
          const response = loadResponses[Math.min(loadIndex, loadResponses.length - 1)]
          loadIndex += 1
          return response
        }

        if (message.type === "sync/run") {
          return {
            fetchedCount: 1,
            insertedCount: 1,
            updatedCount: 0,
            failedCount: 0
          }
        }

        throw new Error(`Unexpected message: ${message.type}`)
      }
    },
    sidePanel: {
      open: async () => {}
    },
    windows: {
      WINDOW_ID_CURRENT: 1
    }
  }

  const { container, dom } = render(React.createElement(App))

  await act(async () => {
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Quick sync and jump into the full workspace/)
  assert.match(container.textContent ?? "", /Bookmarks: 1/)
  assert.match(container.textContent ?? "", /Tags: 1/)
  assert.match(container.textContent ?? "", /Open workspace/)

  const syncButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Sync now")
  assert.ok(syncButton)

  await act(async () => {
    syncButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Status: success/)
  assert.match(container.textContent ?? "", /Latest sync status: success/)
})

test("Popup opens the side panel workspace", async () => {
  let openedWindowId: number | null = null

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async () => ({
        bookmarks: [],
        folders: [],
        bookmarkFolders: [],
        tags: [],
        bookmarkTags: [],
        latestSyncRun: null,
        summary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 }
      })
    },
    sidePanel: {
      open: async ({ windowId }: { windowId: number }) => {
        openedWindowId = windowId
      }
    },
    windows: {
      WINDOW_ID_CURRENT: 7
    }
  }

  const { container, dom } = render(React.createElement(App))

  await act(async () => {
    await Promise.resolve()
  })

  const openButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Open workspace")
  assert.ok(openButton)

  await act(async () => {
    openButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.equal(openedWindowId, 7)
})
