import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { act } from "react"
import { OptionsApp } from "../../src/options/OptionsApp.tsx"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { saveSettings } from "../../src/lib/storage/settings.ts"
import { createEmptySyncSummary } from "../../src/lib/types.ts"
import type { AutoTagRunState } from "../../src/lib/types.ts"
import { cleanupRenders, render, settle, waitForCondition } from "../helpers/render.tsx"
import { installChromeRuntimeHarness } from "../helpers/runtime.ts"

test.afterEach(cleanupRenders)

function findByTestId(container: HTMLDivElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)
}

function runState(overrides: Partial<AutoTagRunState> = {}): AutoTagRunState {
  const now = new Date()
  return {
    runId: "run-1",
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    phase: "llm",
    processed: 4,
    total: 9,
    status: "running",
    inFlight: true,
    ...overrides
  }
}

async function seedSettings(autoTagRunState: AutoTagRunState | undefined) {
  await saveSettings({
    schemaVersion: 7,
    locale: "en",
    themePreference: "system",
    lastSyncSummary: createEmptySyncSummary(),
    savedViews: [],
    ...(autoTagRunState ? { autoTagRunState } : {})
  } as never)
}

// The persisted run state is what a refreshed page has to work from. Before this,
// the numbers only ever arrived through the live broadcast, so reloading mid-run
// showed nothing at all until the next batch finished (up to ~90s later).
test("a reload mid-run shows the persisted progress with no broadcast at all", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await seedSettings(runState({ processed: 4, total: 9, phase: "llm" }))

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const bar = findByTestId(container, "sidebar-autotag-progress")
  assert.ok(bar, "the sidebar must render progress for an active run")
  assert.equal(findByTestId(container, "sidebar-autotag-progress-count")?.textContent, "4/9")
  assert.match(bar?.textContent ?? "", /LLM/)
})

test("a provider-requested wait is shown as waiting, with the seconds left", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await seedSettings(
    runState({
      status: "waiting",
      waitingUntilMs: Date.now() + 30_000,
      waitingReason: "rate-limit"
    })
  )

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const bar = findByTestId(container, "sidebar-autotag-progress")
  assert.ok(bar)
  assert.equal(bar?.getAttribute("data-status"), "waiting")
  assert.match(findByTestId(container, "sidebar-autotag-progress-status")?.textContent ?? "", /Waiting for the provider/)
  // An indeterminate bar must not announce a percentage.
  assert.equal(bar?.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow"), null)
})

test("a silent heartbeat is reported as possibly stopped instead of a frozen bar", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const stale = new Date(Date.now() - 60_000).toISOString()
  await seedSettings(runState({ updatedAt: stale, inFlight: true }))

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const bar = findByTestId(container, "sidebar-autotag-progress")
  assert.ok(bar)
  assert.equal(bar?.getAttribute("data-stalled"), "true")
  assert.match(findByTestId(container, "sidebar-autotag-progress-status")?.textContent ?? "", /may have stopped/)
})

test("a run whose heartbeat is past the liveness window shows no progress", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const dead = new Date(Date.now() - 10 * 60_000).toISOString()
  await seedSettings(runState({ startedAt: dead, updatedAt: dead }))

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.equal(findByTestId(container, "sidebar-autotag-progress"), null, "a dead run must not render a bar")
})

test("a broadcast that is newer than the stored state still renders", async () => {
  const harness = installChromeRuntimeHarness()
  await resetBookmarksDb()
  // No persisted run state: a run that just started may not have written one yet.
  await seedSettings(undefined)

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.equal(findByTestId(container, "sidebar-autotag-progress"), null)

  await act(async () => {
    harness.emitRuntimeMessage({
      type: "autotag/progress",
      progress: { phase: "llm", processed: 2, total: 9, status: "running", inFlight: true }
    })
  })
  await settle()

  assert.equal(findByTestId(container, "sidebar-autotag-progress-count")?.textContent, "2/9")
})

test("the sidebar can stop the run without opening the settings dialog", async () => {
  let cancelCalls = 0
  installChromeRuntimeHarness({
    cancelAutoTag: async () => {
      cancelCalls += 1
      return true
    }
  })
  await resetBookmarksDb()
  await seedSettings(runState())

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const cancel = findByTestId(container, "sidebar-autotag-progress-cancel") as HTMLButtonElement | null
  assert.ok(cancel, "the persistent progress must offer a stop button")
  await act(async () => {
    cancel.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await waitForCondition(() => cancelCalls === 1)
  assert.equal(cancelCalls, 1)
})
