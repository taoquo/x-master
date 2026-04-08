import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createList, moveBookmarkToList } from "../../src/lib/storage/listsStore.ts"
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

function findInputByLabel(container: HTMLDivElement, labelText: string) {
  const label = Array.from(container.querySelectorAll("label")).find((node) => node.textContent?.includes(labelText))
  assert.ok(label)
  const inputId = label.getAttribute("for")
  assert.ok(inputId)
  return container.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement
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
}

test("OptionsApp renders in Chinese by default and updates locale/theme preferences", async () => {
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

  const researchList = await createList({ name: "Research" })
  await moveBookmarkToList({ bookmarkId: "tweet-2", listId: researchList.id })
  const tag = await createTag({ name: "AI" })
  await attachTagToBookmark({ bookmarkId: "tweet-2", tagId: tag.id })
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
      lastSyncedAt: "2026-03-15T03:00:00.000Z"
    },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.match(container.textContent ?? "", /书签/)
  assert.match(container.textContent ?? "", /列表/)
  assert.match(container.textContent ?? "", /详情/)
  assert.match(container.textContent ?? "", /偏好设置/)

  const togglePreferencesButton = findByTestId(container, "toggle-preferences-panel") as HTMLButtonElement | null
  assert.ok(togglePreferencesButton)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)

  await act(async () => {
    togglePreferencesButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const localeSelect = findInputByLabel(container, "语言") as HTMLSelectElement
  await act(async () => {
    setSelectValue(localeSelect, "en", dom.window)
  })
  await settle()

  assert.match(container.textContent ?? "", /Bookmarks/)
  assert.match(container.textContent ?? "", /Lists/)
  assert.match(container.textContent ?? "", /Details/)
  assert.match(container.textContent ?? "", /Preferences/)

  const themeSelect = findInputByLabel(container, "Theme") as HTMLSelectElement
  await act(async () => {
    setSelectValue(themeSelect, "dark", dom.window)
  })
  await settle()

  const settings = await getSettings()
  assert.equal(settings.locale, "en")
  assert.equal(settings.themePreference, "dark")
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")

  const researchButton = findListButton(container, researchList.id)
  assert.ok(researchButton)

  await act(async () => {
    researchButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const cards = getBookmarkCards(container)
  assert.equal(cards.length, 1)
  assert.match(cards[0].textContent ?? "", /Prompt engineering notes/)
  assert.match(cards[0].textContent ?? "", /AI/)
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

  const statusBadge = container.querySelector('[data-testid="lists-sidebar"] .status-success') as HTMLElement | null
  const preferencesToggle = findByTestId(container, "toggle-preferences-panel") as HTMLButtonElement | null
  const inspectorEmptyState = container.querySelector('[data-testid="workspace-inspector"] .panel-elevated') as HTMLElement | null

  assert.ok(statusBadge)
  assert.ok(preferencesToggle)
  assert.ok(inspectorEmptyState)
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.match(statusBadge.className, /workspace-badge/)
  assert.match(preferencesToggle.textContent ?? "", /偏好设置/)
})

test("OptionsApp supports bulk list moves and tag creation on the inspector", async () => {
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

  const researchList = await createList({ name: "Research" })
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

  const selectVisibleButton = findButton(container, "Select visible")
  assert.ok(selectVisibleButton)
  await act(async () => {
    selectVisibleButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  const moveSelect = findInputByLabel(container, "Move selected to") as HTMLSelectElement
  await act(async () => {
    setSelectValue(moveSelect, researchList.id, dom.window)
  })

  const moveButton = findButton(container, "Move selected")
  assert.ok(moveButton)
  await act(async () => {
    moveButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const researchButton = findListButton(container, researchList.id)
  assert.ok(researchButton)
  await act(async () => {
    researchButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.equal(getBookmarkCards(container).length, 2)

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

test("OptionsApp creates a list inline and commits the edited name on Enter", async () => {
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

  const addListButton = findByTestId(container, "add-list-button") as HTMLButtonElement | null
  assert.ok(addListButton)

  await act(async () => {
    addListButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  const inlineEditor = findByTestId(container, "inline-list-name-input") as HTMLInputElement | null
  assert.ok(inlineEditor)
  assert.equal(inlineEditor.value, "New list")
  assert.match(container.textContent ?? "", /Showing 1 of 1/)
  assert.doesNotMatch(container.textContent ?? "", /Scoped to New list/)

  await act(async () => {
    setInputValue(inlineEditor, "Reading", dom.window)
  })
  await settle()

  await act(async () => {
    inlineEditor.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "inline-list-name-input"), null)
  assert.match(container.textContent ?? "", /Reading/)
  assert.match(container.textContent ?? "", /Showing 0 of 1/)
  assert.match(container.textContent ?? "", /Scoped to Reading/)
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

  const { container, dom } = render(React.createElement(OptionsApp))
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
  assert.match(overview?.className ?? "", /xl:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/)
  assert.match(sidebar?.className ?? "", /workspace-rail/)
  assert.match(library?.className ?? "", /workspace-main-surface/)
  assert.match(syncButton?.className ?? "", /primary-button/)
  assert.match(syncButton?.className ?? "", /workspace-sync-primary/)
  assert.match(searchInput.className, /workspace-input/)
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
  const aiList = await createList({ name: "AI" })
  await moveBookmarkToList({ bookmarkId: "tweet-1", listId: aiList.id })
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
  const aiListButton = findListButton(container, aiList.id)
  const searchInput = container.querySelector("#filters-search") as HTMLInputElement | null
  let cards = getBookmarkCards(container)

  assert.ok(allBookmarksButton)
  assert.ok(aiListButton)
  assert.ok(searchInput)
  assert.match(allBookmarksButton?.className ?? "", /workspace-nav-row-active/)
  assert.equal(cards.length, 1)
  assert.match(allBookmarksButton?.className ?? "", /workspace-nav-row/)
  assert.match(searchInput.className, /workspace-input/)
  assert.match(cards[0].className, /workspace-result-card/)
  assert.match(cards[0].className, /workspace-result-card-selected/)

  await act(async () => {
    aiListButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  cards = getBookmarkCards(container)
  const listBadge = cards[0].querySelector(".workspace-badge-plain")

  assert.equal(cards.length, 1)
  assert.match(aiListButton?.className ?? "", /workspace-nav-row-active/)
  assert.ok(listBadge)
  assert.equal(listBadge?.textContent, "AI")
})

test("OptionsApp supports double-click rename and keeps duplicate names blocked", async () => {
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

  const researchList = await createList({ name: "Research" })
  await createList({ name: "Archive" })
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

  const researchButton = findListButton(container, researchList.id)
  assert.ok(researchButton)

  await act(async () => {
    researchButton.dispatchEvent(new dom.window.MouseEvent("dblclick", { bubbles: true }))
  })
  await settle()

  const inlineEditor = findByTestId(container, "inline-list-name-input") as HTMLInputElement | null
  assert.ok(inlineEditor)
  assert.equal(inlineEditor.value, "Research")

  await act(async () => {
    setInputValue(inlineEditor, "Archive", dom.window)
  })
  await settle()

  await act(async () => {
    inlineEditor.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "inline-list-name-input"))
  assert.match(container.textContent ?? "", /already exists/i)
  assert.match(container.textContent ?? "", /Research/)
  assert.match(container.textContent ?? "", /Archive/)
})

test("OptionsApp renders an explorer sidebar and placeholder-style toolbar controls", async () => {
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
  const treeRoot = findByTestId(container, "sidebar-tree-root")
  const treeList = findByTestId(container, "sidebar-list-tree")
  const shell = findByTestId(container, "workspace-shell")
  const syncPanel = findByTestId(container, "workspace-sidebar-sync")
  const addListButton = findByTestId(container, "add-list-button") as HTMLButtonElement | null
  const searchInput = container.querySelector("#filters-search") as HTMLInputElement | null

  assert.ok(shell)
  assert.ok(toolbar)
  assert.ok(treeRoot)
  assert.ok(treeList)
  assert.ok(syncPanel)
  assert.ok(addListButton)
  assert.ok(searchInput)
  assert.match(treeRoot.textContent ?? "", /Lists/)
  assert.match(syncPanel.textContent ?? "", /Last sync/)
  assert.match(addListButton.textContent ?? "", /\+/)
  assert.doesNotMatch(container.textContent ?? "", /Inbox/)
  assert.equal(toolbar.querySelector('label[for="filters-search"]'), null)
  assert.equal(toolbar.querySelector('label[for="filters-sort"]'), null)
  assert.equal(toolbar.querySelector('label[for="filters-time"]'), null)
  assert.equal(searchInput.getAttribute("placeholder"), "Search bookmarks, authors, and notes")
  assert.match(findByTestId(container, "toolbar-sort-shell")?.textContent ?? "", /Sort by/)
  assert.match(findByTestId(container, "toolbar-time-shell")?.textContent ?? "", /Saved time/)
  assert.doesNotMatch(container.textContent ?? "", /Search, refine, and organize saved posts inside the active scope\./)
  assert.doesNotMatch(container.textContent ?? "", /Refined bookmark context and filing controls\./)
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

  const { container } = render(React.createElement(OptionsApp))
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
  const inspectorMeta = findByTestId(container, "inspector-meta-section")
  const inspectorTags = findByTestId(container, "inspector-tags-section")
  const inspectorAssignment = findByTestId(container, "inspector-assignment-section")
  const inspectorCreateTag = findByTestId(container, "inspector-create-tag-section")

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
  assert.ok(inspectorTags)
  assert.ok(inspectorAssignment)
  assert.ok(inspectorCreateTag)
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
  const summaryStrip = findByTestId(container, "workspace-summary-strip")
  const preferencesToggle = findByTestId(container, "toggle-preferences-panel")

  assert.ok(sidebar)
  assert.ok(summaryStrip)
  assert.ok(preferencesToggle)
  assert.match(summaryStrip.textContent ?? "", /总标签数/)
  assert.doesNotMatch(summaryStrip.textContent ?? "", /未分类/)
  assert.equal(sidebar.contains(summaryStrip), true)
  assert.equal(sidebar.contains(preferencesToggle), true)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)
})

test("OptionsApp expands the preferences panel on demand", async () => {
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

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.match(container.textContent ?? "", /深色/)

  const preferencesToggle = findByTestId(container, "toggle-preferences-panel") as HTMLButtonElement | null
  assert.ok(preferencesToggle)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)

  await act(async () => {
    preferencesToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.ok(findByTestId(container, "workspace-preferences-inline"))
})

test("OptionsApp shows load errors in the workspace area", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const originalSendMessage = chrome.runtime.sendMessage as (message: { type: string }) => Promise<unknown>
  ;(chrome.runtime.sendMessage as unknown as (message: { type: string }) => Promise<unknown>) = async (message) => {
    if (message.type === LOAD_WORKSPACE_DATA_MESSAGE) {
      return { error: "Load failed on purpose" }
    }

    return originalSendMessage(message)
  }

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.match(container.textContent ?? "", /Load failed on purpose/)
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

  const syncButton = findButton(container, "Sync now")
  assert.ok(syncButton)

  await act(async () => {
    syncButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /Sync failed on purpose/)
})
