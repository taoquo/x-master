import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { useWorkspaceCommands } from "../../src/options/hooks/useWorkspaceCommands.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"

function render(ui: React.ReactElement) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  const rootElement = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(rootElement)

  act(() => {
    root.render(ui)
  })

  return { container: dom.window.document.body as unknown as HTMLDivElement, dom }
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()
  })
}

async function waitForAssertion(assertion: () => void, attempts = 8) {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await settle()
    }
  }

  throw lastError
}

function getButton(container: HTMLDivElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === label)
  assert.ok(button)
  return button
}

function Harness() {
  const commands = useWorkspaceCommands({
    bookmarks: [],
    knowledgeCards: [],
    bookmarkTags: [],
    tags: [],
    exportScope: "all",
    refreshData: async () => {}
  })

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void commands.handleUpdateKnowledgeCardDraft("missing-card", {
            title: "Missing",
            theme: "Missing",
            summary: "Missing",
            keyExcerpt: "Missing",
            applicability: "Missing"
          }).catch(() => {})
        }}>
        Trigger save error
      </button>
      <button
        type="button"
        onClick={() => {
          void commands.handleRegenerateKnowledgeCardDraft("card-missing").catch(() => {})
        }}>
        Trigger regenerate error
      </button>
      <button type="button" onClick={commands.clearCommandError}>
        Clear command error
      </button>
      <div data-testid="command-error">{commands.commandError?.message ?? ""}</div>
    </div>
  )
}

test("useWorkspaceCommands exposes a user-visible error when saving a card fails", async () => {
  await resetBookmarksDb()
  ;(globalThis as typeof globalThis & { chrome?: any }).chrome = undefined

  const { container, dom } = render(React.createElement(Harness))

  const saveButton = getButton(container, "Trigger save error")
  await act(async () => {
    saveButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Knowledge card draft not found/)
  })
})

test("useWorkspaceCommands exposes and clears a user-visible error when regeneration fails", async () => {
  await resetBookmarksDb()
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      sendMessage: async () => ({ error: "Regenerate failed from runtime" })
    }
  }

  const { container, dom } = render(React.createElement(Harness))

  const regenerateButton = getButton(container, "Trigger regenerate error")
  await act(async () => {
    regenerateButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.match(container.textContent ?? "", /Regenerate failed from runtime/)
  })

  const clearButton = getButton(container, "Clear command error")
  await act(async () => {
    clearButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })

  await waitForAssertion(() => {
    assert.doesNotMatch(container.textContent ?? "", /Regenerate failed from runtime/)
  })
})
