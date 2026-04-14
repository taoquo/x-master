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
import { render, settle } from "../helpers/render.tsx"
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

function setSelectValue(
  element: HTMLSelectElement,
  value: string,
  dom: {
    HTMLSelectElement: typeof HTMLSelectElement
    Event: typeof Event
  }
) {
  const descriptor = Object.getOwnPropertyDescriptor(dom.HTMLSelectElement.prototype, "value")
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new dom.Event("change", { bubbles: true }))
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
  assert.match(container.textContent ?? "", /详情/)
  assert.match(container.textContent ?? "", /偏好设置/)
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
  const inspectorEmptyState = container.querySelector('[data-testid="workspace-inspector"] .workspace-empty-state') as HTMLElement | null

  assert.ok(statusBadge)
  assert.ok(inspectorEmptyState)
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.match(statusBadge.className, /workspace-badge/)
  assert.doesNotMatch(inspectorEmptyState.className, /panel-elevated/)
  assert.doesNotMatch(inspectorEmptyState.className, /panel-surface/)
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

    assert.match(findByTestId(container, "sidebar-status-section")?.textContent ?? "", /download blocked/)
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
  const inspector = container.querySelector('[data-testid="workspace-inspector"] [data-testid="inspector-section-stack"]')

  assert.ok(overview)
  assert.ok(sidebar)
  assert.ok(library)
  assert.ok(inspector)
  assert.match(overview?.className ?? "", /xl:grid-cols-\[256px_minmax\(0,1fr\)_288px\]/)
  assert.match(sidebar?.textContent ?? "", /工作区/)
  assert.match(sidebar?.textContent ?? "", /偏好设置/)
  assert.match(library?.textContent ?? "", /资料库/)
  assert.match(container.textContent ?? "", /选择一个书签以查看详情/)

  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /元数据/)
  assert.match(container.textContent ?? "", /内容摘要/)
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
  assert.ok(findByTestId(container, "workspace-inspector"))
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

  const resultsStack = findByTestId(container, "results-stack")
  const listToggle = findByTestId(container, "view-toggle-list") as HTMLButtonElement | null
  const gridToggle = findByTestId(container, "view-toggle-grid") as HTMLButtonElement | null
  const filterTrigger = findByTestId(container, "filter-trigger") as HTMLButtonElement | null
  const sortTrigger = findByTestId(container, "sort-trigger")

  assert.ok(resultsStack)
  assert.ok(listToggle)
  assert.ok(gridToggle)
  assert.ok(filterTrigger)
  assert.ok(sortTrigger)
  assert.match(resultsStack?.className ?? "", /options-results-grid/)
  assert.match(sortTrigger?.textContent ?? "", /Recently saved/)
  assert.match(getBookmarkCards(container)[0]?.textContent ?? "", /Bob/)

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
  assert.match(findByTestId(container, "results-stack")?.className ?? "", /options-results-list/)

  await act(async () => {
    gridToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
  assert.match(findByTestId(container, "results-stack")?.className ?? "", /options-results-grid/)
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

  assert.match(container.textContent ?? "", /选择一个书签以查看详情/)

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /元数据/)
  assert.match(container.textContent ?? "", /详情/)
  assert.match(container.textContent ?? "", /Alice/)
  assert.match(container.textContent ?? "", /@alice/)
  assert.match(container.textContent ?? "", /内容摘要/)
  assert.match(container.textContent ?? "", /在 X 中打开/)
  assert.match(container.textContent ?? "", /添加标签/)
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

  const attachTagSelect = container.querySelector('[data-testid="attach-tag-select"]') as HTMLSelectElement
  assert.ok(attachTagSelect)
  await act(async () => {
    setSelectValue(attachTagSelect, importantTag.id, dom.window)
  })

  const addTagButton = findButton(container, "Add tag")
  assert.ok(addTagButton)
  await act(async () => {
    addTagButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const currentTags = container.querySelector('[data-testid="current-tags"]')
  assert.ok(currentTags)
  assert.doesNotMatch(currentTags.textContent ?? "", /No tags yet/)
  assert.match(currentTags.textContent ?? "", /Important/)

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
  assert.ok(findByTestId(container, "workspace-inspector"))
  assert.ok(findByTestId(container, "workspace-toolbar"))
  assert.ok(findByTestId(container, "sidebar-lists-scroll"))
  assert.ok(findByTestId(container, "sidebar-list-tree"))
  assert.ok(findByTestId(container, "library-results-scroll"))
  assert.ok(findByTestId(container, "results-stack"))
  assert.ok(findByTestId(container, "inspector-section-stack"))
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
  assert.match(overview?.className ?? "", /xl:grid-cols-\[256px_minmax\(0,1fr\)_288px\]/)
  assert.match(sidebar?.className ?? "", /options-sidebar-shell/)
  assert.match(library?.className ?? "", /options-main-shell/)
  assert.match(syncButton?.className ?? "", /workspace-sync-primary/)
  assert.match(searchInput.className, /options-toolbar-field/)
})

test("OptionsApp renders the detail inspector with metadata, summary, and tag actions", async () => {
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

  const inspector = container.querySelector(".options-inspector-shell") as HTMLElement | null
  const attachTagSelect = container.querySelector('[data-testid="attach-tag-select"]') as HTMLSelectElement | null
  const openOnXButton = findButton(container, "Open on X")

  assert.ok(inspector)
  assert.ok(attachTagSelect)
  assert.ok(openOnXButton)
  assert.match(inspector.className, /options-inspector-shell/)
  assert.match(attachTagSelect.className, /options-inspector-field/)
  assert.match(container.textContent ?? "", /Metadata/)
  assert.match(container.textContent ?? "", /Summary/)
  assert.match(container.textContent ?? "", /Add tag/)
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
  assert.ok(mediaButton)

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
  const inspector = findByTestId(container, "workspace-inspector")
  const libraryHeader = findByTestId(container, "library-header-section")
  const librarySummary = findByTestId(container, "library-results-summary")
  const toolbar = findByTestId(container, "workspace-toolbar")
  const resultsScroll = findByTestId(container, "library-results-scroll")
  const firstCard = getBookmarkCards(container)[0]
  await act(async () => {
    firstCard.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const inspectorMeta = findByTestId(container, "inspector-metadata-section")
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
  assert.ok(inspectorMeta)
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
  assert.equal(resultsScroll.contains(toolbar), false)
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

test("OptionsApp renders left and right split handles in three-pane mode", async () => {
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
  assert.ok(findByTestId(container, "split-handle-right"))
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

test("OptionsApp keeps the real three-pane shell visible while the first workspace load is still pending", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container } = render(React.createElement(OptionsApp))

  assert.ok(findByTestId(container, "lists-sidebar"))
  assert.ok(findByTestId(container, "workspace-sidebar-sync"))
  assert.ok(findByTestId(container, "workspace-toolbar"))
  assert.ok(findByTestId(container, "workspace-inspector"))
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
