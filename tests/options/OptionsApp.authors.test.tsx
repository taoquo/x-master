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

function findListButton(container: HTMLDivElement, listId: string) {
  return container.querySelector(`[data-list-button="${listId}"]`) as HTMLButtonElement | null
}

function findAuthorButton(container: HTMLDivElement, authorHandle: string) {
  return container.querySelector(`[data-author-button="${authorHandle}"]`) as HTMLButtonElement | null
}

function getBookmarkCards(container: HTMLDivElement) {
  return Array.from(container.querySelectorAll("[data-bookmark-card]"))
}

test("OptionsApp filters results by selected sidebar author", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-author-1",
      tweetUrl: "https://x.com/alice/status/tweet-author-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Alice bookmark one",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-author-2",
      tweetUrl: "https://x.com/alice/status/tweet-author-2",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Alice bookmark two",
      createdAtOnX: "2026-03-15T00:05:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-author-3",
      tweetUrl: "https://x.com/bob/status/tweet-author-3",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Bob bookmark",
      createdAtOnX: "2026-03-15T00:10:00.000Z",
      savedAt: "2026-03-15T03:00:00.000Z",
      rawPayload: {}
    }
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

    const authorsSection = findByTestId(container, "sidebar-authors-section")
    const authorsToggle = findByTestId(container, "sidebar-authors-toggle-header") as HTMLButtonElement | null
    assert.ok(authorsToggle)

    await act(async () => {
      authorsToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const bobButton = findAuthorButton(container, "bob")

    assert.ok(authorsSection)
    assert.match(authorsSection?.textContent ?? "", /Authors/)
    assert.ok(bobButton)
    assert.match(bobButton?.textContent ?? "", /Bob/)
    assert.match(bobButton?.textContent ?? "", /@bob/)

    await act(async () => {
      bobButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const cards = getBookmarkCards(container)
    assert.equal(cards.length, 1)
    assert.match(cards[0].textContent ?? "", /Bob bookmark/)
    assert.match(findByTestId(container, "library-header-section")?.textContent ?? "", /Author · @bob/)
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})

test("OptionsApp intersects selected author and tag scopes and All bookmarks clears both", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-intersection-1",
      tweetUrl: "https://x.com/alice/status/tweet-intersection-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Alice AI bookmark",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-intersection-2",
      tweetUrl: "https://x.com/alice/status/tweet-intersection-2",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Alice misc bookmark",
      createdAtOnX: "2026-03-15T00:05:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-intersection-3",
      tweetUrl: "https://x.com/bob/status/tweet-intersection-3",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Bob AI bookmark",
      createdAtOnX: "2026-03-15T00:10:00.000Z",
      savedAt: "2026-03-15T03:00:00.000Z",
      rawPayload: {}
    }
  ])

  const aiTag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-intersection-1", tagId: aiTag.id })
  await attachTagToBookmark({ bookmarkId: "tweet-intersection-3", tagId: aiTag.id })

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
    const aiTagButton = findListButton(container, aiTag.id)
    const allBookmarksButton = findListButton(container, "all")

    assert.ok(authorsToggle)
    await act(async () => {
      authorsToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const nextAliceButton = findAuthorButton(container, "alice")

    assert.ok(nextAliceButton)
    assert.ok(aiTagButton)
    assert.ok(allBookmarksButton)

    await act(async () => {
      nextAliceButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()
    assert.equal(getBookmarkCards(container).length, 2)

    await act(async () => {
      aiTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    let cards = getBookmarkCards(container)
    assert.equal(cards.length, 1)
    assert.match(cards[0].textContent ?? "", /Alice AI bookmark/)

    await act(async () => {
      allBookmarksButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    cards = getBookmarkCards(container)
    assert.equal(cards.length, 3)
    assert.match(findByTestId(container, "library-header-section")?.textContent ?? "", /All bookmarks/)
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
  }
})
