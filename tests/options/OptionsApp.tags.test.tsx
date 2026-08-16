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
import { cleanupRenders, render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

test.afterEach(cleanupRenders)

function findByTestId(container: HTMLDivElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

function setInputValue(
  element: HTMLInputElement,
  value: string,
  dom: { HTMLInputElement: typeof HTMLInputElement; Event: typeof Event }
) {
  const descriptor = Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, "value")
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new dom.Event("input", { bubbles: true }))
  element.dispatchEvent(new dom.Event("change", { bubbles: true }))
}

async function seedTagWorkspace(options: Parameters<typeof installChromeRuntimeHarness>[0] = {}) {
  installChromeRuntimeHarness(options)
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-tag-1",
      tweetUrl: "https://x.com/alice/status/tweet-tag-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agent tooling notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z"
    },
    {
      tweetId: "tweet-tag-2",
      tweetUrl: "https://x.com/bob/status/tweet-tag-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Design system notes",
      createdAtOnX: "2026-03-14T00:00:00.000Z",
      savedAt: "2026-03-14T01:00:00.000Z"
    }
  ])

  const agentTag = await createTag({ name: "Agent" })
  const designTag = await createTag({ name: "Design" })
  const researchTag = await createTag({ name: "Research" })
  await attachTagToBookmark({ bookmarkId: "tweet-tag-1", tagId: agentTag.id })
  await attachTagToBookmark({ bookmarkId: "tweet-tag-2", tagId: designTag.id })

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary()
  })

  return { agentTag, designTag, researchTag }
}

