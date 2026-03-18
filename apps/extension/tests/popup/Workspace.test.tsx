import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { Workspace } from "../../src/popup/Workspace.tsx"

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

test("Workspace renders the full controls, list, and detail panes", async () => {
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: { type: string }) => {
        if (message.type === "popup/load") {
          return {
            bookmarks: [
              {
                tweetId: "1",
                tweetUrl: "https://x.com/alice/status/1",
                authorName: "Alice",
                authorHandle: "alice",
                text: "x".repeat(320),
                createdAtOnX: "2026-03-15T00:00:00.000Z",
                savedAt: "2026-03-15T00:01:00.000Z",
                media: [{ type: "photo", url: "https://example.com/alice.jpg", altText: "Alice media" }],
                metrics: { likes: 12, retweets: 5, replies: 1 },
                rawPayload: {}
              }
            ],
            folders: [{ id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" }],
            bookmarkFolders: [{ bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-16T00:00:00.000Z" }],
            tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
            bookmarkTags: [{ id: "1:tag-1", bookmarkId: "1", tagId: "tag-1", createdAt: "2026-03-16T00:00:00.000Z" }],
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
        }

        if (message.type === "sync/run") {
          return {
            fetchedCount: 1,
            insertedCount: 1,
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

  const { container } = render(React.createElement(Workspace, { width: "100%", minHeight: 720 }))

  await act(async () => {
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /X Bookmark Manager/)
  assert.match(container.textContent ?? "", /Sort/)
  assert.match(container.textContent ?? "", /ContentAll content/)
  assert.match(container.textContent ?? "", /Bookmarks/)
  assert.match(container.textContent ?? "", /Open on X/)
  assert.match(container.textContent ?? "", /Longform bookmark/)
  assert.match(container.textContent ?? "", /Media/)
  assert.match(container.textContent ?? "", /Text/)
  assert.match(container.textContent ?? "", /Tags/)
  assert.match(container.textContent ?? "", /FolderCurrent folder: Inbox/)
})
