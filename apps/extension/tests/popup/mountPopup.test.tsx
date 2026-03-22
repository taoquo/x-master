import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { act } from "react"
import { mountPopup } from "../../src/popup/mountPopup.tsx"

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  })
}

test("mountPopup renders the popup shell into the root container", async () => {
  const dom = installDom()
  const container = dom.window.document.getElementById("root")
  assert.ok(container)

  act(() => {
    mountPopup(container)
  })

  await settle()

  assert.match(container.textContent ?? "", /X Knowledge Cards/)
  assert.match(container.textContent ?? "", /Run the first sync/)
  assert.match(container.textContent ?? "", /Sync now/)
})
