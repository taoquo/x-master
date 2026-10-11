import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { act } from "react"
import { mountPopup } from "../../src/popup/mountPopup.tsx"
import { settle, waitForCondition } from "../helpers/render.tsx"

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
  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-overview-card"]'))
  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-brand-logo"]'))
  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-actions-panel"]'))
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-overview-card"]')?.className ?? "",
    /options-theme-panel/
  )
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-overview-card"]')?.className ?? "",
    /popup-overview-card-body/
  )
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-overview-card"]')?.className ?? "",
    /folio-cover-card/
  )
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-actions-panel"] button')?.className ?? "",
    /options-theme-elevated/
  )
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-actions-panel"] button')?.className ?? "",
    /popup-action-button/
  )
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-actions-panel"] button')?.className ?? "",
    /folio-secondary-action/
  )
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
  assert.match(
    dom.window.document.body.querySelector('[data-testid="popup-overview-card"]')?.className ?? "",
    /options-theme-panel/
  )
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
})

test("mountPopup reports auto-tag progress and the pending suggestion count", async () => {
  const dom = installDom()
  const listeners: Array<(message: unknown) => void> = []
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: undefined }),
        set: async () => {}
      }
    },
    runtime: {
      sendMessage: async () => ({
        bookmarks: [],
        tags: [],
        bookmarkTags: [],
        savedViews: [],
        tagSuggestions: [],
        summary: {
          status: "idle",
          fetchedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          failedCount: 0
        },
        latestSyncRun: null,
        stats: {
          totalBookmarks: 0,
          unclassifiedCount: 0,
          pendingSuggestionCount: 3,
          tagCounts: [],
          topAuthors: []
        }
      }),
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          listeners.push(listener)
        },
        removeListener: () => {}
      }
    }
  }

  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })
  await settle()

  assert.equal(dom.window.document.body.querySelector('[data-testid="popup-autotag-progress"]'), null)

  await act(async () => {
    for (const listener of listeners) {
      listener({
        type: "autotag/progress",
        progress: { phase: "llm", processed: 4, total: 9 }
      })
    }
  })
  await settle()

  const progress = dom.window.document.body.querySelector('[data-testid="popup-autotag-progress"]')
  assert.ok(progress, "the popup should surface auto-tag progress")
  assert.match(progress?.textContent ?? "", /Analyzing tags/)
  assert.match(progress?.textContent ?? "", /4\/9/)

  const pending = dom.window.document.body.querySelector('[data-testid="popup-pending-suggestions"]')
  assert.ok(pending, "the popup should surface the pending suggestion count")
  assert.match(pending?.textContent ?? "", /Pending tags/)
  assert.match(pending?.textContent ?? "", /3/)
})

test("the popup names a running sync the same way the workspace does", async () => {
  const dom = installDom()
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: undefined }),
        set: async () => {}
      }
    },
    runtime: {
      sendMessage: async () => ({
        bookmarks: [],
        tags: [],
        bookmarkTags: [],
        savedViews: [],
        tagSuggestions: [],
        summary: {
          status: "running",
          fetchedCount: 2,
          insertedCount: 1,
          updatedCount: 0,
          failedCount: 0
        },
        latestSyncRun: null,
        stats: {
          totalBookmarks: 0,
          unclassifiedCount: 0,
          pendingSuggestionCount: 0,
          tagCounts: [],
          topAuthors: []
        }
      }),
      onMessage: { addListener: () => {}, removeListener: () => {} }
    }
  }

  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })
  await settle()

  // The popup keeps its own copy table, so the same status used to read "RUNNING"
  // here and "SYNCING" in the workspace sidebar (the badge uppercases its label).
  const badge = dom.window.document.body.querySelector('[data-testid="popup-overview-panel"] .workspace-badge')
  assert.ok(badge, "the popup should render a status badge")
  assert.equal(badge?.textContent?.trim().toLowerCase(), "syncing")
})

function workspaceWithPendingCount(pendingSuggestionCount: number) {
  return {
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
    savedViews: [],
    tagSuggestions: [],
    summary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    },
    latestSyncRun: null,
    stats: {
      totalBookmarks: 0,
      unclassifiedCount: 0,
      pendingSuggestionCount,
      tagCounts: [],
      topAuthors: []
    }
  }
}

