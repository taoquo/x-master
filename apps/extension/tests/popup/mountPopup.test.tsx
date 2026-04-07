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

test("mountPopup renders the simplified popup shell into the root container", async () => {
  const dom = installDom()
  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })

  await settle()

  assert.match(dom.window.document.body.textContent ?? "", /X Bookmark Manager/)
  assert.match(dom.window.document.body.textContent ?? "", /Workspace snapshot/)
  assert.match(dom.window.document.body.textContent ?? "", /Sync now/)
})