async function enterTagManagement(container: HTMLDivElement, dom: { window: { MouseEvent: typeof MouseEvent } }) {
  const manageButton = findByTestId(container, "sidebar-manage-tags") as HTMLButtonElement | null
  assert.ok(manageButton)
  await act(async () => {
    manageButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
}

test("OptionsApp switches the main panel between bookmarks and tag management", async () => {
  await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.ok(findByTestId(container, "library-workspace"))
  assert.equal(findByTestId(container, "tag-library-workspace"), null)

  await enterTagManagement(container, dom)

  assert.ok(findByTestId(container, "tag-library-workspace"))
  assert.equal(findByTestId(container, "library-workspace"), null)
  assert.equal(container.querySelectorAll("[data-tag-card]").length, 3)
  assert.match(findByTestId(container, "tag-results-summary")?.textContent ?? "", /3/)

  const exitButton = findByTestId(container, "tag-exit-management") as HTMLButtonElement | null
  assert.ok(exitButton)
  await act(async () => {
    exitButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "library-workspace"))
  assert.equal(findByTestId(container, "tag-library-workspace"), null)
})

test("OptionsApp filters sidebar tag rows and the tag library with the sidebar search", async () => {
  await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const searchInput = findByTestId(container, "sidebar-tags-search") as HTMLInputElement | null
  assert.ok(searchInput)
  assert.equal(container.querySelectorAll("[data-list-button]").length, 4)

  await act(async () => {
    setInputValue(searchInput, "desi", dom.window)
  })
  await settle()

  const visibleRows = Array.from(container.querySelectorAll("[data-list-button]"))
  assert.equal(visibleRows.length, 2)
  assert.equal(visibleRows[0].getAttribute("data-list-button"), "all")
  assert.match(visibleRows[1].textContent ?? "", /Design/)

  await enterTagManagement(container, dom)

  const cards = Array.from(container.querySelectorAll("[data-tag-card]"))
  assert.equal(cards.length, 1)
  assert.match(cards[0].textContent ?? "", /Design/)
  assert.equal((findByTestId(container, "tag-search-input") as HTMLInputElement | null)?.value, "desi")
})

test("OptionsApp merges selected tags from the tag management bulk bar", async () => {
  const { agentTag } = await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const checkboxes = Array.from(
    container.querySelectorAll('[data-tag-card] input[type="checkbox"]')
  ) as HTMLInputElement[]
  assert.equal(checkboxes.length, 3)

  await act(async () => {
    checkboxes[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  await act(async () => {
    checkboxes[1].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const bulkBar = findByTestId(container, "tag-bulk-actions-bar")
  assert.ok(bulkBar)
  assert.match(bulkBar?.textContent ?? "", /2 selected/)

  const mergeSelect = findByTestId(container, "tag-merge-target-select") as HTMLSelectElement | null
  const mergeButton = findByTestId(container, "tag-bulk-merge") as HTMLButtonElement | null
  assert.ok(mergeSelect)
  assert.ok(mergeButton)
  assert.equal(mergeButton?.disabled, true)

  await act(async () => {
    mergeSelect.value = agentTag.id
    mergeSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
  })
  await settle()

  const originalConfirm = dom.window.confirm
  dom.window.confirm = () => true
  try {
    await act(async () => {
      mergeButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()
  } finally {
    dom.window.confirm = originalConfirm
  }

  const remaining = Array.from(container.querySelectorAll("[data-tag-card]"))
  assert.equal(remaining.length, 2)
  assert.equal(findByTestId(container, "tag-bulk-actions-bar"), null)
})

test("OptionsApp toggles the tag table view and jumps back to the filtered bookmarks", async () => {
  await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const tableToggle = findByTestId(container, "tag-view-toggle-table") as HTMLButtonElement | null
  assert.ok(tableToggle)
  await act(async () => {
    tableToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "tag-results-table"))
  assert.equal(findByTestId(container, "tag-results-grid"), null)
  assert.equal(container.querySelectorAll("[data-tag-row]").length, 3)

  const graphToggle = findByTestId(container, "tag-view-toggle-graph") as HTMLButtonElement | null
  assert.equal(graphToggle?.disabled, true)

  const designRow = container.querySelector('[data-tag-row]:nth-child(2)') as HTMLElement | null
  assert.ok(designRow)
  const viewButton = designRow?.querySelector('[data-testid="tag-view-bookmarks"]') as HTMLButtonElement | null
  assert.ok(viewButton)

  await act(async () => {
    viewButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "library-workspace"))
  assert.equal(findByTestId(container, "tag-library-workspace"), null)
  assert.match(findByTestId(container, "library-header-section")?.textContent ?? "", /Design/)
  assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 1)
})

test("OptionsApp applies the selected llm vocabulary proposals", async () => {
  const plans: {
    merges: Array<{ targetTagId: string; targetName: string; sourceTagIds: string[]; sourceNames: string[]; reason?: string }>
    renames: Array<{ tagId: string; from: string; to: string; reason?: string }>
  } = { merges: [], renames: [] }

  const { agentTag, designTag, researchTag } = await seedTagWorkspace({
    reviewTagVocabulary: async () => ({ ok: true, merges: plans.merges, renames: plans.renames })
  })

  plans.merges = [
    {
      targetTagId: agentTag.id,
      targetName: agentTag.name,
      sourceTagIds: [researchTag.id],
      sourceNames: [researchTag.name],
      reason: "same concept"
    }
  ]
  plans.renames = [{ tagId: designTag.id, from: designTag.name, to: "design system" }]

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  assert.equal(findByTestId(container, "tag-review-panel"), null)

  const reviewButton = findByTestId(container, "tag-review-vocabulary") as HTMLButtonElement | null
  assert.ok(reviewButton)
  await act(async () => {
    reviewButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const panel = findByTestId(container, "tag-review-panel")
  assert.ok(panel)
  const rows = Array.from(container.querySelectorAll("[data-review-key]"))
  assert.equal(rows.length, 2)
  assert.match(rows[0].textContent ?? "", /Research → Agent/)
  assert.match(rows[1].textContent ?? "", /Design → design system/)

  const applyButton = findByTestId(container, "tag-review-apply") as HTMLButtonElement | null
  assert.ok(applyButton)
  assert.equal(applyButton?.disabled, false)

  await act(async () => {
    applyButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "tag-review-panel"), null)
  const cards = Array.from(container.querySelectorAll("[data-tag-card]"))
  assert.equal(cards.length, 2)
  assert.match(cards.map((card) => card.textContent ?? "").join(" "), /design system/)
})

test("OptionsApp reports a failed vocabulary review without touching the tags", async () => {
  await seedTagWorkspace({
    reviewTagVocabulary: async () => ({ ok: false, error: "missing-api-key", merges: [], renames: [] })
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const reviewButton = findByTestId(container, "tag-review-vocabulary") as HTMLButtonElement | null
  assert.ok(reviewButton)
  await act(async () => {
    reviewButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const panel = findByTestId(container, "tag-review-panel")
  assert.ok(panel)
  assert.match(panel?.textContent ?? "", /missing-api-key/)
  assert.equal(findByTestId(container, "tag-review-apply"), null)
  assert.equal(container.querySelectorAll("[data-tag-card]").length, 3)

  const dismissButton = findByTestId(container, "tag-review-dismiss") as HTMLButtonElement | null
  assert.ok(dismissButton)
  await act(async () => {
    dismissButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "tag-review-panel"), null)
})
