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

function installChromeMock() {
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
                savedAt: "2026-03-17T00:01:00.000Z",
                media: [{ type: "photo", url: "https://example.com/alice.jpg", altText: "Alice media" }],
                metrics: { likes: 12, retweets: 5, replies: 1 },
                rawPayload: {}
              },
              {
                tweetId: "2",
                tweetUrl: "https://x.com/bob/status/2",
                authorName: "Bob",
                authorHandle: "bob",
                text: "short note",
                createdAtOnX: "2026-03-14T00:00:00.000Z",
                savedAt: "2026-03-10T00:00:00.000Z",
                metrics: { likes: 1, retweets: 0, replies: 0 },
                rawPayload: {}
              }
            ],
            folders: [{ id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" }],
            bookmarkFolders: [{ bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-16T00:00:00.000Z" }],
            tags: [
              { id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" },
              { id: "tag-2", name: "research", createdAt: "2026-03-16T00:00:00.000Z" }
            ],
            bookmarkTags: [{ id: "1:tag-1", bookmarkId: "1", tagId: "tag-1", createdAt: "2026-03-16T00:00:00.000Z" }],
            latestSyncRun: {
              id: "sync-1",
              status: "success",
              startedAt: "2026-03-16T00:00:00.000Z",
              finishedAt: "2026-03-16T00:01:00.000Z",
              fetchedCount: 2,
              insertedCount: 2,
              updatedCount: 0,
              failedCount: 0
            },
            summary: {
              status: "success",
              fetchedCount: 2,
              insertedCount: 2,
              updatedCount: 0,
              failedCount: 0,
              lastSyncedAt: "2026-03-16T00:01:00.000Z"
            }
          }
        }

        if (message.type === "sync/run") {
          return {
            fetchedCount: 2,
            insertedCount: 2,
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
}

test("Workspace renders author, tag, and time filter controls", async () => {
  installChromeMock()

  const { container } = render(React.createElement(Workspace, { width: "100%", minHeight: 720 }))

  await act(async () => {
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Authors/)
  assert.match(container.textContent ?? "", /Tags/)
  assert.match(container.textContent ?? "", /Saved time/)
  assert.match(container.textContent ?? "", /Clear filters/)
  assert.match(container.textContent ?? "", /Any author/)
  assert.match(container.textContent ?? "", /Any tag/)
})

test("Workspace clears selected filters back to defaults", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(Workspace, { width: "100%", minHeight: 720 }))

  await act(async () => {
    await Promise.resolve()
  })

  const folderToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Folders"))
  const authorToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Authors"))
  const tagToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Tags"))
  const timeToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Saved time"))
  const clearButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Clear filters")

  assert.ok(folderToggle)
  assert.ok(authorToggle)
  assert.ok(tagToggle)
  assert.ok(timeToggle)
  assert.ok(clearButton)

  await act(async () => {
    authorToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    tagToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    timeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  const checkboxes = Array.from(container.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[]
  const selects = Array.from(container.querySelectorAll("select")) as HTMLSelectElement[]
  const authorLogicSelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "any"))
  const timeRangeSelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "7d"))

  assert.ok(authorLogicSelect)
  assert.ok(timeRangeSelect)

  await act(async () => {
    checkboxes[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    checkboxes[2].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    authorLogicSelect.value = "all"
    authorLogicSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    timeRangeSelect.value = "7d"
    timeRangeSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    await Promise.resolve()
  })

  assert.equal((Array.from(container.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[])[0].checked, true)
  assert.equal((Array.from(container.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[])[2].checked, true)
  assert.equal(authorLogicSelect.value, "all")

  await act(async () => {
    clearButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.equal((Array.from(container.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[])[0].checked, false)
  assert.equal((Array.from(container.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[])[2].checked, false)
  const resetSelectValues = (Array.from(container.querySelectorAll("select")) as HTMLSelectElement[]).map((select) => select.value)
  assert.equal(resetSelectValues.includes("any"), true)
  assert.equal(resetSelectValues.filter((value) => value === "all").length >= 2, true)
})
