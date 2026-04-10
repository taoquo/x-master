import React from "react"
import { JSDOM } from "jsdom"
import { act } from "react"
import { createRoot } from "react-dom/client"

export function render(ui: React.ReactElement, options?: { prefersDark?: boolean }) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>")
  const prefersDark = options?.prefersDark ?? false
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).window =
    dom.window as unknown as Window & typeof globalThis
  ;(globalThis as typeof globalThis & { window: Window & typeof globalThis; document: Document }).document =
    dom.window.document
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as typeof globalThis & { Blob: typeof Blob }).Blob = dom.window.Blob
  ;(globalThis as typeof globalThis & { URL: typeof URL }).URL = {
    ...dom.window.URL,
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => {}
  } as unknown as typeof URL
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

  const rootElement = dom.window.document.getElementById("root") as HTMLDivElement
  const root = createRoot(rootElement)

  act(() => {
    root.render(ui)
  })

  return { container: dom.window.document.body as unknown as HTMLDivElement, dom, root }
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
