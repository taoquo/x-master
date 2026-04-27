import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

function getBookmarkCards(container: HTMLDivElement) {
  return Array.from(container.querySelectorAll("[data-bookmark-card]"))
}

function findByTestId(container: HTMLDivElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

test("OptionsApp keeps the same lightbox image element while switching between images", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-stable-switch",
      tweetUrl: "https://x.com/alice/status/tweet-media-stable-switch",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Stable preview switch",
      media: [
        { type: "photo", url: "https://example.com/media-1.jpg" },
        { type: "photo", url: "https://example.com/media-2.jpg" }
      ],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom, root } = render(React.createElement(OptionsApp))

  try {
    await settle()

    const firstCard = getBookmarkCards(container)[0]
    await act(async () => {
      firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const trigger = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
    assert.ok(trigger)

    await act(async () => {
      trigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const nextButton = findByTestId(container, "media-lightbox-next") as HTMLButtonElement | null
    const initialImage = findByTestId(container, "media-lightbox-image") as HTMLImageElement | null

    assert.ok(nextButton)
    assert.ok(initialImage)
    assert.match(initialImage?.getAttribute("src") ?? "", /media-1\.jpg/)

    await act(async () => {
      nextButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const switchedImage = findByTestId(container, "media-lightbox-image") as HTMLImageElement | null

    assert.ok(switchedImage)
    assert.equal(switchedImage, initialImage)
    assert.match(switchedImage?.getAttribute("src") ?? "", /media-2\.jpg/)
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})

test("OptionsApp preloads adjacent image media while preview is open", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-preload",
      tweetUrl: "https://x.com/alice/status/tweet-media-preload",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Preload preview switch",
      media: [
        { type: "photo", url: "https://example.com/media-1.jpg" },
        { type: "photo", url: "https://example.com/media-2.jpg" },
        { type: "photo", url: "https://example.com/media-3.jpg" }
      ],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const loadedUrls: string[] = []
  const OriginalImage = globalThis.Image

  class FakeImage {
    set src(value: string) {
      loadedUrls.push(value)
    }
  }

  // @ts-expect-error test shim
  globalThis.Image = FakeImage

  try {
    const { container, dom, root } = render(React.createElement(OptionsApp))

    try {
      await settle()

      const firstCard = getBookmarkCards(container)[0]
      await act(async () => {
        firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
      })
      await settle()

      const trigger = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
      assert.ok(trigger)

      await act(async () => {
        trigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
      })
      await settle()

      assert.deepEqual(loadedUrls.sort(), [
        "https://example.com/media-2.jpg",
        "https://example.com/media-3.jpg"
      ])
    } finally {
      await act(async () => {
        root.unmount()
      })
      dom.window.close()
    }
  } finally {
    globalThis.Image = OriginalImage
  }
})

test("OptionsApp keeps preview controls and media surface mounted inside the lightbox", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-structure",
      tweetUrl: "https://x.com/alice/status/tweet-media-structure",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Media structure",
      media: [{ type: "photo", url: "https://example.com/media-1.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom, root } = render(React.createElement(OptionsApp))

  try {
    await settle()

    const firstCard = getBookmarkCards(container)[0]
    await act(async () => {
      firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const trigger = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
    assert.ok(trigger)

    await act(async () => {
      trigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const shell = container.querySelector(".options-media-lightbox-shell") as HTMLDivElement | null
    const content = findByTestId(container, "media-lightbox-content") as HTMLDivElement | null
    const close = findByTestId(container, "media-lightbox-close") as HTMLButtonElement | null

    assert.ok(shell)
    assert.ok(content)
    assert.ok(close)
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})
