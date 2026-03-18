import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { BookmarkDetail } from "../../src/popup/components/BookmarkDetail.tsx"
import { SettingsPanel } from "../../src/popup/components/SettingsPanel.tsx"
import { exportBookmarks } from "../../src/lib/export/exportBookmarks.ts"

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

test("BookmarkDetail renders the selected bookmark and tag actions", async () => {
  const events: string[] = []

  const { container, dom } = render(
    React.createElement(BookmarkDetail, {
      bookmark: {
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
      },
      currentFolder: { id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" },
      availableFolders: [
        { id: "folder-inbox", name: "Inbox", createdAt: "2026-03-16T00:00:00.000Z" },
        { id: "folder-1", name: "Research", createdAt: "2026-03-16T00:00:00.000Z" }
      ],
      tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
      availableTags: [
        { id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" },
        { id: "tag-2", name: "research", createdAt: "2026-03-16T00:00:00.000Z" }
      ],
      onCreateFolder: async () => {},
      onMoveToFolder: async () => {},
      onCreateTag: async (name) => {
        events.push(`create:${name}`)
      },
      onAttachTag: async (tagId) => {
        events.push(`attach:${tagId}`)
      },
      onDetachTag: async (tagId) => {
        events.push(`detach:${tagId}`)
      },
      isSaving: false
    })
  )

  assert.match(container.textContent ?? "", /Alice/)
  assert.match(container.textContent ?? "", /Longform bookmark/)
  assert.match(container.textContent ?? "", /Current folder: Inbox/)
  assert.match(container.textContent ?? "", /saved/)
  assert.match(container.textContent ?? "", /Likes: 12/)
  assert.equal(container.querySelectorAll("img").length, 1)
  assert.ok(container.querySelector("input"))

  const selects = Array.from(container.querySelectorAll("select")) as HTMLSelectElement[]
  const addTagButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add tag")
  const removeTagButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Remove")

  assert.ok(addTagButton)
  assert.ok(removeTagButton)

  await act(async () => {
    const tagSelect = selects[1]
    tagSelect.value = "tag-2"
    tagSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    await Promise.resolve()
  })

  await act(async () => {
    addTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    removeTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.deepEqual(events, ["attach:tag-2", "detach:tag-1"])
})

test("BookmarkDetail renders an empty selection state", () => {
  const { container } = render(
    React.createElement(BookmarkDetail, {
      bookmark: null,
      currentFolder: null,
      availableFolders: [],
      tags: [],
      availableTags: [],
      onCreateFolder: async () => {},
      onMoveToFolder: async () => {},
      onCreateTag: async () => {},
      onAttachTag: async () => {},
      onDetachTag: async () => {},
      isSaving: false
    })
  )

  assert.match(container.textContent ?? "", /No bookmark selected/)
  assert.match(container.textContent ?? "", /Select a bookmark from the list/)
})

test("SettingsPanel triggers bookmark export", async () => {
  let clicked = 0
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello detail",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ]

  const { container, dom } = render(
    React.createElement(SettingsPanel, {
      bookmarks,
      tags: [{ id: "tag-1", name: "saved", createdAt: "2026-03-16T00:00:00.000Z" }],
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
      onExport: () => {
        clicked += 1
        return exportBookmarks(bookmarks)
      },
      onReset: async () => {},
      isResetting: false
    })
  )

  const button = container.querySelector("button")
  assert.ok(button)

  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.equal(clicked, 1)
  assert.match(container.textContent ?? "", /Tags stored: 1/)
  assert.match(container.textContent ?? "", /Latest sync status: success/)
})
