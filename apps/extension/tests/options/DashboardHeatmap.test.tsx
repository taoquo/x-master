import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { DashboardHeatmap } from "../../src/options/components/DashboardHeatmap.tsx"
import type { DashboardHeatmapWeek } from "../../src/options/lib/dashboard.ts"
import { ExtensionUiProvider } from "../../src/ui/provider.tsx"

function installDom(matchMediaMatches = false) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as typeof globalThis & { MutationObserver: typeof MutationObserver }).MutationObserver =
    dom.window.MutationObserver
  ;(globalThis as typeof globalThis & { matchMedia: Window["matchMedia"] }).matchMedia = (() => ({
    matches: matchMediaMatches,
    media: "",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    }
  })) as Window["matchMedia"]
  dom.window.matchMedia = globalThis.matchMedia

  return dom
}

function render(ui: React.ReactElement, matchMediaMatches = false) {
  const dom = installDom(matchMediaMatches)
  const rootElement = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(rootElement)

  act(() => {
    root.render(ui)
  })

  return { container: dom.window.document.body as unknown as HTMLDivElement, dom }
}

test("DashboardHeatmap adds touch-friendly active day chips on compact screens", async () => {
  let selectedDate = ""
  const weeks: DashboardHeatmapWeek[] = [
    {
      key: "2026-03-16",
      days: [
        { date: "2026-03-16", count: 2, level: 2, isFuture: false },
        { date: "2026-03-17", count: 0, level: 0, isFuture: false },
        { date: "2026-03-18", count: 1, level: 1, isFuture: false },
        { date: "2026-03-19", count: 0, level: 0, isFuture: false },
        { date: "2026-03-20", count: 0, level: 0, isFuture: false },
        { date: "2026-03-21", count: 0, level: 0, isFuture: false },
        { date: "2026-03-22", count: 0, level: 0, isFuture: false }
      ]
    }
  ]

  const { container, dom } = render(
    React.createElement(
      ExtensionUiProvider,
      undefined,
      React.createElement(DashboardHeatmap, {
        weeks,
        totalPublishedInWindow: 3,
        busiestDayCount: 2,
        busiestDayDate: "2026-03-16",
        onSelectDate: (date: string) => {
          selectedDate = date
        }
      })
    ),
    true
  )

  const touchChip = container.querySelector('button[data-heatmap-chip="true"][data-date="2026-03-16"]') as HTMLButtonElement | null
  assert.ok(touchChip)
  assert.match(touchChip.textContent ?? "", /Mar 16/)

  await act(async () => {
    touchChip.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  assert.equal(selectedDate, "2026-03-16")

  const compactGridButton = container.querySelector('button[data-heatmap-grid="true"][data-date="2026-03-16"]') as HTMLButtonElement | null
  assert.ok(compactGridButton)
  assert.equal(compactGridButton.disabled, true)
})
