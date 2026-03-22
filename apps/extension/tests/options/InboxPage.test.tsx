import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createTag, getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
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

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  })
}

async function waitForAssertion(assertion: () => void, attempts = 8) {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await settle()
    }
  }

  throw lastError
}

async function seedWorkspaceData() {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "alpha note for inbox",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-17T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "beta note for inbox",
      createdAtOnX: "2026-03-16T01:00:00.000Z",
      savedAt: "2026-03-16T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "3",
      tweetUrl: "https://x.com/cara/status/3",
      authorName: "Cara",
      authorHandle: "cara",
      text: "project child bookmark for folder navigation coverage",
      createdAtOnX: "2026-03-17T02:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  await createTag({ name: "saved" })
  await createTag({ name: "follow-up" })

  const tags = await getAllTags()
  const followUpTag = tags.find((tag) => tag.name === "follow-up")
  assert.ok(followUpTag)

  return {
    followUpTagId: followUpTag.id
  }
}

function installChromeMock() {
  const messages: Array<{ type: string }> = []

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async (message: { type: string }) => {
        messages.push(message)

        if (message.type === "popup/load") {
          const [bookmarks, tags, bookmarkTags] = await Promise.all([
            getAllBookmarks(),
            getAllTags(),
            getAllBookmarkTags()
          ])

          return {
            bookmarks,
            sourceMaterials: bookmarks.map((bookmark) => ({
              ...bookmark,
              sourceKind: "x-bookmark"
            })),
            knowledgeCards: [],
            tags,
            bookmarkTags,
            aiGeneration: {
              enabled: false,
              provider: "openai",
              apiKey: "",
              model: "gpt-5-mini"
            },
            exportScope: "all",
            hasCompletedOnboarding: false,
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
          await resetBookmarksDb()
          return { success: true }
        }

        throw new Error(`Unexpected message: ${message.type}`)
      }
    }
  }

  return { messages }
}

function getButton(container: HTMLDivElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === label)
  assert.ok(button)
  return button
}

function setInputValue(element: HTMLInputElement | HTMLSelectElement, value: string, dom: JSDOM) {
  const prototype = element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")

  assert.ok(descriptor?.set)
  descriptor.set.call(element, value)
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
  element.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
}

test("InboxPage renders the workbench layout and switches detail drawer with row selection", async () => {
  await seedWorkspaceData()
  installChromeMock()

  const { container, dom } = render(React.createElement(InboxPage))

  await waitForAssertion(() => {
  assert.match(container.textContent ?? "", /Alice/)
  })

  assert.match(container.textContent ?? "", /Search/)
  assert.match(container.textContent ?? "", /All sources/)
  assert.match(container.textContent ?? "", /Notes & long posts/)
  assert.match(container.textContent ?? "", /Select all visible/)
  assert.doesNotMatch(container.textContent ?? "", /Source material/)

  const bobCard = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Bob"))
  assert.ok(bobCard)

  await act(async () => {
    bobCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Source material/)
    assert.match(container.textContent ?? "", /Bob/)
    assert.match(container.textContent ?? "", /beta note for inbox/)
  })
})

test("InboxPage prunes hidden batch selections when filters change", async () => {
  await seedWorkspaceData()
  installChromeMock()

  const { container, dom } = render(React.createElement(InboxPage))

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Alice/)
  })

  assert.equal(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Apply tag"), false)

  const selectAllVisibleButton = getButton(container, "Select all visible")
  await act(async () => {
    selectAllVisibleButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /3 selected/)
    assert.ok(getButton(container, "Tag sources"))
  })

  const moreFiltersButton = getButton(container, "More filters")
  await act(async () => {
    moreFiltersButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Author filters/)
  })

  const aliceAuthorFilter = Array.from(container.querySelectorAll("label")).find((label) => label.textContent?.includes("Alice (@alice)"))
  assert.ok(aliceAuthorFilter)
  const aliceAuthorCheckbox = aliceAuthorFilter.querySelector("input")
  assert.ok(aliceAuthorCheckbox)

  await act(async () => {
    aliceAuthorCheckbox.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /1 selected/)
    assert.match(container.textContent ?? "", /alpha note for inbox/)
    assert.doesNotMatch(container.textContent ?? "", /beta note for inbox/)
  })

  const clearFiltersButton = getButton(container, "Clear filters")
  await act(async () => {
    clearFiltersButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /alpha note for inbox/)
    assert.match(container.textContent ?? "", /beta note for inbox/)
    assert.equal(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Tag sources"), false)
  })
})

test("InboxPage supports item-level tagging from the detail drawer", async () => {
  const seeded = await seedWorkspaceData()
  installChromeMock()

  const { container, dom } = render(React.createElement(InboxPage))

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Alice/)
  })

  const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement | null
  assert.ok(searchInput)
  await act(async () => {
    setInputValue(searchInput, "Cara", dom)
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Cara/)
  })

  const caraCard = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Cara"))
  assert.ok(caraCard)

  await act(async () => {
    caraCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  const existingTagSelect = Array.from(container.querySelectorAll("select")).at(-1) as HTMLSelectElement | undefined
  assert.ok(existingTagSelect)
  await act(async () => {
    setInputValue(existingTagSelect, seeded.followUpTagId, dom)
  })

  const addTagButton = getButton(container, "Tag source")
  await act(async () => {
    addTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.doesNotMatch(container.textContent ?? "", /Cara/)
  })
})

test("InboxPage honors an initial published-date focus from Dashboard", async () => {
  await seedWorkspaceData()
  installChromeMock()

  const { container } = render(React.createElement(InboxPage, { initialRouteState: { publishedDate: "2026-03-16" } }))

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Focused published date:/)
    assert.match(container.textContent ?? "", /Mar 16, 2026/)
    assert.match(container.textContent ?? "", /Bob/)
    assert.doesNotMatch(container.textContent ?? "", /Alice/)
    assert.doesNotMatch(container.textContent ?? "", /Cara/)
  })
})
