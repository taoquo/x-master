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
  ;(globalThis as typeof globalThis & { MutationObserver: typeof MutationObserver }).MutationObserver =
    dom.window.MutationObserver
  ;(globalThis as typeof globalThis & { ResizeObserver: any }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

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
            sourceMaterials: [
              {
                tweetId: "1",
                tweetUrl: "https://x.com/alice/status/1",
                authorName: "Alice",
                authorHandle: "alice",
                text: "Bookmark one",
                createdAtOnX: "2026-03-16T00:00:00.000Z",
                savedAt: "2026-03-16T01:00:00.000Z",
                rawPayload: {},
                sourceKind: "x-bookmark"
              }
            ],
            knowledgeCards: [
              {
                id: "card-1",
                sourceMaterialId: "1",
                status: "draft",
                title: "Bookmark one",
                theme: "Bookmark one",
                summary: "Bookmark one",
                keyExcerpt: "Bookmark one",
                applicability: "Useful as a technical reference.",
                provenance: [
                  { field: "theme", excerpt: "Bookmark one" },
                  { field: "summary", excerpt: "Bookmark one" },
                  { field: "key_excerpt", excerpt: "Bookmark one" },
                  { field: "applicability", excerpt: "Bookmark one" }
                ],
                quality: {
                  score: 72,
                  needsReview: false,
                  warnings: [],
                  generatorVersion: "heuristic-v1"
                },
                generatedAt: "2026-03-16T01:00:00.000Z",
                updatedAt: "2026-03-16T01:00:00.000Z"
              }
            ],
            tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
            bookmarkTags: [],
            aiGeneration: {
              enabled: false,
              provider: "openai",
              apiKey: "",
              model: "gpt-5-mini"
            },
            exportScope: "all",
            hasCompletedOnboarding: false,
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

function findLabel(container: HTMLDivElement, label: string) {
  return Array.from(container.querySelectorAll("label")).find((element) => element.textContent === label)
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
  assert.match(container.textContent ?? "", /Pipeline snapshot/)
  assert.match(container.textContent ?? "", /Sync health/)
  assert.match(container.textContent ?? "", /Publish activity/)
  assert.doesNotMatch(container.textContent ?? "", /Getting started/)
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

  assert.match(container.textContent ?? "", /raw source material/)
  assert.ok(container.querySelector('input[type="search"]'))
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

  assert.match(container.textContent ?? "", /Draft queue|Reviewed library|Stale review|All cards/)
  assert.match(container.textContent ?? "", /All cards/)
  assert.match(container.textContent ?? "", /By tag/)
  assert.ok(container.querySelector('input[type="search"]'))
  assert.match(container.textContent ?? "", /Card review/)
  assert.match(container.textContent ?? "", /Draft queue/)
  assert.match(container.textContent ?? "", /Reviewed library/)
  assert.match(container.textContent ?? "", /Stale review/)
  assert.equal(Array.from(container.querySelectorAll("nav button")).some((button) => button.textContent === "Tags"), false)
})

test("Library review flow exposes the save action and regenerate action together", async () => {
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

  assert.ok(findButton(container, "Save draft"))
  assert.ok(findButton(container, "Regenerate with AI"))
})

test("Dashboard recommendation can open Library scoped to stale cards", async () => {
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

  assert.match(container.textContent ?? "", /Draft queue|Reviewed library|Stale review/)
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

  assert.match(container.textContent ?? "", /Configure the pipeline/)
  assert.match(container.textContent ?? "", /Sync status/)
  assert.match(container.textContent ?? "", /AI generation/)

  const knowledgeSetupButton = findLabel(container, "Knowledge setup")
  assert.ok(knowledgeSetupButton)

  await act(async () => {
    knowledgeSetupButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Tag management/)
  assert.match(container.textContent ?? "", /Export and vault shape/)

  const systemButton = findLabel(container, "System")
  assert.ok(systemButton)

  await act(async () => {
    systemButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    await Promise.resolve()
  })

  assert.match(container.textContent ?? "", /Access and permissions/)
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

  assert.ok(container.querySelector('input[type="search"]'))
  assert.match(container.textContent ?? "", /Focused published date:/)
})
