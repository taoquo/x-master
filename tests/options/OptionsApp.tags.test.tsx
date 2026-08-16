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
import { attachTagToBookmark, createTag, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { cleanupRenders, render, settle, waitForCondition } from "../helpers/render.tsx"
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

  // Merging writes through IndexedDB, which needs more than a fixed number of
  // ticks when the suite runs files in parallel.
  await waitForCondition(() => container.querySelectorAll("[data-tag-card]").length === 2)
  assert.equal(container.querySelectorAll("[data-tag-card]").length, 2)
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
  assert.equal(graphToggle?.disabled, false)

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

test("OptionsApp assigns a parent theme from the tag management table", async () => {
  const { agentTag, designTag } = await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const parentSelect = container.querySelector(
    `[data-tag-parent-select="${designTag.id}"]`
  ) as HTMLSelectElement | null
  assert.ok(parentSelect)
  assert.equal(parentSelect?.value, "")

  await act(async () => {
    parentSelect.value = agentTag.id
    parentSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
  })
  await settle()

  await waitForCondition(
    () =>
      (container.querySelector(`[data-tag-parent-select="${designTag.id}"]`) as HTMLSelectElement | null)
        ?.value === agentTag.id
  )

  const storedTags = await getAllTags()
  assert.equal(storedTags.find((tag) => tag.id === designTag.id)?.parentId, agentTag.id)

  // A tag that now owns a child can no longer be nested under another theme.
  const agentCell = container.querySelector(`[data-tag-card="${agentTag.id}"]`) as HTMLElement | null
  assert.ok(agentCell)
  assert.equal(agentCell?.querySelector('[data-testid="tag-parent-select"]'), null)
  assert.match(
    agentCell?.querySelector('[data-testid="tag-parent-locked"]')?.textContent ?? "",
    /1 child tags/
  )
  assert.match(findByTestId(container, "tag-header-meta")?.textContent ?? "", /1 without a theme/)
})

test("OptionsApp edits tag aliases inline", async () => {
  const { designTag } = await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const designCard = container.querySelector(`[data-tag-card="${designTag.id}"]`) as HTMLElement | null
  assert.ok(designCard)
  const aliasButton = designCard?.querySelector('[data-testid="tag-edit-aliases"]') as HTMLButtonElement | null
  assert.ok(aliasButton)

  await act(async () => {
    aliasButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const aliasInput = findByTestId(container, "tag-alias-input") as HTMLInputElement | null
  assert.ok(aliasInput)

  await act(async () => {
    setInputValue(aliasInput, " Design Systems , ui , Design ", dom.window)
  })
  await settle()
  const saveButton = findByTestId(container, "tag-alias-save") as HTMLButtonElement | null
  assert.ok(saveButton)
  await act(async () => {
    saveButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  // The write goes through IndexedDB, so poll the rendered card instead of
  // relying on a fixed number of ticks.
  await waitForCondition(() =>
    /Aliases: Design Systems, ui/.test(
      container.querySelector(`[data-tag-card="${designTag.id}"]`)?.textContent ?? ""
    )
  )

  const storedTags = await getAllTags()
  assert.deepEqual(storedTags.find((tag) => tag.id === designTag.id)?.aliases, ["Design Systems", "ui"])
  assert.equal(findByTestId(container, "tag-alias-input"), null)
})

test("OptionsApp renders the tag relation graph and focuses a tag from the node list", async () => {
  const { agentTag, designTag, researchTag } = await seedTagWorkspace()
  // A second tag on the same bookmark is what produces a cooccurrence edge.
  await attachTagToBookmark({ bookmarkId: "tweet-tag-1", tagId: researchTag.id })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const graphToggle = findByTestId(container, "tag-view-toggle-graph") as HTMLButtonElement | null
  assert.ok(graphToggle)
  assert.equal(graphToggle?.disabled, false)

  await act(async () => {
    graphToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "tag-results-graph"))
  assert.equal(findByTestId(container, "tag-results-grid"), null)
  assert.equal(findByTestId(container, "tag-results-table"), null)
  assert.equal(findByTestId(container, "tag-selection-hint"), null)
  assert.ok(findByTestId(container, "tag-graph-canvas"))
  assert.equal(container.querySelectorAll("[data-graph-node]").length, 3)

  const cooccurrenceEdges = Array.from(
    container.querySelectorAll('[data-graph-edge-type="cooccurrence"]')
  )
  assert.equal(cooccurrenceEdges.length, 1)
  assert.equal(
    cooccurrenceEdges[0].getAttribute("data-graph-edge"),
    [agentTag.id, researchTag.id].sort().join(":")
  )

  assert.equal(findByTestId(container, "tag-graph-focus-panel"), null)
  const designChip = container.querySelector(
    `[data-graph-node-button="${designTag.id}"]`
  ) as HTMLButtonElement | null
  assert.ok(designChip)

  await act(async () => {
    designChip.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const focusPanel = findByTestId(container, "tag-graph-focus-panel")
  assert.ok(focusPanel)
  assert.match(focusPanel?.textContent ?? "", /Design/)
  assert.match(findByTestId(container, "tag-graph-focus-authors")?.textContent ?? "", /@bob/)
  assert.ok(findByTestId(container, "tag-graph-clear-focus"))

  const openBookmarks = findByTestId(container, "tag-graph-open-bookmarks") as HTMLButtonElement | null
  assert.ok(openBookmarks)
  await act(async () => {
    openBookmarks.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "library-workspace"))
  assert.equal(findByTestId(container, "tag-library-workspace"), null)
  assert.match(findByTestId(container, "library-header-section")?.textContent ?? "", /Design/)
  assert.equal(container.querySelectorAll("[data-bookmark-card]").length, 1)
})

test("OptionsApp shows the graph empty state when no tags exist", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary()
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const graphToggle = findByTestId(container, "tag-view-toggle-graph") as HTMLButtonElement | null
  assert.ok(graphToggle)
  await act(async () => {
    graphToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "tag-graph-empty-state"))
  assert.equal(findByTestId(container, "tag-results-graph"), null)
})

test("OptionsApp cleans up every tag without bookmarks in one action", async () => {
  await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  const cleanupButton = findByTestId(container, "tag-cleanup-orphans") as HTMLButtonElement | null
  assert.ok(cleanupButton)
  assert.equal(cleanupButton?.disabled, false)

  const originalConfirm = dom.window.confirm
  dom.window.confirm = () => true
  try {
    await act(async () => {
      cleanupButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()
  } finally {
    dom.window.confirm = originalConfirm
  }

  await waitForCondition(() => container.querySelectorAll("[data-tag-card]").length === 2)

  const storedTags = await getAllTags()
  assert.deepEqual(
    storedTags.map((storedTag) => storedTag.name).sort(),
    ["Agent", "Design"]
  )
  assert.equal(
    (findByTestId(container, "tag-cleanup-orphans") as HTMLButtonElement | null)?.disabled,
    true
  )
})

test("OptionsApp caps the sidebar tag rows until the user expands them", async () => {
  await seedTagWorkspace()
  for (let index = 0; index < 8; index += 1) {
    await createTag({ name: `Extra ${index}` })
  }

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  // 8 tag rows + the "all bookmarks" row.
  assert.equal(container.querySelectorAll("[data-list-button]").length, 9)

  const showMore = findByTestId(container, "sidebar-tags-show-more") as HTMLButtonElement | null
  assert.ok(showMore)
  await act(async () => {
    showMore.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(container.querySelectorAll("[data-list-button]").length, 12)
  assert.equal(findByTestId(container, "sidebar-tags-show-more"), null)
})

test("OptionsApp reports tag library health and filters the long tail", async () => {
  await seedTagWorkspace()

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await enterTagManagement(container, dom)

  // Agent and Design hold one bookmark each; Research has none.
  assert.match(findByTestId(container, "tag-health-meta")?.textContent ?? "", /2 long-tail tags/)
  assert.match(findByTestId(container, "tag-health-meta")?.textContent ?? "", /Library size is healthy/)

  const filterTrigger = findByTestId(container, "tag-filter-trigger") as HTMLButtonElement | null
  assert.ok(filterTrigger)
  await act(async () => {
    filterTrigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const longTailOption = container.querySelector(
    '[data-testid="tag-filter-option-long-tail"] input'
  ) as HTMLInputElement | null
  assert.ok(longTailOption)
  await act(async () => {
    longTailOption.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(container.querySelectorAll("[data-tag-card]").length, 2)
  assert.match(findByTestId(container, "tag-filter-chip")?.textContent ?? "", /Long-tail tags/)
})
