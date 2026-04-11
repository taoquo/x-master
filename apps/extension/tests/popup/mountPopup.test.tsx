import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { act } from "react"
import { mountPopup } from "../../src/popup/mountPopup.tsx"
import { settle } from "../helpers/render.tsx"

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

function installChromeStorageMock(storedValue?: unknown) {
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async () => {}
      }
    }
  }
}

test("mountPopup renders english popup copy and the default light theme", async () => {
  const dom = installDom()
  installChromeStorageMock()
  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })

  await settle()

  assert.match(dom.window.document.body.textContent ?? "", /X Bookmark Manager/)
  assert.match(dom.window.document.body.textContent ?? "", /Workspace entry/)
  assert.match(dom.window.document.body.textContent ?? "", /Local inventory/)
  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-overview-panel"]'))
  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-brand-logo"]'))
  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-actions-panel"]'))
  assert.match(dom.window.document.body.textContent ?? "", /Sync now/)
  assert.equal(dom.window.document.documentElement.dataset.theme, "light")
})

test("mountPopup renders stored english copy and dark theme preference", async () => {
  const dom = installDom()
  installChromeStorageMock({
    schemaVersion: 3,
    locale: "en",
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
  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })

  await settle()

  assert.match(dom.window.document.body.textContent ?? "", /Workspace entry/)
  assert.match(dom.window.document.body.textContent ?? "", /Local inventory/)
  assert.match(dom.window.document.body.textContent ?? "", /Sync now/)
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
})
