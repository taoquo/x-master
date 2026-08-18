import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
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

test("the block list can be cleared from the auto-tag section", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const current = await getSettings()
  await saveSettings({
    ...current,
    autoTag: { ...current.autoTag, blockedTagKeys: ["ai", "design"] }
  })

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  const clearButton = findByTestId(container, "settings-autotag-clear-blocked")
  assert.ok(clearButton)
  assert.ok(clearButton.textContent?.includes("2"))

  await click(dom, clearButton)

  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, [])
  assert.equal(findByTestId(container, "settings-autotag-clear-blocked"), null)
})

test("a budget-exhausted run explains why nothing was suggested", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const current = await getSettings()
  await saveSettings({
    ...current,
    lastAutoTagRun: {
      finishedAt: "2026-08-18T00:00:00.000Z",
      outcome: "budget-exhausted",
      suggestedCount: 0,
      pendingCount: 0,
      candidateCount: 8895,
      llmProcessedCount: 20,
      llmBatchCount: 2,
      llmFailedBatchCount: 0,
      newTagBudget: 1,
      vocabularySize: 0,
      blockedTagKeyCount: 0,
      blockedDroppedCount: 0,
      budgetDroppedCount: 19
    }
  })

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  const dropped = findByTestId(container, "settings-autotag-budget-dropped")
  assert.ok(dropped)
  assert.ok(dropped.textContent?.includes("19"))
  // The outcome line must name the budget, not read as a generic success.
  const result = findByTestId(container, "settings-autotag-result")
  assert.ok(result)
  assert.equal(/完成/.test(result.textContent ?? ""), false)
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

test("api key save button stores the key and reflects the saved status", async () => {
  const harness = installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  assert.equal(findByTestId(container, "settings-llm-api-key-status")?.textContent, "Not set")

  const keyInput = findByTestId(container, "settings-llm-api-key") as HTMLInputElement
  await act(async () => {
    setInputValue(keyInput, "sk-live-123", dom.window)
  })
  await settle()

  await click(dom, findByTestId(container, "settings-llm-api-key-save"))

  assert.equal(harness.getStoredSecrets()?.llmApiKey, "sk-live-123")
  assert.equal(findByTestId(container, "settings-llm-api-key-status")?.textContent, "Saved")
  assert.equal((findByTestId(container, "settings-llm-api-key") as HTMLInputElement).value, "")
})

test("api key clear button removes the stored key", async () => {
  const harness = installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  assert.equal(findByTestId(container, "settings-llm-api-key-clear"), null)

  const keyInput = findByTestId(container, "settings-llm-api-key") as HTMLInputElement
  await act(async () => {
    setInputValue(keyInput, "sk-live-123", dom.window)
  })
  await settle()
  await click(dom, findByTestId(container, "settings-llm-api-key-save"))

  await click(dom, findByTestId(container, "settings-llm-api-key-clear"))

  assert.equal(harness.getStoredSecrets()?.llmApiKey, undefined)
  assert.equal(findByTestId(container, "settings-llm-api-key-status")?.textContent, "Not set")
  assert.equal(findByTestId(container, "settings-llm-api-key-clear"), null)
})

test("test connection flushes an unsaved api key draft before pinging the provider", async () => {
  const harness = installChromeRuntimeHarness({
    testLlmConnection: async () => ({ ok: true })
  })
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  const keyInput = findByTestId(container, "settings-llm-api-key") as HTMLInputElement
  await act(async () => {
    setInputValue(keyInput, "sk-draft-456", dom.window)
  })
  await settle()

  await click(dom, findByTestId(container, "settings-llm-test-connection"))

  assert.equal(harness.getStoredSecrets()?.llmApiKey, "sk-draft-456")
  assert.equal(findByTestId(container, "settings-llm-api-key-status")?.textContent, "Saved")
})

test("test connection reports a friendly hint when no api key exists", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))
  await click(dom, findByTestId(container, "settings-llm-test-connection"))

  const section = findByTestId(container, "settings-section-autotag")
  assert.match(section?.textContent ?? "", /Enter and save an API key first/)
})

test("data safety section exposes labelled export, restore, and reset actions", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-data-safety"))

  const section = findByTestId(container, "settings-section-data-safety")
  assert.ok(section)
  assert.ok(findByTestId(container, "settings-export-data"))

  const restoreButton = findByTestId(container, "settings-restore-backup") as HTMLButtonElement | null
  const resetButton = findByTestId(container, "settings-reset-local") as HTMLButtonElement | null
  assert.ok(restoreButton)
  assert.ok(resetButton)
  assert.match(resetButton.className, /chip-button-danger/)
  assert.equal(section.querySelectorAll(".options-settings-action-row").length, 3)

  // The restore picker is the shared hidden file input owned by the sidebar.
  let clickedRestoreInput = false
  const restoreInput = findByTestId(container, "data-safety-restore-input") as HTMLInputElement
  restoreInput.addEventListener("click", () => {
    clickedRestoreInput = true
  })

  await click(dom, restoreButton)
  assert.equal(clickedRestoreInput, true)

  const originalConfirm = dom.window.confirm
  dom.window.confirm = () => false
  try {
    await click(dom, resetButton)
  } finally {
    dom.window.confirm = originalConfirm
  }
})
