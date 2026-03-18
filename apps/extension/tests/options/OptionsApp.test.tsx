import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"

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
            bookmarks: [],
            folders: [{ id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" }],
            bookmarkFolders: [],
            tags: [],
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
}

test("OptionsApp defaults to Dashboard and renders navigation", async () => {
  installChromeMock()

  const { container } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Dashboard/)
  assert.match(container.textContent ?? "", /Inbox/)
  assert.match(container.textContent ?? "", /Tags/)
  assert.match(container.textContent ?? "", /Save heatmap/)
  assert.match(container.textContent ?? "", /Quick actions/)
  assert.doesNotMatch(container.textContent ?? "", /Open Folders/)
})

test("OptionsApp switches to Inbox page from navigation", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  const inboxButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Inbox")
  assert.ok(inboxButton)

  await act(async () => {
    inboxButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Organize new bookmarks in a dense table/)
  assert.match(container.textContent ?? "", /Inbox workbench/)
})

test("OptionsApp keeps Tags as the only secondary organization page", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  const tagsButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Tags")
  assert.ok(tagsButton)
  assert.equal(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Folders"), false)

  await act(async () => {
    tagsButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Browse bookmarks through cross-cutting tags/)
  assert.match(container.textContent ?? "", /Tag library/)
})
