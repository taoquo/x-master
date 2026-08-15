import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { getSettings } from "../../src/lib/storage/settings.ts"
import { cleanupRenders, render, settle } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

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

async function click(dom: ReturnType<typeof render>["dom"], element: Element | null) {
  assert.ok(element, "element to click should exist")
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()
}

test.afterEach(async () => {
  await cleanupRenders()
})

test("settings panel opens from the sidebar gear and closes again", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  assert.equal(findByTestId(container, "settings-panel"), null)

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  assert.ok(findByTestId(container, "settings-panel"))
  assert.ok(findByTestId(container, "settings-section-general"))

  await click(dom, findByTestId(container, "settings-close"))
  assert.equal(findByTestId(container, "settings-panel"), null)
})

test("auto-tag toggles persist to settings storage", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))
  assert.ok(findByTestId(container, "settings-section-autotag"))

  const enabledToggle = findByTestId(container, "settings-autotag-enabled")?.querySelector("input")
  assert.ok(enabledToggle)
  assert.equal(enabledToggle.checked, false)

  await click(dom, enabledToggle)

  const stored = await getSettings()
  assert.equal(stored.autoTag.enabled, true)
  assert.equal(stored.autoTag.runAfterSync, true)
})

test("keyword rules can be added and removed with persistence", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  const keywordInput = findByTestId(container, "settings-keyword-rule-keyword") as HTMLInputElement
  const tagInput = findByTestId(container, "settings-keyword-rule-tag") as HTMLInputElement

  await act(async () => {
    setInputValue(keywordInput, "rust", dom.window)
    setInputValue(tagInput, "Rust", dom.window)
  })
  await settle()

  await click(dom, findByTestId(container, "settings-keyword-rule-add"))

  let stored = await getSettings()
  assert.deepEqual(stored.autoTag.heuristics.keywordRules, [{ keyword: "rust", tagName: "Rust" }])
  assert.ok(findByTestId(container, "settings-keyword-rule-row"))

  await click(dom, findByTestId(container, "settings-keyword-rule-remove"))

  stored = await getSettings()
  assert.deepEqual(stored.autoTag.heuristics.keywordRules, [])
  assert.equal(findByTestId(container, "settings-keyword-rule-row"), null)
})

test("sync buffer pages persist from the sync section", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-sync"))

  const bufferInput = findByTestId(container, "settings-sync-buffer-pages") as HTMLInputElement
  assert.ok(bufferInput)

  await act(async () => {
    setInputValue(bufferInput, "5", dom.window)
  })
  await settle()

  const stored = await getSettings()
  assert.equal(stored.incrementalStopBufferPages, 5)
})
