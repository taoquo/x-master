import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { InboxPage } from "../../src/options/pages/InboxPage.tsx"

function render(ui: React.ReactElement) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as typeof globalThis & { Blob: typeof Blob }).Blob = dom.window.Blob
  ;(globalThis as typeof globalThis & { URL: typeof URL }).URL = {
    ...dom.window.URL,
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => {}
  } as unknown as typeof URL

  const container = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(container)

  act(() => {
    root.render(ui)
  })

  return { container, dom }
}

function installChromeMock() {
  const messages: Array<{ type: string }> = []

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: { type: string }) => {
        messages.push(message)

        if (message.type === "popup/load") {
          return {
            bookmarks: [
              {
                tweetId: "1",
                tweetUrl: "https://x.com/alice/status/1",
                authorName: "Alice",
                authorHandle: "alice",
                text: "hello one",
                createdAtOnX: "2026-03-15T00:00:00.000Z",
                savedAt: "2026-03-17T00:01:00.000Z",
                rawPayload: {}
              },
              {
                tweetId: "2",
                tweetUrl: "https://x.com/bob/status/2",
                authorName: "Bob",
                authorHandle: "bob",
                text: "hello two",
                createdAtOnX: "2026-03-15T00:00:00.000Z",
                savedAt: "2026-03-16T00:01:00.000Z",
                rawPayload: {}
              }
            ],
            folders: [
              { id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" },
              { id: "folder-1", name: "Projects", createdAt: "2026-03-16T00:00:00.000Z" }
            ],
            bookmarkFolders: [
              { bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-16T00:00:00.000Z" },
              { bookmarkId: "2", folderId: "folder-inbox", updatedAt: "2026-03-16T00:00:00.000Z" }
            ],
            tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
            bookmarkTags: [],
            latestSyncRun: null,
            summary: {
              status: "idle",
              fetchedCount: 0,
              insertedCount: 0,
              updatedCount: 0,
              failedCount: 0
            }
          }
        }

        if (message.type === "sync/run") {
          return {
            fetchedCount: 0,
            insertedCount: 0,
            updatedCount: 0,
            failedCount: 0
          }
        }

        if (message.type === "storage/reset") {
          return { success: true }
        }

        throw new Error(`Unexpected message: ${message.type}`)
      }
    }
  }

  return { messages }
}

test("InboxPage renders batch organize and queue controls", async () => {
  installChromeMock()

  const { container } = render(React.createElement(InboxPage))

  await act(async () => {
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Processing queue/)
  assert.match(container.textContent ?? "", /Batch organize/)
  assert.match(container.textContent ?? "", /Select all visible/)
  assert.match(container.textContent ?? "", /Move selected/)
  assert.match(container.textContent ?? "", /Apply tag/)
})

test("InboxPage supports queue navigation and batch selection", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(InboxPage))

  await act(async () => {
    await Promise.resolve()
  })

  const nextButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Next")
  const selectAllButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Select all visible")
  const clearSelectionButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Clear selection")

  assert.ok(nextButton)
  assert.ok(selectAllButton)
  assert.ok(clearSelectionButton)

  await act(async () => {
    nextButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Bob/)

  await act(async () => {
    selectAllButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /2 selected/)

  await act(async () => {
    clearSelectionButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /0 selected/)
})