// Progress is a broadcast stream with no terminal frame. Without folding in the
// persisted run state, the popup froze on the last frame it happened to see.
test("popup clears auto-tag progress once the run state is gone", async () => {
  const dom = installDom()
  const progressListeners: Array<(message: unknown) => void> = []
  const changeListeners: Array<(changes: Record<string, unknown>, area: string) => void> = []
  const runningHeartbeat = new Date().toISOString()
  let storedSettings: unknown = {
    schemaVersion: 6,
    autoTagRunState: {
      runId: "run-1",
      startedAt: runningHeartbeat,
      updatedAt: runningHeartbeat,
      phase: "llm",
      processed: 4,
      total: 9
    }
  }

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedSettings }),
        set: async () => {}
      },
      onChanged: {
        addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => {
          changeListeners.push(listener)
        },
        removeListener: () => {}
      }
    },
    runtime: {
      sendMessage: async () => workspaceWithPendingCount(0),
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          progressListeners.push(listener)
        },
        removeListener: () => {}
      }
    }
  }

  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })
  await settle()

  await act(async () => {
    for (const listener of progressListeners) {
      listener({ type: "autotag/progress", progress: { phase: "llm", processed: 4, total: 9 } })
    }
  })
  await settle()

  assert.ok(dom.window.document.body.querySelector('[data-testid="popup-autotag-progress"]'))

  // finishRun clears the run state; that is the only completion signal a run
  // produces for the popup.
  storedSettings = { schemaVersion: 6 }
  await act(async () => {
    for (const listener of changeListeners) {
      listener({ settings: storedSettings }, "local")
    }
  })
  await settle()

  // Poll rather than assert straight away: the listener's read is async, and
  // polling settles React before the assertion decides, so a regression fails
  // cleanly instead of mid-flush.
  const cleared = await waitForCondition(
    () => dom.window.document.body.querySelector('[data-testid="popup-autotag-progress"]') === null,
    8
  )

  assert.equal(cleared, true, "a finished run must not leave a frozen progress line behind")
})

// The suggestions a run produces are written after the sync the popup awaited, so
// the count read at mount is stale by the time they land.
test("popup refreshes the pending count when a run finishes", async () => {
  const dom = installDom()
  const progressListeners: Array<(message: unknown) => void> = []
  const changeListeners: Array<(changes: Record<string, unknown>, area: string) => void> = []
  let pendingCount = 0
  let storedSettings: unknown = {
    schemaVersion: 6,
    lastAutoTagRun: { finishedAt: "2026-08-20T00:00:00.000Z", outcome: "ok", suggestedCount: 0, pendingCount: 0 }
  }

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedSettings }),
        set: async () => {}
      },
      onChanged: {
        addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => {
          changeListeners.push(listener)
        },
        removeListener: () => {}
      }
    },
    runtime: {
      sendMessage: async () => workspaceWithPendingCount(pendingCount),
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          progressListeners.push(listener)
        },
        removeListener: () => {}
      }
    }
  }

  const rootElement = dom.window.document.getElementById("root")
  assert.ok(rootElement)

  act(() => {
    mountPopup(rootElement)
  })
  await settle()

  assert.equal(dom.window.document.body.querySelector('[data-testid="popup-pending-suggestions"]'), null)

  // The run landed its suggestions and recorded a new summary.
  pendingCount = 3
  storedSettings = {
    schemaVersion: 6,
    lastAutoTagRun: { finishedAt: "2026-08-21T00:00:00.000Z", outcome: "ok", suggestedCount: 3, pendingCount: 3 }
  }
  await act(async () => {
    for (const listener of changeListeners) {
      listener({ settings: storedSettings }, "local")
    }
  })
  await settle()

  const pending = dom.window.document.body.querySelector('[data-testid="popup-pending-suggestions"]')
  assert.ok(pending, "the popup must pick up suggestions written after its own sync returned")
  assert.match(pending?.textContent ?? "", /3/)
})

