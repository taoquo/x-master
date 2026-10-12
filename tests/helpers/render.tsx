import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"

type RenderResult = {
  container: HTMLDivElement
  dom: JSDOM
  root: ReturnType<typeof createRoot>
}

const activeRenders = new Set<RenderResult>()

// One JSDOM per test FILE, not per render. Building a document and rebinding ten
// globals for every mount made these files CPU-bound: 24 mounts meant 24 JSDOMs, and
// with --test-concurrency=4 the machine turned contention into 100-second files whose
// fixed-tick settle() no longer saw async data in time. Reusing the document removes
// that cost entirely; only the body is reset between mounts, so isolation is unchanged.
let sharedDom: JSDOM | null = null

function getSharedDom(): JSDOM {
  // Rebuilt if a test closed it: window.close() is a legitimate thing for a test to
  // call, and a shared window makes it destroy every later mount in the same file.
  // The helper owns the document's lifetime, so this is only a safety net.
  if (!sharedDom || sharedDom.window?.document == null) {
    sharedDom = new JSDOM("<!doctype html><html><body></body></html>")
  }

  return sharedDom
}

export function render(ui: React.ReactElement, options?: { prefersDark?: boolean }) {
  const dom = getSharedDom()
  const prefersDark = options?.prefersDark ?? false
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as typeof globalThis & { Blob: typeof Blob }).Blob = dom.window.Blob
  // Keep jsdom's URL constructor usable (code under test calls `new URL(...)`)
  // while stubbing the object-URL helpers jsdom does not implement.
  const UrlConstructor = dom.window.URL as unknown as typeof URL
  UrlConstructor.createObjectURL = () => "blob:test"
  UrlConstructor.revokeObjectURL = () => {}
  ;(globalThis as typeof globalThis & { URL: typeof URL }).URL = UrlConstructor
  ;(globalThis as typeof globalThis & {
    requestAnimationFrame: (callback: FrameRequestCallback) => number
    cancelAnimationFrame: (handle: number) => void
  }).requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0) as unknown as number
  ;(globalThis as typeof globalThis & {
    requestAnimationFrame: (callback: FrameRequestCallback) => number
    cancelAnimationFrame: (handle: number) => void
  }).cancelAnimationFrame = (handle) => clearTimeout(handle)
  dom.window.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0) as unknown as number
  dom.window.cancelAnimationFrame = (handle) => clearTimeout(handle as unknown as number)
  ;(dom.window.HTMLElement.prototype as HTMLElement & {
    attachEvent?: (eventName: string, listener: EventListenerOrEventListenerObject) => void
    detachEvent?: (eventName: string, listener: EventListenerOrEventListenerObject) => void
  }).attachEvent = function attachEvent(_eventName, _listener) {}
  ;(dom.window.HTMLElement.prototype as HTMLElement & {
    attachEvent?: (eventName: string, listener: EventListenerOrEventListenerObject) => void
    detachEvent?: (eventName: string, listener: EventListenerOrEventListenerObject) => void
  }).detachEvent = function detachEvent(_eventName, _listener) {}
  ;(globalThis as typeof globalThis & { MutationObserver: typeof MutationObserver }).MutationObserver =
    dom.window.MutationObserver
  ;(globalThis as typeof globalThis & { ResizeObserver: any }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const matchMedia = (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    }
  })
  ;(globalThis as typeof globalThis & { matchMedia?: typeof dom.window.matchMedia }).matchMedia =
    matchMedia as typeof dom.window.matchMedia
  dom.window.matchMedia = matchMedia as typeof dom.window.matchMedia

  // Any root still mounted from an earlier test is unmounted first. Rebuilding the
  // document used to hide that leak by giving each mount its own window; with one
  // shared document the stale root would keep its effects (timers, observers, storage
  // listeners) alive and its nodes in the body, so isolation has to be explicit.
  for (const stale of Array.from(activeRenders)) {
    activeRenders.delete(stale)
    act(() => {
      stale.root.unmount()
    })
  }

  // A clean document per mount. Rebuilding the DOM used to reset everything for free;
  // with one shared document every piece of residual state has to be cleared, and
  // clearing only innerHTML is not enough — class names, data attributes, inline
  // styles on <body>/<html> and storage all survive a node wipe.
  const document = dom.window.document
  document.body.innerHTML = ""
  for (const attribute of Array.from(document.body.attributes)) {
    document.body.removeAttribute(attribute.name)
  }
  for (const attribute of Array.from(document.documentElement.attributes)) {
    document.documentElement.removeAttribute(attribute.name)
  }
  try {
    dom.window.localStorage?.clear()
    dom.window.sessionStorage?.clear()
  } catch {
    // Storage may be unavailable for the jsdom URL; nothing to reset then.
  }
  const rootElement = dom.window.document.createElement("div")
  rootElement.id = "root"
  dom.window.document.body.appendChild(rootElement)
  const root = createRoot(rootElement)

  act(() => {
    root.render(ui)
  })

  const result = {
    container: dom.window.document.body as unknown as HTMLDivElement,
    dom,
    root
  }
  activeRenders.add(result)

  return result
}

export async function settle() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
      await Promise.resolve()
    })
  }
}

// IndexedDB teardown (restore / reset) can take longer than a fixed number of
// ticks when the suite runs files in parallel, so poll instead of guessing.
export async function waitForCondition(predicate: () => boolean, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) {
      return true
    }

    await settle()
  }

  return predicate()
}

export async function cleanupRender(result: RenderResult) {
  if (!activeRenders.has(result)) {
    return
  }

  activeRenders.delete(result)
  await act(async () => {
    result.root.unmount()
  })
  // The window is shared for the whole file and deliberately not closed here: closing
  // it would leave the next mount with a destroyed document.
  result.dom.window.document.body.innerHTML = ""
}

export async function cleanupRenders() {
  const renders = Array.from(activeRenders)

  for (const result of renders) {
    await cleanupRender(result)
  }
}

// Waits for an element that only appears after an async data read. Asserting straight
// after settle() assumes three ticks are enough, which stops being true when the suite
// runs files in parallel on a loaded machine — the same assertion then fails as a bare
// "element not found" with no indication that it was a timing issue.
export async function waitForElement<T extends Element>(
  lookup: () => T | null | undefined,
  attempts = 40
): Promise<T | null> {
  for (let index = 0; index < attempts; index += 1) {
    const found = lookup()
    if (found) {
      return found
    }

    await settle()
  }

  return lookup() ?? null
}
