import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { BookmarkList } from "../../src/popup/components/BookmarkList.tsx"

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

  return { container }
}

test("BookmarkList renders bookmark cards", () => {
  const { container } = render(
    React.createElement(BookmarkList, {
      selectedBookmarkId: "1",
      resultCount: 2,
      sortLabel: "newest saved",
      folderLabel: "Inbox",
      onSelectBookmark: () => {},
      bookmarks: [
        {
          tweetId: "1",
          tweetUrl: "https://x.com/alice/status/1",
          authorName: "Alice",
          authorHandle: "alice",
          text: "hello world",
          createdAtOnX: "2026-03-15T00:00:00.000Z",
          savedAt: "2026-03-15T00:01:00.000Z",
          media: [{ type: "photo", url: "https://example.com/alice.jpg", altText: "Alice media" }],
          metrics: { likes: 4, retweets: 2, replies: 1 },
          rawPayload: {}
        },
        {
          tweetId: "2",
          tweetUrl: "https://x.com/bob/status/2",
          authorName: "Bob",
          authorHandle: "bob",
          text: "typescript note",
          createdAtOnX: "2026-03-15T00:00:00.000Z",
          savedAt: "2026-03-15T00:02:00.000Z",
          metrics: { likes: 1, retweets: 0, replies: 0 },
          rawPayload: {}
        }
      ]
    })
  )

  assert.match(container.textContent ?? "", /Alice/)
  assert.match(container.textContent ?? "", /hello world/)
  assert.match(container.textContent ?? "", /Bob/)
  assert.match(container.textContent ?? "", /Likes: 4/)
  assert.match(container.textContent ?? "", /Inbox · 2 result\(s\)/)
  assert.match(container.textContent ?? "", /Sorted by newest saved/)
  assert.equal(container.querySelectorAll("img").length, 1)
  assert.equal(container.querySelectorAll("article").length, 2)
  assert.match(container.textContent ?? "", /Selected/)
})
