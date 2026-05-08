import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { removeBookmarkSnapshot, upsertBookmarkSnapshot, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createList } from "../../src/lib/storage/listsStore.ts"
import { createEmptySyncSummary } from "../../src/lib/types.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { attachTagToBookmark, createTag } from "../../src/lib/storage/tagsStore.ts"
import { cleanupRenders, render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"
import { LOAD_WORKSPACE_DATA_MESSAGE } from "../../src/lib/runtime/messages.ts"

function findButton(container: HTMLDivElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.replace(/\s+/g, " ").includes(label)
  )
}

function findListButton(container: HTMLDivElement, listId: string) {
  return container.querySelector(`[data-list-button="${listId}"]`) as HTMLButtonElement | null
}

function getBookmarkCards(container: HTMLDivElement) {
  return Array.from(container.querySelectorAll("[data-bookmark-card]"))
}

function findByTestId(container: HTMLDivElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

function setInputValue(
  element: HTMLInputElement,
  value: string,
  dom: {
    HTMLInputElement: typeof HTMLInputElement
    Event: typeof Event
  }
) {
  const descriptor = Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, "value")
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new dom.Event("input", { bubbles: true }))
  element.dispatchEvent(new dom.Event("change", { bubbles: true }))
}

test.afterEach(async () => {
  await cleanupRenders()
})

test("OptionsApp renders the Chinese locale shell and keeps demo shell active", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "React agents workflow",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Prompt engineering notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      rawPayload: {}
    }
  ])

  const tag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-2", tagId: tag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 2,
      insertedCount: 2,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-03-15T03:00:00.000Z"
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  assert.match(container.textContent ?? "", /书签/)
  assert.match(container.textContent ?? "", /标签/)
  assert.match(container.textContent ?? "", /偏好设置/)
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.ok(findByTestId(container, "options-brand-logo"))

  assert.equal(findByTestId(container, "toggle-preferences-panel"), null)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)
  assert.equal(container.querySelector(".options-advanced-panel"), null)
  assert.equal(container.querySelector(".options-bulk-panel"), null)

  const tagButton = findListButton(container, tag.id)
  assert.ok(tagButton)

  await act(async () => {
    tagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const cards = getBookmarkCards(container)
  assert.equal(cards.length, 1)
  assert.match(cards[0].textContent ?? "", /Prompt engineering notes/)
  assert.match(cards[0].textContent ?? "", /AI/)
  assert.doesNotMatch(container.textContent ?? "", /WORKSPACE|Archive|METADATA|SUMMARY|MEDIA|TAGS/)
})

test("OptionsApp uses the shared badge and status surface language", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "dark",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-03-15T03:00:00.000Z"
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  const statusBadge = container.querySelector('[data-testid="lists-sidebar"] .status-success') as HTMLElement | null

  assert.ok(statusBadge)
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.match(statusBadge.className, /workspace-badge/)
  assert.match(statusBadge.className, /folio-status-badge/)
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.match(findByTestId(container, "lists-sidebar")?.textContent ?? "", /偏好设置/)
})

test("OptionsApp renders an export action and downloads a workspace backup", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-export-1",
      tweetUrl: "https://x.com/alice/status/tweet-export-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Export this bookmark",
      createdAtOnX: "2026-04-11T08:00:00.000Z",
      savedAt: "2026-04-11T08:05:00.000Z",
      rawPayload: { source: "x" }
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-04-11T08:05:00.000Z"
    },
    classificationRules: []
  })

  let capturedJson = ""
  let capturedDownload = ""
  let revokedUrl = ""
  const { container, dom } = render(React.createElement(OptionsApp))
  const originalCreateObjectUrl = globalThis.URL.createObjectURL
  const originalRevokeObjectUrl = globalThis.URL.revokeObjectURL
  const originalClick = (dom.window.HTMLAnchorElement.prototype as HTMLAnchorElement & { click: () => void }).click

  globalThis.URL.createObjectURL = (blob: Blob | MediaSource) => {
    void (blob as Blob).text().then((value) => {
      capturedJson = value
    })
    return "blob:export"
  }
  globalThis.URL.revokeObjectURL = (url: string) => {
    revokedUrl = url
  }
  ;(dom.window.HTMLAnchorElement.prototype as HTMLAnchorElement & { click: () => void }).click = function click() {
    capturedDownload = this.download
  }

  try {
    await settle()

    const exportButton = findByTestId(container, "footer-export-toggle") as HTMLButtonElement | null
    assert.ok(exportButton)
    assert.equal(exportButton.textContent?.trim() ?? "", "")
    assert.equal(exportButton.getAttribute("aria-label"), "Export data")
    assert.equal(findByTestId(container, "sidebar-export-workspace"), null)

    await act(async () => {
      exportButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.match(String(capturedDownload), /^xbm-workspace-\d{4}-\d{2}-\d{2}\.json$/)
    assert.equal(revokedUrl, "blob:export")
    assert.match(capturedJson, /"bookmarks": \[/)
    assert.doesNotMatch(capturedJson, /"rawPayload"/)
  } finally {
    globalThis.URL.createObjectURL = originalCreateObjectUrl
    globalThis.URL.revokeObjectURL = originalRevokeObjectUrl
    ;(dom.window.HTMLAnchorElement.prototype as HTMLAnchorElement & { click: () => void }).click = originalClick
  }
})

test("OptionsApp surfaces export failures in the shared command error area", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  const originalCreateObjectUrl = globalThis.URL.createObjectURL
  globalThis.URL.createObjectURL = () => {
    throw new Error("download blocked")
  }

  try {
    await settle()

    const exportButton = findByTestId(container, "footer-export-toggle") as HTMLButtonElement | null
    assert.ok(exportButton)

    await act(async () => {
      exportButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    const inlineMessage = findByTestId(container, "sidebar-status-section")?.querySelector(".folio-inline-message") as HTMLElement | null
    assert.ok(inlineMessage)
    assert.match(inlineMessage.textContent ?? "", /download blocked/)
    assert.doesNotMatch(inlineMessage.className, /red|sky/)
  } finally {
    globalThis.URL.createObjectURL = originalCreateObjectUrl
  }
})

test("OptionsApp renders the Figma shell with editorial rails", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-figma-shell",
      tweetUrl: "https://x.com/alice/status/tweet-figma-shell",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Figma shell snapshot",
      createdAtOnX: "2026-04-06T08:00:00.000Z",
      savedAt: "2026-04-06T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 2,
      insertedCount: 2,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-04-06T08:12:00.000Z"
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const overview = findByTestId(container, "workspace-overview")
  const sidebar = findByTestId(container, "lists-sidebar")
  const library = findByTestId(container, "library-workspace")

  assert.ok(overview)
  assert.ok(sidebar)
  assert.ok(library)
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.match(overview?.className ?? "", /xl:grid-cols-\[256px_minmax\(0,1fr\)\]/)
  assert.match(sidebar?.textContent ?? "", /工作区/)
  assert.match(sidebar?.textContent ?? "", /偏好设置/)
  assert.match(library?.textContent ?? "", /资料库/)

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "workspace-detail-modal"))
  assert.ok(findByTestId(container, "inspector-section-stack"))
})

test("OptionsApp renders the english demo shell by default and hides legacy options panels", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-demo-1",
      tweetUrl: "https://x.com/alice/status/tweet-demo-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Demo shell bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.ok(findByTestId(container, "lists-sidebar"))
  assert.ok(findByTestId(container, "library-workspace"))
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.match(container.textContent ?? "", /Workspace/)
  assert.match(container.textContent ?? "", /Archive/)
  assert.match(container.textContent ?? "", /All bookmarks/)
  assert.match(container.textContent ?? "", /Filters/)

  assert.equal(findByTestId(container, "toggle-preferences-panel"), null)
  assert.equal(findButton(container, "高级筛选") ?? findButton(container, "Advanced filters"), undefined)
  assert.equal(findButton(container, "选中当前可见项") ?? findButton(container, "Select visible"), undefined)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)
  assert.equal(container.querySelector(".options-advanced-panel"), null)
  assert.equal(container.querySelector(".options-bulk-panel"), null)
})

