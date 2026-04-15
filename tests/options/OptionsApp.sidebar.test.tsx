import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createEmptySyncSummary } from "../../src/lib/types.ts"
import { saveSettings } from "../../src/lib/storage/settings.ts"
import { attachTagToBookmark, createTag } from "../../src/lib/storage/tagsStore.ts"
import { render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

function findByTestId(container: HTMLDivElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

test("OptionsApp defaults to expanded tags and collapsed authors, then toggles both sections", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-collapse-1",
      tweetUrl: "https://x.com/alice/status/tweet-collapse-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Collapse bookmark",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  const aiTag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-collapse-1", tagId: aiTag.id })

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom, root } = render(React.createElement(OptionsApp))

  try {
    await settle()

    const tagsToggle = findByTestId(container, "sidebar-tags-toggle") as HTMLButtonElement | null
    const authorsToggle = findByTestId(container, "sidebar-authors-toggle-header") as HTMLButtonElement | null

    assert.ok(tagsToggle)
    assert.ok(authorsToggle)
    assert.ok(findByTestId(container, "sidebar-tags-content"))
    assert.equal(findByTestId(container, "sidebar-authors-content"), null)
    assert.equal(tagsToggle?.getAttribute("aria-expanded"), "true")
    assert.equal(authorsToggle?.getAttribute("aria-expanded"), "false")

    await act(async () => {
      authorsToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.ok(findByTestId(container, "sidebar-authors-content"))
    assert.equal(authorsToggle?.getAttribute("aria-expanded"), "true")

    await act(async () => {
      tagsToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.equal(findByTestId(container, "sidebar-tags-content"), null)
    assert.equal(tagsToggle?.getAttribute("aria-expanded"), "false")
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})

test("OptionsApp styles the authors search input and keeps show more without collapse text", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks(
    Array.from({ length: 11 }, (_, index) => ({
      tweetId: `tweet-style-${index + 1}`,
      tweetUrl: `https://x.com/user${index + 1}/status/${index + 1}`,
      authorName: `User ${index + 1}`,
      authorHandle: `user${index + 1}`,
      text: `Style ${index + 1}`,
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }))
  )

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, root, dom } = render(React.createElement(OptionsApp))

  try {
    await settle()

    const authorsToggle = findByTestId(container, "sidebar-authors-toggle-header") as HTMLButtonElement | null
    assert.ok(authorsToggle)

    await act(async () => {
      authorsToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const searchInput = findByTestId(container, "sidebar-authors-search") as HTMLInputElement | null
    const showMoreButton = findByTestId(container, "sidebar-authors-show-more") as HTMLButtonElement | null

    assert.ok(searchInput)
    assert.ok(showMoreButton)
    assert.match(searchInput.className, /options-sidebar-search-input/)
    assert.equal(container.textContent?.includes("Collapse"), false)
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})

test("OptionsApp keeps the tag create action beside the title and aligns the authors disclosure column", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom, root } = render(React.createElement(OptionsApp))

  try {
    await settle()

    const tagsToggle = findByTestId(container, "sidebar-tags-toggle") as HTMLButtonElement | null
    const createTagButton = findByTestId(container, "sidebar-create-tag") as HTMLButtonElement | null
    const tagsContent = findByTestId(container, "sidebar-tags-content")
    const titleLabel = findByTestId(container, "sidebar-tags-title")
    const authorsTitle = findByTestId(container, "sidebar-authors-title")
    const authorsToggle = findByTestId(container, "sidebar-authors-toggle-header") as HTMLButtonElement | null

    assert.ok(tagsToggle)
    assert.ok(createTagButton)
    assert.ok(tagsContent)
    assert.ok(titleLabel)
    assert.ok(authorsTitle)
    assert.ok(authorsToggle)
    assert.equal(createTagButton?.parentElement, titleLabel)
    assert.equal(tagsToggle?.contains(createTagButton as Node), false)
    assert.equal(authorsTitle?.parentElement, authorsToggle?.parentElement)
    assert.equal(authorsToggle?.previousElementSibling, authorsTitle)
    assert.equal(authorsToggle?.querySelector(".options-sidebar-section-toggle-trailing") !== null, true)
    assert.equal(tagsToggle?.querySelector(".options-sidebar-section-toggle-trailing") !== null, true)

    await act(async () => {
      createTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.ok(findByTestId(container, "sidebar-tags-content"))
    assert.ok(findByTestId(container, "sidebar-create-tag-input"))
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})

test("OptionsApp restores large result sets in batches after clearing an author filter", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    ...Array.from({ length: 10 }, (_, index) => ({
      tweetId: `tweet-batch-alice-${index + 1}`,
      tweetUrl: `https://x.com/alice/status/${index + 1}`,
      authorName: "Alice",
      authorHandle: "alice",
      text: `Alice batch ${index + 1}`,
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: `2026-03-15T01:${String(index).padStart(2, "0")}:00.000Z`,
      rawPayload: {}
    })),
    ...Array.from({ length: 80 }, (_, index) => ({
      tweetId: `tweet-batch-bob-${index + 1}`,
      tweetUrl: `https://x.com/bob/status/${index + 1}`,
      authorName: "Bob",
      authorHandle: "bob",
      text: `Bob batch ${index + 1}`,
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: `2026-03-15T02:${String(index).padStart(2, "0")}:00.000Z`,
      rawPayload: {}
    }))
  ])

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom, root } = render(React.createElement(OptionsApp))

  try {
    await settle()

    const authorsToggle = findByTestId(container, "sidebar-authors-toggle-header") as HTMLButtonElement | null
    assert.ok(authorsToggle)

    await act(async () => {
      authorsToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const aliceButton = container.querySelector('[data-author-button="alice"]') as HTMLButtonElement | null
    assert.ok(aliceButton)

    await act(async () => {
      aliceButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 10)

    await act(async () => {
      aliceButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 80)
    assert.match(findByTestId(container, "library-results-summary")?.textContent ?? "", /90 results/)
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})
