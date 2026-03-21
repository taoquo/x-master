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
  ;(globalThis as typeof globalThis & {
    requestAnimationFrame: (callback: FrameRequestCallback) => number
    cancelAnimationFrame: (handle: number) => void
  }).requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0) as unknown as number
  ;(globalThis as typeof globalThis & {
    requestAnimationFrame: (callback: FrameRequestCallback) => number
    cancelAnimationFrame: (handle: number) => void
  }).cancelAnimationFrame = (handle) => clearTimeout(handle)

  const rootElement = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(rootElement)

  act(() => {
    root.render(ui)
  })

  return { container: dom.window.document.body as unknown as HTMLDivElement, dom }
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
                text: "Bookmark one",
                createdAtOnX: "2026-03-16T00:00:00.000Z",
                savedAt: "2026-03-16T01:00:00.000Z",
                rawPayload: {}
              }
            ],
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
}

function findButton(container: HTMLDivElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find((button) => button.textContent === label)
}

test("OptionsApp defaults to Dashboard and renders the four-module navigation", async () => {
  installChromeMock()

  const { container } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Dashboard/)
  assert.match(container.textContent ?? "", /Inbox/)
  assert.match(container.textContent ?? "", /Library/)
  assert.match(container.textContent ?? "", /Settings/)
  assert.equal(Array.from(container.querySelectorAll("nav button")).some((button) => button.textContent === "Tags"), false)
  assert.match(container.textContent ?? "", /Workspace snapshot/)
  assert.match(container.textContent ?? "", /Sync health/)
  assert.match(container.textContent ?? "", /Publish activity/)
  assert.doesNotMatch(container.textContent ?? "", /Triage pressure/)
  assert.doesNotMatch(container.textContent ?? "", /Recent momentum/)
  assert.doesNotMatch(container.textContent ?? "", /Sources to classify/)
})

test("OptionsApp switches to Inbox and keeps the workbench layout", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  const inboxButton = findButton(container, "Inbox")
  assert.ok(inboxButton)

  await act(async () => {
    inboxButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /focused triage layout/)
  assert.match(container.textContent ?? "", /Search/)
})

test("OptionsApp opens Library with subviews instead of a standalone Tags module", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  const libraryButton = findButton(container, "Library")
  assert.ok(libraryButton)

  await act(async () => {
    libraryButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Library scope/)
  assert.match(container.textContent ?? "", /All/)
  assert.match(container.textContent ?? "", /Tags/)
  assert.match(container.textContent ?? "", /Search/)
  assert.match(container.textContent ?? "", /More filters/)
  assert.match(container.textContent ?? "", /Select all visible/)
  assert.equal(Array.from(container.querySelectorAll("nav button")).some((button) => button.textContent === "Tags"), false)
})

test("OptionsApp opens Settings as a dedicated module", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  const settingsButton = findButton(container, "Settings")
  assert.ok(settingsButton)

  await act(async () => {
    settingsButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Manage sync visibility/)
  assert.match(container.textContent ?? "", /Tag management/)
  assert.match(container.textContent ?? "", /Workspace/)
})

test("Dashboard heatmap opens Inbox with a focused published date", async () => {
  installChromeMock()

  const { container, dom } = render(React.createElement(OptionsApp))

  await act(async () => {
    await Promise.resolve()
  })

  const heatmapButton = container.querySelector('button[data-date="2026-03-16"]')
  assert.ok(heatmapButton)

  await act(async () => {
    heatmapButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Search/)
  assert.match(container.textContent ?? "", /Focused published date:/)
})