test("OptionsApp uses demo tag navigation and footer preference toggles", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const tag = await createTag({ name: "AI" })
  await upsertBookmarks([
    {
      tweetId: "tweet-demo-tag",
      tweetUrl: "https://x.com/alice/status/tweet-demo-tag",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Tagged bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  await attachTagToBookmark({ bookmarkId: "tweet-demo-tag", tagId: tag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const sidebar = findByTestId(container, "lists-sidebar")
  assert.ok(sidebar)
  assert.match(sidebar.textContent ?? "", /全部书签/)
  assert.match(sidebar.textContent ?? "", /AI/)

  const localeToggle = findByTestId(container, "footer-locale-toggle") as HTMLButtonElement | null
  const themeToggle = findByTestId(container, "footer-theme-toggle") as HTMLButtonElement | null
  assert.ok(localeToggle)
  assert.ok(themeToggle)
  assert.equal(localeToggle.textContent?.trim(), "中")

  await act(async () => {
    localeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /Bookmarks/)
  assert.equal(localeToggle.textContent?.trim(), "EN")
  const localeSettings = await getSettings()
  assert.equal(localeSettings.locale, "en")

  await act(async () => {
    themeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const themeSettings = await getSettings()
  assert.equal(themeSettings.themePreference, "system")
})

test("OptionsApp switches between grid and list views and shows english demo filter popover by default", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-grid-media",
      tweetUrl: "https://x.com/alice/status/tweet-grid-media",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Bookmark with media",
      media: [{ type: "photo", url: "https://example.com/image.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      metrics: { likes: 2, replies: 0, retweets: 0 },
      rawPayload: {}
    },
    {
      tweetId: "tweet-grid-long",
      tweetUrl: "https://x.com/bob/status/tweet-grid-long",
      authorName: "Bob",
      authorHandle: "bob",
      text: "L".repeat(360),
      createdAtOnX: "2026-04-09T07:20:00.000Z",
      savedAt: "2026-04-09T08:30:00.000Z",
      metrics: { likes: 99, replies: 0, retweets: 0 },
      rawPayload: {}
    },
    {
      tweetId: "tweet-grid-created",
      tweetUrl: "https://x.com/carol/status/tweet-grid-created",
      authorName: "Carol",
      authorHandle: "carol",
      text: "Newest created bookmark",
      createdAtOnX: "2026-04-09T09:20:00.000Z",
      savedAt: "2026-04-09T08:20:00.000Z",
      metrics: { likes: 5, replies: 0, retweets: 0 },
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const resultsScroll = findByTestId(container, "library-results-scroll")
  const header = findByTestId(container, "library-header-section")
  const toolbar = findByTestId(container, "workspace-toolbar")
  const resultsShell = container.querySelector('[data-testid="results-shell"]')
  const resultsStack = findByTestId(container, "results-stack")
  const listToggle = findByTestId(container, "view-toggle-list") as HTMLButtonElement | null
  const gridToggle = findByTestId(container, "view-toggle-grid") as HTMLButtonElement | null
  const filterTrigger = findByTestId(container, "filter-trigger") as HTMLButtonElement | null
  const sortTrigger = findByTestId(container, "sort-trigger")
  const resultsCount = container.querySelector('[data-testid="results-count"]')
  const summary = container.querySelector(".options-main-header-summary")
  const searchInput = container.querySelector("#filters-search") as HTMLInputElement | null

  assert.ok(resultsScroll)
  assert.ok(header)
  assert.ok(toolbar)
  assert.ok(resultsStack)
  assert.ok(resultsShell)
  assert.ok(listToggle)
  assert.ok(gridToggle)
  assert.ok(filterTrigger)
  assert.ok(sortTrigger)
  assert.ok(resultsCount)
  assert.ok(summary)
  assert.ok(searchInput)
  assert.match(header?.className ?? "", /options-main-header/)
  assert.match(summary?.className ?? "", /options-main-header-summary/)
  assert.match(resultsCount?.className ?? "", /options-main-header-summary-value/)
  assert.match(searchInput?.className ?? "", /options-toolbar-field-compact/)
  assert.equal(resultsScroll?.contains(toolbar as Node), true)
  assert.equal(resultsShell?.contains(toolbar as Node), true)
  assert.match(resultsShell?.className ?? "", /options-results-shell-grid/)
  assert.match(resultsStack?.className ?? "", /options-results-grid/)
  assert.match(resultsStack?.className ?? "", /options-results-masonry/)
  assert.match(resultsStack?.className ?? "", /options-results-stack-grid/)
  assert.match(sortTrigger?.textContent ?? "", /Recently saved/)
  assert.match(getBookmarkCards(container)[0]?.textContent ?? "", /Bob/)
  assert.doesNotMatch(getBookmarkCards(container)[0]?.className ?? "", /min-h-\[220px\]/)

  await act(async () => {
    ;(sortTrigger as HTMLButtonElement).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.match(sortTrigger?.textContent ?? "", /Oldest saved/)
  assert.match(getBookmarkCards(container)[0]?.textContent ?? "", /Alice/)

  await act(async () => {
    ;(sortTrigger as HTMLButtonElement).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.match(sortTrigger?.textContent ?? "", /Newest published/)
  assert.match(getBookmarkCards(container)[0]?.textContent ?? "", /Carol/)

  await act(async () => {
    ;(sortTrigger as HTMLButtonElement).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.match(sortTrigger?.textContent ?? "", /Most liked/)
  assert.match(getBookmarkCards(container)[0]?.textContent ?? "", /Bob/)

  await act(async () => {
    filterTrigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const popover = findByTestId(container, "filter-popover")
  const unreadToggle = container.querySelector('[data-testid="filter-option-unread"] input') as HTMLInputElement | null
  const archivedToggle = container.querySelector('[data-testid="filter-option-archived"] input') as HTMLInputElement | null
  const hasMediaToggle = container.querySelector('[data-testid="filter-option-media"] input') as HTMLInputElement | null

  assert.ok(popover)
  assert.ok(unreadToggle)
  assert.ok(archivedToggle)
  assert.ok(hasMediaToggle)
  assert.equal(unreadToggle.disabled, true)
  assert.equal(archivedToggle.disabled, true)
  assert.match(popover?.textContent ?? "", /Has media/)
  assert.match(popover?.textContent ?? "", /Longform/)
  assert.match(popover?.textContent ?? "", /Unread/)
  assert.match(popover?.textContent ?? "", /Archived/)

  await act(async () => {
    hasMediaToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(findByTestId(container, "active-filters-row")?.textContent ?? "", /Active filters/)
  assert.match(findByTestId(container, "active-filters-row")?.textContent ?? "", /Has media/)
  assert.match(findByTestId(container, "library-results-summary")?.textContent ?? "", /results/)

  await act(async () => {
    listToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  const listResultsShell = container.querySelector('[data-testid="results-shell"]')
  const listResultsStack = findByTestId(container, "results-stack")
  const listCard = getBookmarkCards(container)[0] as HTMLElement | undefined
  assert.match(listResultsShell?.className ?? "", /options-results-shell-list/)
  assert.match(listResultsStack?.className ?? "", /options-results-list/)
  assert.match(listResultsStack?.className ?? "", /options-results-stack-list/)
  assert.doesNotMatch(findByTestId(container, "results-stack")?.className ?? "", /options-results-masonry/)
  assert.match(listCard?.className ?? "", /options-result-card-list/)
  assert.ok(listCard?.querySelector(".options-card-layout"))
  assert.ok(listCard?.querySelector(".options-card-column"))
  assert.ok(listCard?.querySelector(".options-card-side"))
  assert.ok(listCard?.querySelector(".options-card-media-inline"))
  assert.equal(listCard?.querySelectorAll(".options-card-stat").length, 3)
  assert.match(listCard?.querySelector(".options-card-stat-list")?.textContent ?? "", /2/)
  assert.equal(listCard?.querySelectorAll(".options-card-actions-start button").length, 0)

  await act(async () => {
    gridToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  const resetGridResultsShell = container.querySelector('[data-testid="results-shell"]')
  assert.match(resetGridResultsShell?.className ?? "", /options-results-shell-grid/)
  assert.match(findByTestId(container, "results-stack")?.className ?? "", /options-results-grid/)
  assert.match(findByTestId(container, "results-stack")?.className ?? "", /options-results-masonry/)
  assert.match(findByTestId(container, "results-stack")?.className ?? "", /options-results-stack-grid/)
  assert.doesNotMatch(getBookmarkCards(container)[0]?.className ?? "", /options-result-card-list/)
})

test("OptionsApp keeps a shared card hierarchy across short, long, and media bookmarks", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-card-short",
      tweetUrl: "https://x.com/alice/status/tweet-card-short",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Short bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-card-long",
      tweetUrl: "https://x.com/bob/status/tweet-card-long",
      authorName: "Bob",
      authorHandle: "bob",
      text: "L".repeat(360),
      createdAtOnX: "2026-04-09T07:20:00.000Z",
      savedAt: "2026-04-09T08:30:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-card-media",
      tweetUrl: "https://x.com/carol/status/tweet-card-media",
      authorName: "Carol",
      authorHandle: "carol",
      text: "Bookmark with media",
      media: [{ type: "photo", url: "https://example.com/image.jpg" }],
      createdAtOnX: "2026-04-09T09:20:00.000Z",
      savedAt: "2026-04-09T08:20:00.000Z",
      rawPayload: {}
    }
  ])

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const cards = getBookmarkCards(container) as HTMLElement[]
  assert.equal(cards.length, 3)

  for (const card of cards) {
    assert.ok(card.querySelector(".options-card-main"))
    assert.ok(card.querySelector(".options-card-header"))
    assert.ok(card.querySelector(".options-card-author"))
    assert.ok(card.querySelector(".options-card-author-name"))
    assert.ok(card.querySelector(".options-card-author-handle"))
    assert.ok(card.querySelector(".options-card-copy-wrap"))
    assert.ok(card.querySelector(".options-card-actions"))
  }

  const shortCard = container.querySelector('[data-bookmark-card="tweet-card-short"]') as HTMLElement | null
  const longCard = container.querySelector('[data-bookmark-card="tweet-card-long"]') as HTMLElement | null
  const mediaCard = container.querySelector('[data-bookmark-card="tweet-card-media"]') as HTMLElement | null

  assert.ok(shortCard)
  assert.ok(longCard)
  assert.ok(mediaCard)
  assert.equal(shortCard?.querySelector(".options-card-media"), null)
  assert.equal(longCard?.querySelector(".options-card-media"), null)
  assert.ok(mediaCard?.querySelector(".options-card-media"))
  assert.match(mediaCard?.querySelector(".options-card-copy")?.className ?? "", /is-media/)
  assert.match(shortCard?.querySelector(".options-card-main")?.className ?? "", /options-card-main/)
  assert.match(longCard?.querySelector(".options-card-main")?.className ?? "", /options-card-main/)
})

test("OptionsApp adapts list summary density to media tags and text length", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-list-copy-short",
      tweetUrl: "https://x.com/alice/status/tweet-list-copy-short",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Short summary.",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-list-copy-base",
      tweetUrl: "https://x.com/bob/status/tweet-list-copy-base",
      authorName: "Bob",
      authorHandle: "bob",
      text: "This is a medium length summary for the list view that should stay readable and can safely use the fuller three-line treatment when there are no media or tag chips competing for vertical space.",
      createdAtOnX: "2026-04-09T07:20:00.000Z",
      savedAt: "2026-04-09T08:30:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-list-copy-media",
      tweetUrl: "https://x.com/carol/status/tweet-list-copy-media",
      authorName: "Carol",
      authorHandle: "carol",
      text: "Media summary should tighten up in list mode to keep the overall row height stable.",
      media: [{ type: "photo", url: "https://example.com/image.jpg" }],
      createdAtOnX: "2026-04-09T09:20:00.000Z",
      savedAt: "2026-04-09T08:20:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-list-copy-tagged",
      tweetUrl: "https://x.com/dan/status/tweet-list-copy-tagged",
      authorName: "Dan",
      authorHandle: "dan",
      text: "Tagged summaries should not expand to the loosest three-line mode because the tag row already adds another layer under the body copy in the compact list layout.",
      createdAtOnX: "2026-04-09T09:40:00.000Z",
      savedAt: "2026-04-09T08:40:00.000Z",
      rawPayload: {}
    }
  ])
  const designTag = await createTag({ name: "Design" })
  await attachTagToBookmark({ bookmarkId: "tweet-list-copy-tagged", tagId: designTag.id })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const listToggle = findByTestId(container, "view-toggle-list") as HTMLButtonElement | null
  assert.ok(listToggle)

  await act(async () => {
    listToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const shortCopy = container.querySelector('[data-bookmark-card="tweet-list-copy-short"] .options-card-copy') as HTMLElement | null
  const baseCopy = container.querySelector('[data-bookmark-card="tweet-list-copy-base"] .options-card-copy') as HTMLElement | null
  const mediaCopy = container.querySelector('[data-bookmark-card="tweet-list-copy-media"] .options-card-copy') as HTMLElement | null
  const taggedCopy = container.querySelector('[data-bookmark-card="tweet-list-copy-tagged"] .options-card-copy') as HTMLElement | null

  assert.ok(shortCopy)
  assert.ok(baseCopy)
  assert.ok(mediaCopy)
  assert.ok(taggedCopy)
  assert.match(shortCopy?.className ?? "", /is-list-1line/)
  assert.match(baseCopy?.className ?? "", /is-list-3line/)
  assert.match(mediaCopy?.className ?? "", /is-list-2line/)
  assert.match(taggedCopy?.className ?? "", /is-list-2line/)
})

test("OptionsApp stabilizes list cards with explicit templates and capped tags", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })
  await upsertBookmarks([
    {
      tweetId: "tweet-list-template-compact",
      tweetUrl: "https://x.com/alice/status/tweet-list-template-compact",
      authorName: "Alexandria Catherine Montgomery-Wu",
      authorHandle: "alexandria_super_long_handle",
      text: "Short note.",
      metrics: { likes: 1245, replies: 12, retweets: 8 },
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-list-template-tagged",
      tweetUrl: "https://x.com/bob/status/tweet-list-template-tagged",
      authorName: "Bob Longlastname The Third",
      authorHandle: "bob_with_very_long_handle_name",
      text: "This tagged bookmark should keep a stable list-row height even when many tags want to appear at once, so the UI needs to cap the visible pills and collapse the remainder into a compact overflow indicator.",
      metrics: { likes: 9876, replies: 54, retweets: 32 },
      createdAtOnX: "2026-04-09T07:20:00.000Z",
      savedAt: "2026-04-09T08:30:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-list-template-media",
      tweetUrl: "https://x.com/carol/status/tweet-list-template-media",
      authorName: "Carol",
      authorHandle: "carol",
      text: "Media rows should use the dedicated media template.",
      media: [{ type: "photo", url: "https://example.com/image.jpg" }],
      metrics: { likes: 45, replies: 4, retweets: 3 },
      createdAtOnX: "2026-04-09T09:20:00.000Z",
      savedAt: "2026-04-09T08:20:00.000Z",
      rawPayload: {}
    }
  ])

  const tags = await Promise.all([
    createTag({ name: "Design" }),
    createTag({ name: "Systems" }),
    createTag({ name: "Research" }),
    createTag({ name: "Product" })
  ])
  for (const tag of tags) {
    await attachTagToBookmark({ bookmarkId: "tweet-list-template-tagged", tagId: tag.id })
  }

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const listToggle = findByTestId(container, "view-toggle-list") as HTMLButtonElement | null
  assert.ok(listToggle)

  await act(async () => {
    listToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const compactCard = container.querySelector('[data-bookmark-card="tweet-list-template-compact"]') as HTMLElement | null
  const taggedCard = container.querySelector('[data-bookmark-card="tweet-list-template-tagged"]') as HTMLElement | null
  const mediaCard = container.querySelector('[data-bookmark-card="tweet-list-template-media"]') as HTMLElement | null
  const taggedTags = Array.from(taggedCard?.querySelectorAll(".options-card-tag") ?? []).map((node) => node.textContent?.trim() ?? "")

  assert.ok(compactCard)
  assert.ok(taggedCard)
  assert.ok(mediaCard)
  assert.match(compactCard?.className ?? "", /options-result-card-list-template-compact/)
  assert.match(taggedCard?.className ?? "", /options-result-card-list-template-tagged/)
  assert.match(mediaCard?.className ?? "", /options-result-card-list-template-media/)
  assert.match(taggedCard?.querySelector(".options-card-author-name")?.className ?? "", /truncate/)
  assert.equal(taggedTags.length, 3)
  assert.equal(taggedTags[2], "+2")
  assert.equal(new Set(taggedTags.slice(0, 2)).size, 2)
})

test("OptionsApp renders the demo inspector and localized copy", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-inspector",
      tweetUrl: "https://x.com/alice/status/tweet-inspector",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Inspector content summary",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.equal(findByTestId(container, "workspace-detail-modal"), null)

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "workspace-detail-modal"))
  assert.match(container.textContent ?? "", /Alice/)
  assert.match(container.textContent ?? "", /@alice/)
  assert.match(container.textContent ?? "", /Inspector content summary/)
  assert.ok(findByTestId(container, "detail-open-x-link"))
  assert.ok(findByTestId(container, "detail-new-tag-input"))
  assert.ok(findByTestId(container, "detail-create-tag"))
  assert.equal(findByTestId(container, "attach-tag-trigger"), null)
})

test("OptionsApp theme toggle keeps system preference reachable", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  let themeToggle = findByTestId(container, "footer-theme-toggle") as HTMLButtonElement | null
  if (!themeToggle) {
    await settle()
    themeToggle = findByTestId(container, "footer-theme-toggle") as HTMLButtonElement | null
  }
  assert.ok(themeToggle)

  await act(async () => {
    themeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.equal((await getSettings()).themePreference, "dark")

  await act(async () => {
    themeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.equal((await getSettings()).themePreference, "light")

  await act(async () => {
    themeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.equal((await getSettings()).themePreference, "system")
})

test("OptionsApp theme toggle flips immediately against resolved dark system theme", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp), { prefersDark: true })
  await settle()

  const themeToggle = findByTestId(container, "footer-theme-toggle") as HTMLButtonElement | null
  assert.ok(themeToggle)
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")

  await act(async () => {
    themeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.equal(dom.window.document.documentElement.dataset.theme, "light")
  assert.equal((await getSettings()).themePreference, "light")
})

test("OptionsApp disables transitions briefly during theme swaps", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  const themeToggle = findByTestId(container, "footer-theme-toggle") as HTMLButtonElement | null
  assert.ok(themeToggle)
  assert.equal(dom.window.document.documentElement.dataset.theme, "light")
  assert.equal(dom.window.document.documentElement.dataset.themeSwitching, undefined)

  await act(async () => {
    themeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.equal(dom.window.document.documentElement.dataset.themeSwitching, "true")

  await settle()

  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.equal(dom.window.document.documentElement.dataset.themeSwitching, undefined)
})

test("OptionsApp applies shared theme surface hooks to primary shells", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-theme-surface",
      tweetUrl: "https://x.com/alice/status/tweet-theme-surface",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Theme surface bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const sidebar = findByTestId(container, "lists-sidebar")
  const toolbar = findByTestId(container, "workspace-toolbar")
  const resultsShell = container.querySelector('[data-testid="results-shell"]')
  const card = getBookmarkCards(container)[0]

  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.match(sidebar?.className ?? "", /options-theme-panel/)
  assert.match(sidebar?.className ?? "", /folio-index-panel/)
  assert.match(toolbar?.className ?? "", /options-theme-panel/)
  assert.match(toolbar?.className ?? "", /folio-filter-bar/)
  assert.match(resultsShell?.className ?? "", /options-theme-surface/)
  assert.match(card?.className ?? "", /options-theme-elevated/)
})

test("OptionsApp applies shared theme surface hooks to secondary overlays and feed states", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const filterTrigger = findByTestId(container, "filter-trigger") as HTMLButtonElement | null
  assert.ok(filterTrigger)

  await act(async () => {
    filterTrigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const filterPopover = findByTestId(container, "filter-popover")
  const emptyState = findByTestId(container, "feed-empty-state")

  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.match(filterPopover?.className ?? "", /options-theme-elevated/)
  assert.match(emptyState?.className ?? "", /options-theme-panel/)

  await upsertBookmarks([
    {
      tweetId: "tweet-theme-lightbox",
      tweetUrl: "https://x.com/alice/status/tweet-theme-lightbox",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Lightbox theme bookmark",
      media: [{ type: "photo", url: "https://example.com/theme-lightbox.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  dom.window.dispatchEvent(new dom.window.FocusEvent("focus"))
  await settle()
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const mediaButton = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  assert.ok(mediaButton)

  await act(async () => {
    mediaButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const mediaLightbox = findByTestId(container, "media-lightbox")
  const mediaShell = container.querySelector(".options-media-lightbox-shell")
  const mediaContent = container.querySelector(".options-media-lightbox-content")

  assert.ok(mediaLightbox)
  assert.match(mediaLightbox?.className ?? "", /options-theme-overlay/)
  assert.match(mediaShell?.className ?? "", /options-theme-panel/)
  assert.match(mediaContent?.className ?? "", /options-theme-elevated/)
})

test("OptionsApp applies shared theme hooks to chips pills and secondary actions", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-theme-controls",
      tweetUrl: "https://x.com/alice/status/tweet-theme-controls",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Theme control bookmark",
      media: [{ type: "photo", url: "https://example.com/theme-controls.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  const importantTag = await createTag({ name: "Important" })
  const followUpTag = await createTag({ name: "Follow Up" })
  await attachTagToBookmark({ bookmarkId: "tweet-theme-controls", tagId: importantTag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const filterTrigger = findByTestId(container, "filter-trigger") as HTMLButtonElement | null
  assert.ok(filterTrigger)
  await act(async () => {
    filterTrigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const hasMediaToggle = container.querySelector('[data-testid="filter-option-media"] input') as HTMLInputElement | null
  assert.ok(hasMediaToggle)
  await act(async () => {
    hasMediaToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const activeChip = container.querySelector(".options-chip") as HTMLElement | null
  assert.ok(activeChip)
  assert.match(activeChip?.className ?? "", /options-theme-elevated/)

  const firstCard = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const openOnXButton = findByTestId(container, "detail-open-x-link") as HTMLButtonElement | null
  const tagInput = findByTestId(container, "detail-new-tag-input") as HTMLInputElement | null
  assert.ok(openOnXButton)
  assert.ok(tagInput)
  assert.match(openOnXButton?.className ?? "", /options-theme-elevated/)
  assert.equal(tagInput?.getAttribute("list"), "details-tag-options")

  await act(async () => {
    setInputValue(tagInput!, followUpTag.name, dom.window)
  })
  await settle()

  await act(async () => {
    tagInput!.form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  })
  await settle()

  const currentTagButton = container.querySelector('[data-testid="current-tags"] .options-tag-pill') as HTMLElement | null
  assert.ok(currentTagButton)
  assert.match(currentTagButton?.className ?? "", /options-theme-elevated/)
})

test("OptionsApp applies demo multi-tag AND filtering and falls back to all", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-ai",
      tweetUrl: "https://x.com/alice/status/tweet-ai",
      authorName: "Alice",
      authorHandle: "alice",
      text: "AI only bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-both",
      tweetUrl: "https://x.com/bob/status/tweet-untagged",
      authorName: "Bob",
      authorHandle: "bob",
      text: "AI and Design bookmark",
      createdAtOnX: "2026-04-09T08:20:00.000Z",
      savedAt: "2026-04-09T08:30:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-design",
      tweetUrl: "https://x.com/carol/status/tweet-design",
      authorName: "Carol",
      authorHandle: "carol",
      text: "Design only bookmark",
      createdAtOnX: "2026-04-09T08:40:00.000Z",
      savedAt: "2026-04-09T08:50:00.000Z",
      rawPayload: {}
    }
  ])
  const aiTag = await createTag({ name: "AI" })
  const designTag = await createTag({ name: "Design" })
  await attachTagToBookmark({ bookmarkId: "tweet-ai", tagId: aiTag.id })
  await attachTagToBookmark({ bookmarkId: "tweet-both", tagId: aiTag.id })
  await attachTagToBookmark({ bookmarkId: "tweet-both", tagId: designTag.id })
  await attachTagToBookmark({ bookmarkId: "tweet-design", tagId: designTag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "light",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const aiTagButton = findListButton(container, aiTag.id)
  const designTagButton = findListButton(container, designTag.id)
  assert.ok(aiTagButton)
  assert.ok(designTagButton)

  await act(async () => {
    aiTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  let cards = getBookmarkCards(container)
  assert.equal(cards.length, 2)
  assert.match(container.textContent ?? "", /AI/)

  await act(async () => {
    designTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  cards = getBookmarkCards(container)
  assert.equal(cards.length, 1)
  assert.match(cards[0].textContent ?? "", /AI and Design bookmark/)
  assert.match(container.textContent ?? "", /AI \+ Design/)

  const allButton = findListButton(container, "all")
  assert.ok(allButton)
  await act(async () => {
    aiTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  cards = getBookmarkCards(container)
  assert.equal(cards.length, 2)
  assert.match(cards[0].textContent ?? "", /Design/)

  await act(async () => {
    designTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(allButton.className, /options-nav-row-active/)
  assert.match(container.textContent ?? "", /All bookmarks/)
  assert.equal(getBookmarkCards(container).length, 3)
})

test("OptionsApp supports adding existing tags in the inspector without legacy bulk panel", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Prompts",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      rawPayload: {}
    }
  ])

  const importantTag = await createTag({ name: "Important" })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.equal(container.querySelector(".options-bulk-panel"), null)
  assert.ok(getBookmarkCards(container).length >= 1)

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const tagInput = findByTestId(container, "detail-new-tag-input") as HTMLInputElement | null
  assert.ok(tagInput)
  assert.equal(container.querySelector('[data-testid="attach-tag-select"]'), null)

  await act(async () => {
    setInputValue(tagInput!, importantTag.name, dom.window)
  })
  await settle()

  await act(async () => {
    tagInput!.form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  })
  await settle()

  const currentTags = container.querySelector('[data-testid="current-tags"]')
  assert.ok(currentTags)
  assert.doesNotMatch(currentTags.textContent ?? "", /No tags yet/)
  assert.match(currentTags.textContent ?? "", /Important/)
  assert.equal(container.querySelector('[data-testid="attach-tag-select"]'), null)
  assert.equal(findByTestId(container, "attach-tag-trigger"), null)

})

test("OptionsApp filters results by selected sidebar tag", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents workflow notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Prompt engineering notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T02:00:00.000Z",
      rawPayload: {}
    }
  ])

  const aiTag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-2", tagId: aiTag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.ok(findByTestId(container, "workspace-shell"))
  assert.ok(findByTestId(container, "library-workspace"))
  assert.ok(findByTestId(container, "lists-sidebar"))
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.ok(findByTestId(container, "workspace-toolbar"))
  assert.ok(findByTestId(container, "sidebar-lists-scroll"))
  assert.ok(findByTestId(container, "sidebar-list-tree"))
  assert.ok(findByTestId(container, "library-results-scroll"))
  assert.ok(findByTestId(container, "results-stack"))
  assert.equal(findByTestId(container, "inline-list-name-input"), null)
  assert.equal(getBookmarkCards(container).length, 2)

  const aiTagButton = findListButton(container, aiTag.id)
  assert.ok(aiTagButton)

  await act(async () => {
    aiTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const cards = getBookmarkCards(container)
  assert.equal(cards.length, 1)
  assert.match(cards[0].textContent ?? "", /Prompt engineering notes/)
})

test("OptionsApp uses rail layout and shared field/button primitives", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const overview = findByTestId(container, "workspace-overview")
  const sidebar = findByTestId(container, "lists-sidebar")
  const library = findByTestId(container, "library-workspace")
  const syncButton = findButton(container, "Sync now")
  const searchInput = container.querySelector("#filters-search") as HTMLInputElement | null

  assert.ok(overview)
  assert.ok(sidebar)
  assert.ok(library)
  assert.ok(syncButton)
  assert.ok(searchInput)
  assert.match(overview?.className ?? "", /xl:grid-cols-\[256px_minmax\(0,1fr\)\]/)
  assert.match(sidebar?.className ?? "", /options-sidebar-shell/)
  assert.match(sidebar?.className ?? "", /folio-index-panel/)
  assert.match(library?.className ?? "", /options-main-shell/)
  assert.match(syncButton?.className ?? "", /workspace-sync-primary/)
  assert.match(syncButton?.className ?? "", /folio-secondary-action/)
  assert.match(searchInput.className, /options-toolbar-field/)
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
})

test("OptionsApp opens the detail card on card click and clears selection when it closes", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const modal = findByTestId(container, "workspace-detail-modal")
  const inspector = container.querySelector(".options-inspector-shell") as HTMLElement | null
  const openOnXButton = findButton(container, "Open on X")
  const openOnXIcon = findByTestId(container, "detail-open-x-link") as HTMLButtonElement | null
  const closeButton = findByTestId(container, "detail-drawer-close") as HTMLButtonElement | null

  assert.ok(modal)
  assert.ok(inspector)
  assert.ok(findByTestId(container, "detail-new-tag-input"))
  assert.equal(findByTestId(container, "attach-tag-trigger"), null)
  assert.ok(openOnXButton)
  assert.ok(openOnXIcon)
  assert.ok(closeButton)
  assert.match(inspector.className, /options-inspector-shell/)
  assert.match(inspector.className, /folio-detail-rail/)
  assert.match(findByTestId(container, "detail-hero-section")?.className ?? "", /folio-detail-hero/)
  assert.match(firstCard.className, /options-result-card-selected/)
  assert.equal(container.querySelector('[data-testid="attach-tag-select"]'), null)

  await act(async () => {
    closeButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.doesNotMatch(firstCard.className, /options-result-card-selected/)
})

test("OptionsApp prioritizes detail card hero summary tags and media sections", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-detail-priority",
      tweetUrl: "https://x.com/alice/status/tweet-detail-priority",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Detail card priority content should read like a focused object view, with a stronger hero, a stable summary card, a dedicated media block, and tags separated into current and add layers.",
      media: [{ type: "photo", url: "https://example.com/detail-priority.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  const importantTag = await createTag({ name: "Important" })
  await createTag({ name: "Later" })
  await attachTagToBookmark({ bookmarkId: "tweet-detail-priority", tagId: importantTag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = container.querySelector('[data-bookmark-card="tweet-detail-priority"]') as HTMLElement | null
  assert.ok(card)

  await act(async () => {
    card!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const modal = findByTestId(container, "workspace-detail-modal")
  const hero = findByTestId(container, "detail-hero-section")
  const heroActions = findByTestId(container, "detail-primary-actions")
  const timeline = findByTestId(container, "inspector-timeline-section")
  const summary = findByTestId(container, "inspector-summary-section")
  const summaryCard = findByTestId(container, "detail-summary-card")
  const media = findByTestId(container, "inspector-media-section")
  const tags = findByTestId(container, "inspector-tags-section")
  const currentTags = findByTestId(container, "current-tags")
  const currentTagGroup = container.querySelector(".options-detail-tag-group-current") as HTMLElement | null
  const addTagGroup = container.querySelector(".options-detail-tag-group-add") as HTMLElement | null
  const tagEntry = container.querySelector(".options-detail-tag-entry") as HTMLElement | null

  assert.ok(modal)
  assert.ok(hero)
  assert.ok(heroActions)
  assert.ok(timeline)
  assert.ok(summary)
  assert.ok(summaryCard)
  assert.ok(media)
  assert.ok(tags)
  assert.ok(currentTags)
  assert.ok(currentTagGroup)
  assert.ok(addTagGroup)
  assert.ok(tagEntry)
  assert.match(hero?.className ?? "", /options-detail-hero/)
  assert.match(heroActions?.className ?? "", /options-detail-hero-actions/)
  assert.doesNotMatch(summary?.className ?? "", /options-detail-summary-card/)
  assert.match(summaryCard?.className ?? "", /options-detail-summary-card/)
  assert.equal(
    Boolean((summary as Node).compareDocumentPosition(summaryCard as Node) & dom.window.Node.DOCUMENT_POSITION_CONTAINED_BY),
    true
  )
  assert.doesNotMatch(summaryCard?.textContent ?? "", /Summary/)
  assert.match(media?.className ?? "", /options-detail-media-section/)
  assert.match(media?.className ?? "", /options-detail-media-flow/)
  assert.match(summary?.className ?? "", /options-detail-summary-flow/)
  assert.match(tags?.className ?? "", /options-detail-tags-section/)
  assert.match(currentTagGroup?.className ?? "", /options-detail-tag-group-current/)
  assert.match(addTagGroup?.className ?? "", /options-detail-tag-group-add/)
  assert.match(currentTags?.className ?? "", /options-detail-current-tags/)
  assert.match(currentTags?.textContent ?? "", /Important/)
  assert.match(tagEntry?.className ?? "", /options-detail-tag-entry/)
  assert.ok(findByTestId(container, "detail-new-tag-input"))
  assert.equal(findByTestId(container, "attach-tag-trigger"), null)
  assert.ok(Array.from(currentTags?.querySelectorAll(".options-tag-pill") ?? []).length >= 1)
  assert.equal(currentTags?.textContent?.includes("Later"), false)
})

test("OptionsApp opens bookmark details as a centered focus card with timeline and footer actions", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-focus-card",
      tweetUrl: "https://x.com/alice/status/tweet-focus-card",
      authorName: "Alice Chen",
      authorHandle: "alice",
      text: "Focused detail content should use the existing bookmark summary text without inventing a replacement.",
      createdAtOnX: "2026-05-04T15:32:00.000Z",
      savedAt: "2026-05-05T14:19:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = container.querySelector('[data-bookmark-card="tweet-focus-card"]') as HTMLElement | null
  assert.ok(card)

  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const modal = findByTestId(container, "workspace-detail-modal")
  const backdrop = findByTestId(container, "workspace-detail-backdrop")
  const focusCard = findByTestId(container, "workspace-detail-card")
  const timeline = findByTestId(container, "inspector-timeline-section")
  const footer = findByTestId(container, "detail-footer-actions")

  assert.ok(modal)
  assert.ok(backdrop)
  assert.ok(focusCard)
  assert.ok(timeline)
  assert.ok(footer)
  assert.match(focusCard?.className ?? "", /options-detail-focus-card/)
  assert.ok(findByTestId(container, "detail-author-line"))
  assert.doesNotMatch(findByTestId(container, "detail-hero-section")?.textContent ?? "", /书签内容/)
  assert.match(timeline?.textContent ?? "", /时间线/)
  assert.match(timeline?.textContent ?? "", /发布于/)
  assert.match(timeline?.textContent ?? "", /保存于/)
  assert.equal(
    Boolean((timeline as Node).compareDocumentPosition(findByTestId(container, "inspector-summary-section") as Node) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING),
    true
  )
  assert.match(findByTestId(container, "inspector-summary-section")?.textContent ?? "", /Focused detail content/)
  assert.ok(findButton(container, "复制链接"))
  assert.ok(findButton(container, "完成"))
  assert.match(card.className, /options-result-card-selected/)
  assert.equal(dom.window.document.body.classList.contains("options-detail-scroll-locked"), true)
})

test("OptionsApp creates and attaches a new tag from the focused detail card", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-create-detail-tag",
      tweetUrl: "https://x.com/alice/status/tweet-create-detail-tag",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Create tag inside detail card",
      createdAtOnX: "2026-05-04T15:32:00.000Z",
      savedAt: "2026-05-05T14:19:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const tagInput = findByTestId(container, "detail-new-tag-input") as HTMLInputElement | null
  const addButton = findByTestId(container, "detail-create-tag") as HTMLButtonElement | null

  assert.ok(tagInput)
  assert.ok(addButton)
  assert.ok(findByTestId(container, "current-tags"))
  assert.equal(findByTestId(container, "attach-tag-trigger"), null)

  await act(async () => {
    setInputValue(tagInput, "法国", dom.window)
  })
  await settle()

  await act(async () => {
    tagInput.form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  })
  await settle()
  await settle()

  assert.match(findByTestId(container, "current-tags")?.textContent ?? "", /法国/)
  assert.equal(tagInput.value, "")
})

test("OptionsApp reuses the detail tag entry to attach an existing tag by name", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-reuse-detail-tag",
      tweetUrl: "https://x.com/alice/status/tweet-reuse-detail-tag",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Reuse tag entry inside detail card",
      createdAtOnX: "2026-05-04T15:32:00.000Z",
      savedAt: "2026-05-05T14:19:00.000Z",
      rawPayload: {}
    }
  ])
  await createTag({ name: "法国" })
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const tagInput = findByTestId(container, "detail-new-tag-input") as HTMLInputElement | null
  const attachTrigger = findByTestId(container, "attach-tag-trigger") as HTMLButtonElement | null

  assert.ok(tagInput)
  assert.equal(attachTrigger, null)
  assert.equal((findByTestId(container, "detail-create-tag") as HTMLButtonElement | null)?.textContent?.includes("添加标签"), true)

  await act(async () => {
    setInputValue(tagInput, "法国", dom.window)
  })
  await settle()

  await act(async () => {
    tagInput.form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  })
  await settle()
  await settle()

  assert.match(findByTestId(container, "current-tags")?.textContent ?? "", /法国/)
  assert.equal(findByTestId(container, "attach-tag-trigger"), null)
})

test("OptionsApp closes the centered detail card from backdrop and done action", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-focus-close",
      tweetUrl: "https://x.com/alice/status/tweet-focus-close",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Closing focused modal",
      createdAtOnX: "2026-05-04T15:32:00.000Z",
      savedAt: "2026-05-05T14:19:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "workspace-detail-modal"))

  await act(async () => {
    ;(findByTestId(container, "workspace-detail-backdrop") as HTMLButtonElement).dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true })
    )
  })
  await settle()

  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.doesNotMatch(card.className, /options-result-card-selected/)
  assert.equal(dom.window.document.body.classList.contains("options-detail-scroll-locked"), false)

  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const doneButton = findButton(container, "完成") as HTMLButtonElement | undefined
  assert.ok(doneButton)

  await act(async () => {
    doneButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.equal(dom.window.document.body.classList.contains("options-detail-scroll-locked"), false)
})

test("OptionsApp copies the bookmark link from the focused detail card", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-copy-link",
      tweetUrl: "https://x.com/alice/status/tweet-copy-link",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Copy link bookmark",
      createdAtOnX: "2026-05-04T15:32:00.000Z",
      savedAt: "2026-05-05T14:19:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  let copiedText = ""
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copiedText = value
      }
    }
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator
  })

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const copyButton = findButton(container, "Copy link") as HTMLButtonElement | undefined
  assert.ok(copyButton)

  await act(async () => {
    copyButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(copiedText, "https://x.com/alice/status/tweet-copy-link")
  assert.equal(findByTestId(container, "detail-toast"), null)
})

test("OptionsApp keeps copy link available and shows a toast when no source link exists", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-missing-link",
      tweetUrl: "",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Missing link bookmark",
      createdAtOnX: "2026-05-04T15:32:00.000Z",
      savedAt: "2026-05-05T14:19:00.000Z",
      rawPayload: {}
    }
  ])
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const copyButton = findButton(container, "复制链接") as HTMLButtonElement | undefined
  assert.ok(copyButton)

  await act(async () => {
    copyButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const toast = findByTestId(container, "detail-toast")
  assert.ok(toast)
  assert.match(toast?.textContent ?? "", /暂无可复制链接/)
})

test("OptionsApp supports keyboard selection from bookmark cards", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-keyboard-card",
      tweetUrl: "https://x.com/alice/status/tweet-keyboard-card",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Keyboard interaction bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  assert.equal(card.getAttribute("role"), "button")
  assert.equal(card.getAttribute("tabindex"), "0")
  assert.equal(card.getAttribute("aria-pressed"), "false")

  await act(async () => {
    card.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "workspace-detail-modal"))
  assert.match(card.className, /options-result-card-selected/)
  assert.equal(card.getAttribute("aria-pressed"), "true")
})

test("OptionsApp renders a dedicated media section in the inspector when a bookmark has media", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-inspector",
      tweetUrl: "https://x.com/alice/status/tweet-media-inspector",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Media bookmark",
      media: [{ type: "photo", url: "https://example.com/media.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "inspector-media-section"))
  assert.match(container.textContent ?? "", /Media/)

  const mediaButton = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  const mediaPreviewImage = container.querySelector('[data-testid="inspector-media-trigger"] img') as HTMLImageElement | null
  assert.ok(mediaButton)
  assert.ok(mediaPreviewImage)
  assert.match(mediaPreviewImage.className, /h-72/)
  assert.equal(container.querySelector(".options-inspector-media-badge"), null)

  await act(async () => {
    mediaButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const mediaLightbox = findByTestId(container, "media-lightbox")
  const mediaBackdrop = findByTestId(container, "media-lightbox-backdrop")
  const mediaClose = findByTestId(container, "media-lightbox-close")

  assert.ok(mediaLightbox)
  assert.ok(mediaBackdrop)
  assert.ok(mediaClose)

  await act(async () => {
    ;(mediaClose as HTMLButtonElement).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "media-lightbox"), null)
})

test("OptionsApp previews video media as a poster in the modal and plays it in the modal", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-video",
      tweetUrl: "https://x.com/alice/status/tweet-media-video",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Video bookmark",
      media: [{ type: "video", url: "https://example.com/video.mp4", posterUrl: "https://example.com/video-poster.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const cardPoster = container.querySelector('[data-card-media-index="0"] img') as HTMLImageElement | null
  const cardVideo = container.querySelector('[data-card-media-index="0"] video') as HTMLVideoElement | null
  const posterButton = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  const posterImage = container.querySelector('[data-testid="inspector-media-trigger"] img') as HTMLImageElement | null

  assert.ok(cardPoster)
  assert.equal(cardPoster?.getAttribute("src"), "https://example.com/video-poster.jpg")
  assert.equal(cardVideo, null)
  assert.ok(posterButton)
  assert.ok(posterImage)
  assert.equal(posterImage?.getAttribute("src"), "https://example.com/video-poster.jpg")
  assert.equal(findByTestId(container, "inspector-media-video"), null)

  await act(async () => {
    posterButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const lightboxVideo = findByTestId(container, "media-lightbox-video") as HTMLVideoElement | null

  assert.ok(lightboxVideo)
  assert.equal(lightboxVideo?.getAttribute("src"), "https://example.com/video.mp4")
  assert.notEqual(lightboxVideo?.getAttribute("controls"), null)
})

test("OptionsApp previews animated gifs as video media in the modal", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-gif",
      tweetUrl: "https://x.com/alice/status/tweet-media-gif",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Animated gif bookmark",
      media: [{ type: "animated_gif", url: "https://example.com/animated.mp4", posterUrl: "https://example.com/animated-poster.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const posterButton = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  assert.ok(posterButton)

  await act(async () => {
    posterButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const lightboxVideo = findByTestId(container, "media-lightbox-video") as HTMLVideoElement | null

  assert.ok(lightboxVideo)
  assert.equal(lightboxVideo?.getAttribute("src"), "https://example.com/animated.mp4")
  assert.equal(findByTestId(container, "media-lightbox-image"), null)
})

test("OptionsApp falls back to rawPayload poster data for legacy video bookmarks", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-video-legacy",
      tweetUrl: "https://x.com/alice/status/tweet-media-video-legacy",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Legacy video bookmark",
      media: [{ type: "video", url: "https://example.com/video.mp4" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {
        legacy: {
          extended_entities: {
            media: [
              {
                type: "video",
                media_url_https: "https://example.com/video-poster-from-raw.jpg"
              }
            ]
          }
        }
      }
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const cardPoster = container.querySelector('[data-card-media-index="0"] img') as HTMLImageElement | null
  const modalPoster = container.querySelector('[data-testid="inspector-media-trigger"] img') as HTMLImageElement | null

  assert.ok(cardPoster)
  assert.ok(modalPoster)
  assert.equal(cardPoster?.getAttribute("src"), "https://example.com/video-poster-from-raw.jpg")
  assert.equal(modalPoster?.getAttribute("src"), "https://example.com/video-poster-from-raw.jpg")
})

test("OptionsApp reuses legacy rawPayload poster data inside the media modal", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-video-legacy-modal",
      tweetUrl: "https://x.com/alice/status/tweet-media-video-legacy-modal",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Legacy video bookmark for modal",
      media: [{ type: "video", url: "https://example.com/video.mp4" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {
        legacy: {
          extended_entities: {
            media: [
              {
                type: "video",
                media_url_https: "https://example.com/video-poster-from-raw-modal.jpg"
              }
            ]
          }
        }
      }
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const posterButton = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  assert.ok(posterButton)

  await act(async () => {
    posterButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const lightboxVideo = findByTestId(container, "media-lightbox-video") as HTMLVideoElement | null

  assert.ok(lightboxVideo)
  assert.equal(lightboxVideo?.getAttribute("poster"), "https://example.com/video-poster-from-raw-modal.jpg")
})

test("OptionsApp closes the detail card on Escape", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-modal-escape",
      tweetUrl: "https://x.com/alice/status/tweet-modal-escape",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Escape closes the modal",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "workspace-detail-modal"))

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  assert.doesNotMatch(card.className, /options-result-card-selected/)
})

test("OptionsApp treats the media modal as a focusable dialog and restores focus on close", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-dialog",
      tweetUrl: "https://x.com/alice/status/tweet-media-dialog",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Media dialog accessibility",
      media: [{ type: "photo", url: "https://example.com/media-dialog.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const trigger = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  assert.ok(trigger)
  trigger.focus()
  assert.equal(dom.window.document.activeElement, trigger)

  await act(async () => {
    trigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const lightbox = findByTestId(container, "media-lightbox") as HTMLDivElement | null
  const closeButton = findByTestId(container, "media-lightbox-close") as HTMLButtonElement | null

  assert.ok(lightbox)
  assert.ok(closeButton)
  assert.equal(lightbox?.getAttribute("role"), "dialog")
  assert.equal(lightbox?.getAttribute("aria-modal"), "true")
  assert.equal(dom.window.document.activeElement, closeButton)

  await act(async () => {
    closeButton.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
  })
  await settle()

  assert.equal(dom.window.document.activeElement, closeButton)

  await act(async () => {
    closeButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "media-lightbox"), null)
  assert.equal(dom.window.document.activeElement, trigger)
})

test("OptionsApp media preview supports multiple assets with previous and next controls", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-media-multi",
      tweetUrl: "https://x.com/alice/status/tweet-media-multi",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Multi media bookmark",
      media: [
        { type: "photo", url: "https://example.com/media-1.jpg" },
        { type: "photo", url: "https://example.com/media-2.jpg" }
      ],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const mediaButton = findByTestId(container, "inspector-media-trigger") as HTMLButtonElement | null
  assert.ok(mediaButton)

  await act(async () => {
    mediaButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const lightboxImage = findByTestId(container, "media-lightbox-image") as HTMLImageElement | null
  const nextButton = findByTestId(container, "media-lightbox-next") as HTMLButtonElement | null
  const prevButton = findByTestId(container, "media-lightbox-prev") as HTMLButtonElement | null

  assert.ok(lightboxImage)
  assert.ok(nextButton)
  assert.ok(prevButton)
  assert.match(lightboxImage?.getAttribute("src") ?? "", /media-1\.jpg/)

  await act(async () => {
    nextButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match((findByTestId(container, "media-lightbox-image") as HTMLImageElement | null)?.getAttribute("src") ?? "", /media-2\.jpg/)

  await act(async () => {
    prevButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match((findByTestId(container, "media-lightbox-image") as HTMLImageElement | null)?.getAttribute("src") ?? "", /media-1\.jpg/)
})

test("OptionsApp renders flat navigation rows and restrained result cards", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents workflow notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])
  const aiTag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-1", tagId: aiTag.id })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const allBookmarksButton = findListButton(container, "all")
  const aiTagButton = findListButton(container, aiTag.id)
  const searchInput = container.querySelector("#filters-search") as HTMLInputElement | null
  let cards = getBookmarkCards(container)

  assert.ok(allBookmarksButton)
  assert.ok(aiTagButton)
  assert.ok(searchInput)
  assert.match(allBookmarksButton?.className ?? "", /options-nav-row-active/)
  assert.equal(cards.length, 1)
  assert.match(allBookmarksButton?.className ?? "", /options-nav-row/)
  assert.match(searchInput.className, /options-toolbar-field/)
  assert.match(cards[0].className, /options-result-card/)
  assert.doesNotMatch(cards[0].className, /options-result-card-selected/)
  assert.equal(cards[0].querySelector('input[type="checkbox"]'), null)

  await act(async () => {
    cards[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  cards = getBookmarkCards(container)
  assert.match(cards[0].className, /options-result-card-selected/)

  await act(async () => {
    aiTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  cards = getBookmarkCards(container)
  const cardTag = cards[0].querySelector(".options-card-tag")

  assert.equal(cards.length, 1)
  assert.match(aiTagButton?.className ?? "", /options-nav-row-active/)
  assert.equal(cards[0].querySelector(".workspace-badge-plain"), null)
  assert.ok(cardTag)
  assert.equal(cardTag?.textContent, "AI")
  assert.equal(cards[0].querySelector(".workspace-media-frame"), null)
})

test("OptionsApp exposes sidebar tag create and delete actions like the demo", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  let createTagButton = findByTestId(container, "sidebar-create-tag") as HTMLButtonElement | null
  if (!createTagButton) {
    await settle()
    createTagButton = findByTestId(container, "sidebar-create-tag") as HTMLButtonElement | null
  }
  assert.ok(createTagButton)

  await act(async () => {
    createTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const draftInput = findByTestId(container, "sidebar-create-tag-input") as HTMLInputElement | null
  assert.ok(draftInput)
  assert.equal(dom.window.document.activeElement, draftInput)

  await act(async () => {
    setInputValue(draftInput, "灵感", dom.window)
  })
  await settle()

  await act(async () => {
    draftInput.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  await settle()

  assert.match(findByTestId(container, "lists-sidebar")?.textContent ?? "", /灵感/)
  assert.equal(findByTestId(container, "sidebar-create-tag-input"), null)

  const deleteTagButton = findByTestId(container, "sidebar-delete-tag") as HTMLButtonElement | null
  assert.ok(deleteTagButton)

  const originalConfirm = dom.window.confirm
  dom.window.confirm = () => true

  await act(async () => {
    deleteTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  dom.window.confirm = originalConfirm

  assert.doesNotMatch(findByTestId(container, "lists-sidebar")?.textContent ?? "", /灵感/)
})

test("OptionsApp saves inline tag drafts on blur and cancels them on escape", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  let createTagButton = findByTestId(container, "sidebar-create-tag") as HTMLButtonElement | null
  assert.ok(createTagButton)
  if (!createTagButton) {
    throw new Error("Expected sidebar create tag button")
  }
  const initialCreateTagButton = createTagButton

  await act(async () => {
    initialCreateTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const blurInput = findByTestId(container, "sidebar-create-tag-input") as HTMLInputElement | null
  assert.ok(blurInput)

  await act(async () => {
    setInputValue(blurInput, "研究", dom.window)
  })
  await settle()

  await act(async () => {
    blurInput.focus()
    blurInput.blur()
  })
  await settle()

  assert.match(findByTestId(container, "lists-sidebar")?.textContent ?? "", /研究/)
  assert.equal(findByTestId(container, "sidebar-create-tag-input"), null)

  createTagButton = findByTestId(container, "sidebar-create-tag") as HTMLButtonElement | null
  assert.ok(createTagButton)
  if (!createTagButton) {
    throw new Error("Expected sidebar create tag button after draft commit")
  }

  await act(async () => {
    createTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const escapeInput = findByTestId(container, "sidebar-create-tag-input") as HTMLInputElement | null
  assert.ok(escapeInput)

  await act(async () => {
    setInputValue(escapeInput, "取消项", dom.window)
  })
  await settle()

  await act(async () => {
    escapeInput.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  await settle()

  assert.doesNotMatch(findByTestId(container, "lists-sidebar")?.textContent ?? "", /取消项/)
  assert.equal(findByTestId(container, "sidebar-create-tag-input"), null)
})

test("OptionsApp does not expose list rename controls in tag navigation", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents workflow notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  await createTag({ name: "Research" })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.equal(findByTestId(container, "inline-list-name-input"), null)
  assert.equal(findByTestId(container, "add-list-button"), null)
  assert.match(findByTestId(container, "lists-sidebar")?.textContent ?? "", /Research/)
})

test("OptionsApp renders an explorer sidebar and demo toolbar controls", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents workflow notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  await createList({ name: "Research" })
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const toolbar = findByTestId(container, "workspace-toolbar")
  const treeList = findByTestId(container, "sidebar-list-tree")
  const shell = findByTestId(container, "workspace-shell")
  const syncPanel = findByTestId(container, "workspace-sidebar-sync")
  const sidebarStatus = findByTestId(container, "sidebar-status-section")
  const searchInput = container.querySelector("#filters-search") as HTMLInputElement | null

  assert.ok(shell)
  assert.ok(toolbar)
  assert.ok(treeList)
  assert.ok(syncPanel)
  assert.ok(sidebarStatus)
  assert.ok(searchInput)
  assert.match(toolbar?.className ?? "", /options-toolbar-shell/)
  assert.ok(toolbar?.querySelector(".options-toolbar-primary"))
  assert.ok(toolbar?.querySelector(".options-toolbar-search"))
  assert.ok(toolbar?.querySelector(".options-toolbar-controls"))
  assert.ok(toolbar?.querySelector(".options-toolbar-summary-row"))
  assert.match(sidebarStatus.textContent ?? "", /Workspace/)
  assert.match(container.textContent ?? "", /Tags/)
  assert.match(syncPanel.textContent ?? "", /Last sync/)
  assert.doesNotMatch(container.textContent ?? "", /Inbox/)
  assert.equal(toolbar.querySelector('label[for="filters-search"]'), null)
  assert.equal(toolbar.querySelector('label[for="filters-sort"]'), null)
  assert.equal(toolbar.querySelector('label[for="filters-time"]'), null)
  assert.equal(searchInput.getAttribute("placeholder"), "Search bookmarks, authors and notes...")
  assert.ok(findByTestId(container, "filter-trigger"))
  assert.ok(findByTestId(container, "sort-trigger"))
  assert.ok(findByTestId(container, "view-toggle-grid"))
  assert.ok(findByTestId(container, "view-toggle-list"))
  assert.doesNotMatch(container.textContent ?? "", /Search, refine, and organize saved posts inside the active scope\./)
  assert.match(container.textContent ?? "", /Active filters/)
  assert.doesNotMatch(container.textContent ?? "", /No active filters\./)
  assert.doesNotMatch(container.textContent ?? "", /Flat groups only\. Nested folders are intentionally removed\./)
})

test("OptionsApp keeps sidebar lists and library results in separate scroll regions", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents workflow notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const sidebar = findByTestId(container, "lists-sidebar")
  const sidebarStatus = findByTestId(container, "sidebar-status-section")
  const sidebarLists = findByTestId(container, "sidebar-lists-section")
  const sidebarFooter = findByTestId(container, "sidebar-footer-section")
  const sidebarScroll = findByTestId(container, "sidebar-lists-scroll")
  const library = findByTestId(container, "library-workspace")
  const libraryHeader = findByTestId(container, "library-header-section")
  const librarySummary = findByTestId(container, "library-results-summary")
  const toolbar = findByTestId(container, "workspace-toolbar")
  const resultsScroll = findByTestId(container, "library-results-scroll")
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)
  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const inspector = findByTestId(container, "workspace-detail-modal")
  const inspectorTimeline = findByTestId(container, "inspector-timeline-section")
  const inspectorSummary = findByTestId(container, "inspector-summary-section")
  const inspectorTags = findByTestId(container, "inspector-tags-section")

  assert.ok(sidebar)
  assert.ok(sidebarStatus)
  assert.ok(sidebarLists)
  assert.ok(sidebarFooter)
  assert.ok(sidebarScroll)
  assert.ok(library)
  assert.ok(inspector)
  assert.ok(libraryHeader)
  assert.ok(librarySummary)
  assert.ok(toolbar)
  assert.ok(resultsScroll)
  assert.ok(inspectorTimeline)
  assert.ok(inspectorSummary)
  assert.ok(inspectorTags)
  assert.equal(sidebar.contains(sidebarStatus), true)
  assert.equal(sidebar.contains(sidebarLists), true)
  assert.equal(sidebar.contains(sidebarFooter), true)
  assert.equal(sidebar.contains(sidebarScroll), true)
  assert.equal(sidebarScroll.contains(sidebarFooter), false)
  assert.match(sidebarScroll.className, /overflow-y-auto/)
  assert.equal(library.contains(libraryHeader), true)
  assert.equal(library.contains(librarySummary), true)
  assert.equal(library.contains(toolbar), true)
  assert.equal(library.contains(resultsScroll), true)
  assert.equal(resultsScroll.contains(toolbar), true)
})

test("OptionsApp renders a single tags summary and preferences inside the left sidebar", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents workflow notes",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-03-15T03:00:00.000Z"
    },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.ok(findByTestId(container, "workspace-overview"))
  const sidebar = findByTestId(container, "lists-sidebar")

  assert.ok(sidebar)
  assert.equal(findByTestId(container, "workspace-summary-strip"), null)
  assert.match(sidebar.textContent ?? "", /偏好设置/)
  assert.ok(findByTestId(container, "footer-locale-toggle"))
  assert.ok(findByTestId(container, "footer-theme-toggle"))
  assert.equal(findByTestId(container, "footer-settings-button"), null)
  assert.equal(findByTestId(container, "footer-info-button"), null)
  assert.equal(findByTestId(container, "toggle-preferences-panel"), null)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)
})

test("OptionsApp truncates the sidebar title instead of overflowing", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 4,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    syncStrategyVersion: 1,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: 3
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const title = container.querySelector(".options-sidebar-title") as HTMLElement | null
  assert.ok(title)
  assert.match(title.className, /truncate/)
})

test("OptionsApp keeps only the left split handle in modal mode", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 4,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    syncStrategyVersion: 1,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: 3
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.ok(findByTestId(container, "split-handle-left"))
  assert.equal(findByTestId(container, "split-handle-right"), null)
})

test("OptionsApp persists updated pane widths after dragging a split handle", async () => {
  const runtime = installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 4,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: [],
    syncStrategyVersion: 1,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: 3,
    leftSidebarWidth: 280,
    rightSidebarWidth: 360
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const leftHandle = findByTestId(container, "split-handle-left") as HTMLDivElement | null
  assert.ok(leftHandle)

  await act(async () => {
    leftHandle.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, clientX: 280 }))
    dom.window.dispatchEvent(new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 320 }))
    dom.window.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true, clientX: 320 }))
  })
  await settle()

  const storedSettings = runtime.getStoredSettings() as { leftSidebarWidth?: number } | undefined
  assert.equal(storedSettings?.leftSidebarWidth, 320)
})

test("OptionsApp does not expose expandable inline preferences in demo shell", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "dark",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.ok(findByTestId(container, "footer-theme-toggle"))
  assert.equal(findByTestId(container, "toggle-preferences-panel"), null)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)
})

test("OptionsApp shows load errors in the workspace area", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const storageLocal = chrome.storage.local as { get: (...args: unknown[]) => Promise<unknown> }
  const originalGet = storageLocal.get
  storageLocal.get = async () => {
    throw new Error("Load failed on purpose")
  }

  try {
    const { container } = render(React.createElement(OptionsApp))
    await settle()

    assert.match(container.textContent ?? "", /Load failed on purpose/)
  } finally {
    storageLocal.get = originalGet
  }
})

test("OptionsApp renders a feed skeleton during the first workspace load", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container } = render(React.createElement(OptionsApp))

  assert.ok(findByTestId(container, "feed-loading-state"))
  assert.equal(findByTestId(container, "results-stack"), null)

   await settle()
})

test("OptionsApp keeps the real three-pane shell visible while the first workspace load is still pending", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container } = render(React.createElement(OptionsApp))

  assert.ok(findByTestId(container, "lists-sidebar"))
  assert.ok(findByTestId(container, "workspace-sidebar-sync"))
  assert.ok(findByTestId(container, "workspace-toolbar"))
  assert.equal(findByTestId(container, "workspace-detail-modal"), null)

   await settle()
})

test("OptionsApp shows a dedicated empty feed state when no bookmarks exist yet", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const emptyState = findByTestId(container, "feed-empty-state")
  assert.ok(emptyState)
  assert.match(emptyState.textContent ?? "", /还没有保存任何书签/)
  assert.equal(findByTestId(container, "results-stack"), null)
})

test("OptionsApp retries feed loading from the error state and recovers the results", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-retry-success",
      tweetUrl: "https://x.com/alice/status/tweet-retry-success",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Retry success bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const storageLocal = chrome.storage.local as { get: (...args: unknown[]) => Promise<unknown> }
  const originalGet = storageLocal.get
  let remainingFailures = 3
  storageLocal.get = async (...args) => {
    if (remainingFailures > 0) {
      remainingFailures -= 1
      throw new Error("Load failed on purpose")
    }

    return originalGet(...args)
  }

  try {
    const { container, dom } = render(React.createElement(OptionsApp))
    await settle()

    const retryButton = findByTestId(container, "feed-error-retry") as HTMLButtonElement | null
    assert.ok(findByTestId(container, "feed-error-state"))
    assert.ok(retryButton)
    assert.match(container.textContent ?? "", /Load failed on purpose/)
    assert.equal(findByTestId(container, "results-stack"), null)

    await act(async () => {
      retryButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    })
    await settle()

    assert.equal(findByTestId(container, "feed-error-state"), null)
    assert.ok(findByTestId(container, "results-stack"))
    assert.match(container.textContent ?? "", /Retry success bookmark/)
  } finally {
    storageLocal.get = originalGet
  }
})

test("OptionsApp shows command errors near the sync controls", async () => {
  installChromeRuntimeHarness({
    runSync: async () => {
      throw new Error("Sync failed on purpose")
    }
  })
  await resetBookmarksDb()

  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  let syncButton = findButton(container, "Sync now")
  if (!syncButton) {
    await settle()
    syncButton = findButton(container, "Sync now")
  }
  assert.ok(syncButton)

  await act(async () => {
    syncButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /Sync failed on purpose/)
})

test("OptionsApp loads workspace data without depending on the runtime workspace message", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-local-load",
      tweetUrl: "https://x.com/alice/status/tweet-local-load",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Loaded directly from IndexedDB",
      createdAtOnX: "2026-04-14T08:00:00.000Z",
      savedAt: "2026-04-14T08:05:00.000Z",
      rawPayload: {}
    }
  ])

  const originalSendMessage = chrome.runtime.sendMessage as (message: { type: string }) => Promise<unknown>
  ;(chrome.runtime.sendMessage as unknown as (message: { type: string }) => Promise<unknown>) = async (message) => {
    if (message.type === LOAD_WORKSPACE_DATA_MESSAGE) {
      return { error: "workspace runtime path should not be used" }
    }

    return originalSendMessage(message)
  }

  const { container } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  assert.match(container.textContent ?? "", /Loaded directly from IndexedDB/)
  assert.doesNotMatch(container.textContent ?? "", /workspace runtime path should not be used/)
})

test("OptionsApp refreshes workspace data when the window regains focus after site bookmark changes", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  assert.equal(getBookmarkCards(container).length, 0)

  await upsertBookmarkSnapshot({
    tweetId: "tweet-focus-refresh",
    tweetUrl: "https://x.com/alice/status/tweet-focus-refresh",
    authorName: "Alice",
    authorHandle: "alice",
    text: "Fresh bookmark from x.com",
    createdAtOnX: "2026-04-14T08:00:00.000Z"
  })

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.FocusEvent("focus"))
  })
  await settle()
  await settle()

  assert.equal(getBookmarkCards(container).length, 1)
  assert.match(container.textContent ?? "", /Fresh bookmark from x.com/)
})

test("OptionsApp shows a newly site-bookmarked tweet first under the default recently saved sort", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  await upsertBookmarks([
    {
      tweetId: "tweet-ranked-1",
      tweetUrl: "https://x.com/alice/status/tweet-ranked-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Older synced bookmark",
      createdAtOnX: "2026-04-10T08:00:00.000Z",
      savedAt: "2026-04-10T08:05:00.000Z",
      bookmarkTimelineRank: 0,
      rawPayload: {}
    },
    {
      tweetId: "tweet-ranked-2",
      tweetUrl: "https://x.com/bob/status/tweet-ranked-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Another synced bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:05:00.000Z",
      bookmarkTimelineRank: 1,
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  await upsertBookmarkSnapshot({
    tweetId: "tweet-new-site-bookmark",
    tweetUrl: "https://x.com/carol/status/tweet-new-site-bookmark",
    authorName: "Carol",
    authorHandle: "carol",
    text: "Newest site bookmark",
    createdAtOnX: "2026-04-14T08:00:00.000Z"
  })

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.FocusEvent("focus"))
  })
  await settle()
  await settle()

  assert.match(getBookmarkCards(container)[0]?.textContent ?? "", /Newest site bookmark/)
})

test("OptionsApp removes a bookmark from the results after a site-side unbookmark and focus refresh", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  })

  await upsertBookmarks([
    {
      tweetId: "tweet-remove-after-focus",
      tweetUrl: "https://x.com/alice/status/tweet-remove-after-focus",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Will be removed from options",
      createdAtOnX: "2026-04-10T08:00:00.000Z",
      savedAt: "2026-04-10T08:05:00.000Z",
      bookmarkTimelineRank: 0,
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()
  await settle()

  assert.equal(getBookmarkCards(container).length, 1)
  assert.match(container.textContent ?? "", /Will be removed from options/)

  await removeBookmarkSnapshot("tweet-remove-after-focus")

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.FocusEvent("focus"))
  })
  await settle()
  await settle()

  assert.equal(getBookmarkCards(container).length, 0)
  assert.doesNotMatch(container.textContent ?? "", /Will be removed from options/)
})
