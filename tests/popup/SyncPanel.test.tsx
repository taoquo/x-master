import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { act } from "react"
import { SyncPanel } from "../../src/popup/components/SyncPanel.tsx"
import { ExtensionUiProvider } from "../../src/ui/provider.tsx"
import { render, settle } from "../helpers/render.tsx"

test("SyncPanel renders sync summary and triggers manual sync", async () => {
  let clicked = 0
  const { container, dom } = render(
    React.createElement(
      ExtensionUiProvider,
      undefined,
      React.createElement(SyncPanel, {
        summary: {
          status: "success",
          fetchedCount: 5,
          insertedCount: 4,
          updatedCount: 1,
          failedCount: 0,
          lastSyncedAt: "2026-03-15T04:00:00.000Z",
          errorSummary: "none"
        },
        isSyncing: false,
        onSync: async () => {
          clicked += 1
        }
      })
    )
  )

  const button = container.querySelector("button")
  assert.ok(button)
  await settle()

  assert.ok(container.querySelector('[data-testid="popup-sync-panel"]'))
  assert.ok(container.querySelector('[data-testid="popup-sync-card"]'))
  assert.ok(container.querySelector('[data-testid="popup-sync-stats"]'))
  assert.match(container.querySelector('[data-testid="popup-sync-card"]')?.className ?? "", /options-theme-panel/)
  assert.match(container.querySelector('[data-testid="popup-sync-card"]')?.className ?? "", /popup-sync-card-body/)
  assert.match(container.querySelector('[data-testid="popup-sync-card"]')?.className ?? "", /folio-editorial-panel/)
  assert.equal(container.querySelectorAll('[data-testid="popup-sync-stats"] .options-theme-elevated').length, 4)
  assert.equal(container.querySelectorAll('[data-testid="popup-sync-stats"] .popup-sync-stat-card').length, 4)
  assert.match(container.querySelector('[data-testid="popup-sync-error"]')?.className ?? "", /folio-inline-message/)
  assert.doesNotMatch(container.querySelector('[data-testid="popup-sync-error"]')?.className ?? "", /red|sky/)
  assert.match(button.className, /popup-sync-button/)
  assert.match(button.className, /folio-primary-action/)
  assert.match(container.textContent ?? "", /success/)
  assert.match(container.textContent ?? "", /Last sync/)
  assert.match(container.textContent ?? "", /5/)
  assert.match(container.textContent ?? "", /none/)

  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.equal(clicked, 1)
})
