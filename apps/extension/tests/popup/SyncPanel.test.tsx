import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { SyncPanel } from "../../src/popup/components/SyncPanel.tsx"

function render(ui: React.ReactElement) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  const container = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(container)

  act(() => {
    root.render(ui)
  })

  return { dom, container, root }
}

test("SyncPanel renders sync summary and triggers manual sync", async () => {
  let clicked = 0
  const { container, dom } = render(
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

  const button = container.querySelector("button")
  assert.ok(button)
  assert.match(container.textContent ?? "", /success/i)
  assert.match(container.textContent ?? "", /5/)
  assert.match(container.textContent ?? "", /none/)

  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.equal(clicked, 1)
})
