import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createTagSuggestion, getAllTagSuggestions, insertNewTagSuggestions } from "../../src/lib/storage/suggestionsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { cleanupRenders, render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

function findByTestId(container: HTMLDivElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

function findAllByTestId(container: HTMLDivElement, testId: string) {
  return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`))
}

async function settleUntil(predicate: () => Promise<boolean> | boolean, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (await predicate()) {
      return
    }

    await settle()
  }
}

async function seedWorkspace() {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Rust systems programming thread",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z"
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "AI agents in production",
      createdAtOnX: "2026-03-16T00:00:00.000Z",
      savedAt: "2026-03-16T01:00:00.000Z"
    }
  ])

  const suggestions = [
    createTagSuggestion({ bookmarkId: "tweet-1", tagName: "Rust", source: "hashtag", confidence: 0.9 }),
    createTagSuggestion({ bookmarkId: "tweet-2", tagName: "AI", source: "keyword", confidence: 0.7 })
  ].filter((suggestion) => suggestion !== null)

  await insertNewTagSuggestions(suggestions)
  return suggestions
}

test.afterEach(async () => {
  await cleanupRenders()
})

test("OptionsApp shows the pending suggestions entry and dashed chips", async () => {
  installChromeRuntimeHarness()
  await seedWorkspace()

  const { container } = render(<OptionsApp />)
  await settle()

  const sidebarEntry = findByTestId(container, "sidebar-pending-suggestions")
  assert.ok(sidebarEntry, "sidebar entry should render when pending suggestions exist")
  assert.match(sidebarEntry?.textContent ?? "", /2/)

  const chips = findAllByTestId(container, "suggestion-chip")
  assert.equal(chips.length, 2)
  assert.ok(findByTestId(container, "suggestions-actions-bar"))
})

test("accepting a suggestion attaches the tag and removes the chip", async () => {
  installChromeRuntimeHarness()
  const [rustSuggestion] = await seedWorkspace()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  const chip = container.querySelector(`[data-suggestion-id="${rustSuggestion.id}"]`)
  assert.ok(chip)
  const acceptButton = chip?.querySelector('[data-testid="suggestion-accept"]') as HTMLButtonElement

  await act(async () => {
    acceptButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const tags = await getAllTags()
  assert.deepEqual(tags.map((tag) => tag.name), ["Rust"])
  const bookmarkTags = await getAllBookmarkTags()
  assert.deepEqual(
    bookmarkTags.map((relation) => [relation.bookmarkId, relation.tagId]),
    [["tweet-1", tags[0]?.id]]
  )

  assert.equal(container.querySelector(`[data-suggestion-id="${rustSuggestion.id}"]`), null)
})

test("rejecting a suggestion keeps the record but hides the chip", async () => {
  installChromeRuntimeHarness()
  const [rustSuggestion] = await seedWorkspace()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  const chip = container.querySelector(`[data-suggestion-id="${rustSuggestion.id}"]`)
  const rejectButton = chip?.querySelector('[data-testid="suggestion-reject"]') as HTMLButtonElement

  await act(async () => {
    rejectButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal((await getAllTags()).length, 0)
  assert.equal(container.querySelector(`[data-suggestion-id="${rustSuggestion.id}"]`), null)

  const stored = await getAllTagSuggestions()
  assert.equal(stored.find((suggestion) => suggestion.id === rustSuggestion.id)?.status, "rejected")
})

test("accept all resolves every visible pending suggestion", async () => {
  installChromeRuntimeHarness()
  await seedWorkspace()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  const acceptAll = findByTestId(container, "suggestions-accept-all") as HTMLButtonElement
  assert.ok(acceptAll)

  await act(async () => {
    acceptAll.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settleUntil(async () => (await getAllTags()).length === 2)
  await settle()

  const tags = await getAllTags()
  assert.deepEqual(tags.map((tag) => tag.name).sort(), ["AI", "Rust"])
  assert.equal((await getAllBookmarkTags()).length, 2)
  assert.equal(findAllByTestId(container, "suggestion-chip").length, 0)
  assert.equal(findByTestId(container, "sidebar-pending-suggestions"), null)
})

test("pending suggestions entry filters results to bookmarks with suggestions", async () => {
  installChromeRuntimeHarness()
  await seedWorkspace()

  await upsertBookmarks([
    {
      tweetId: "tweet-3",
      tweetUrl: "https://x.com/carol/status/tweet-3",
      authorName: "Carol",
      authorHandle: "carol",
      text: "No suggestions here",
      createdAtOnX: "2026-03-17T00:00:00.000Z",
      savedAt: "2026-03-17T01:00:00.000Z"
    }
  ])

  const { container, dom } = render(<OptionsApp />)
  await settle()

  assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 3)

  const sidebarEntry = findByTestId(container, "sidebar-pending-suggestions") as HTMLElement
  await act(async () => {
    sidebarEntry.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 2)

  await act(async () => {
    sidebarEntry.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 3)
})
