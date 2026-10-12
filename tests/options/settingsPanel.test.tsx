import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { cleanupRenders, render, settle, waitForElement } from "../helpers/render.tsx"
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

test("the settings panel is a labelled dialog that closes on Escape", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))

  const dialog = findByTestId(container, "settings-panel")?.querySelector('[role="dialog"]')
  assert.ok(dialog, "the panel must announce itself as a dialog")
  assert.equal(dialog?.getAttribute("aria-modal"), "true")

  // The label has to resolve to the visible title, or screen readers announce an
  // unnamed dialog.
  const labelledBy = dialog?.getAttribute("aria-labelledby")
  assert.ok(labelledBy)
  const title = container.querySelector(`#${labelledBy}`)
  assert.ok(title, "aria-labelledby must point at an element in the dialog")
  assert.equal(title?.textContent?.trim(), "Settings")

  // The detail modal already closed on Escape; the settings panel did not.
  await act(async () => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  await settle()

  assert.equal(findByTestId(container, "settings-panel"), null)
})

test("icon-only card and sidebar controls expose an accessible name", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-a11y",
      tweetUrl: "https://x.com/alice/status/tweet-a11y",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Accessible controls",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z"
    }
  ])

  const { container } = render(<OptionsApp />)
  await settle()

  // AppIcon is always aria-hidden, so an icon-only button without an explicit
  // label is announced as nothing at all.
  const openOnX = findByTestId(container, "card-open-on-x")
  assert.ok(openOnX)
  assert.equal(openOnX?.getAttribute("aria-label"), "Open on X")

  const tagsToggle = findByTestId(container, "sidebar-tags-toggle")
  assert.ok(tagsToggle?.getAttribute("aria-label"))
  const authorsToggle = findByTestId(container, "sidebar-authors-toggle-header")
  assert.ok(authorsToggle?.getAttribute("aria-label"))
})

test("the progress line names the phase instead of the raw pipeline enum", async () => {
  const harness = installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  await act(async () => {
    harness.emitRuntimeMessage({
      type: "autotag/progress",
      progress: { phase: "heuristics", processed: 2, total: 5 }
    })
  })
  await settle()

  const progress = findByTestId(container, "settings-autotag-progress")
  assert.ok(progress, "the panel should show progress while a run is in flight")
  // The internal phase name used to be interpolated straight into translated copy.
  assert.match(progress?.textContent ?? "", /Rule-based/)
  assert.doesNotMatch(progress?.textContent ?? "", /heuristics/)
  assert.match(progress?.textContent ?? "", /2\/5/)
})

test("the sidebar status badge is translated rather than the raw status enum", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: {
      status: "partial_success",
      fetchedCount: 3,
      insertedCount: 2,
      updatedCount: 0,
      failedCount: 1
    }
  })

  const { container } = render(<OptionsApp />)
  await settle()

  const badge = await waitForElement(() =>
    findByTestId(container, "sidebar-status-section")?.querySelector(".workspace-badge")
  )
  assert.ok(badge, "the sidebar hero should render a status badge")
  // StatusBadge falls back to formatStatusLabel, which upper-cases the raw enum
  // ("PARTIAL_SUCCESS"). Only the popup used to pass a translated label.
  assert.equal(badge?.textContent?.trim(), "Partial success")
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

test("the result block follows a later run written by the background worker", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const current = await getSettings()
  const failedRun = {
    finishedAt: "2026-08-17T15:07:59.321Z",
    outcome: "failed" as const,
    error: "HTTP 400: `temperature` is deprecated for this model.",
    suggestedCount: 0,
    pendingCount: 0,
    candidateCount: 8895,
    llmProcessedCount: 0,
    llmBatchCount: 2,
    llmFailedBatchCount: 2,
    newTagBudget: 1,
    vocabularySize: 0
  }
  await saveSettings({ ...current, lastAutoTagRun: failedRun })

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  const before = findByTestId(container, "settings-autotag-result")
  assert.ok(before?.textContent?.includes("temperature"))

  // A run started elsewhere (sync, popup, an earlier panel visit) only lands in
  // storage. Without mirroring it the panel keeps showing the stale failure.
  await act(async () => {
    await saveSettings({
      ...(await getSettings()),
      lastAutoTagRun: {
        finishedAt: "2026-08-18T00:27:04.259Z",
        outcome: "ok",
        suggestedCount: 3,
        pendingCount: 3,
        candidateCount: 8895,
        llmProcessedCount: 20,
        llmBatchCount: 2,
        llmFailedBatchCount: 0,
        newTagBudget: 1,
        vocabularySize: 0
      }
    })
  })
  await settle()

  const after = findByTestId(container, "settings-autotag-result")
  assert.equal(/temperature/.test(after?.textContent ?? ""), false)
  assert.ok(after?.textContent?.includes("3"))
  assert.ok(findByTestId(container, "settings-autotag-result-at"))
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

  assert.equal(harness.getStoredProviderApiKey("openai"), "sk-live-123")
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

  assert.equal(harness.getStoredProviderApiKey("openai"), undefined)
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

  assert.equal(harness.getStoredProviderApiKey("openai"), "sk-draft-456")
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

// A run that stopped early is a partial success. The panel must say what was
// kept and what is left, otherwise it reads like a plain failure and the user
// has no idea that simply running again continues the work.
test("a timed-out run reports what it kept and what is left", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const current = await getSettings()
  await saveSettings({
    ...current,
    lastAutoTagRun: {
      finishedAt: "2026-08-21T00:00:00.000Z",
      outcome: "timed-out",
      suggestedCount: 12,
      pendingCount: 12,
      candidateCount: 400,
      llmProcessedCount: 60,
      llmBatchCount: 6,
      llmFailedBatchCount: 0,
      newTagBudget: 1,
      vocabularySize: 30,
      blockedTagKeyCount: 0,
      blockedDroppedCount: 0,
      budgetDroppedCount: 0,
      unprocessedCount: 140
    }
  })

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  const result = findByTestId(container, "settings-autotag-result")
  assert.ok(result)
  const text = result.textContent ?? ""
  assert.ok(text.includes("12"), "the kept suggestions should be named")
  assert.ok(text.includes("140"), "the leftover candidates should be named")
})

// The cancel button only exists while a run is in flight, and it must reach the
// background worker rather than just resetting local UI state.
test("a running analysis can be stopped from the panel", async () => {
  let cancelCalls = 0
  installChromeRuntimeHarness({
    // Never settles, so the panel stays in its running state for the assertion.
    runAutoTag: () => new Promise<void>(() => {}),
    cancelAutoTag: async () => {
      cancelCalls += 1
      return true
    }
  })
  await resetBookmarksDb()

  const { container, dom } = render(<OptionsApp />)
  await settle()

  await click(dom, findByTestId(container, "footer-settings-toggle"))
  await click(dom, findByTestId(container, "settings-nav-autotag"))

  // No run in flight yet, so there is nothing to stop.
  assert.equal(findByTestId(container, "settings-autotag-cancel"), null)

  await click(dom, findByTestId(container, "settings-autotag-run-now"))

  const cancel = findByTestId(container, "settings-autotag-cancel")
  assert.ok(cancel, "the cancel button should appear while a run is in flight")

  await click(dom, cancel)
  assert.equal(cancelCalls, 1)
})
