import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createList, moveBookmarkToList } from "../../src/lib/storage/listsStore.ts"
import { saveSettings } from "../../src/lib/storage/settings.ts"
import { attachTagToBookmark, createTag } from "../../src/lib/storage/tagsStore.ts"
import { render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

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

test("OptionsApp renders the single bookmark-manager workspace and filters by list", async () => {
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

  assert.match(container.textContent ?? "", /Bookmarks/)
  assert.match(container.textContent ?? "", /Lists/)
  assert.match(container.textContent ?? "", /Details/)

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
