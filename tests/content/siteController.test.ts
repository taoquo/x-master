import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { createSiteTaggingController } from "../../src/content/site-controller.ts"
import type { SiteTweetCreateTagResult, SiteTweetTagState, TagRecord } from "../../src/lib/types.ts"

function createTag(id: string, name: string): TagRecord {
  return {
    id,
    name,
    createdAt: "2026-04-01T00:00:00.000Z"
  }
}

function createBookmarksDom(pathname: string, buttonTestId = "removeBookmark") {
  return new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <main>
          <article data-testid="tweet-1">
            <div data-testid="tweet-header">
              <div data-testid="User-Name">
                <a href="/alice"><span>Alice</span></a>
                <a href="/alice/status/1234567890"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
              </div>
              <div data-testid="tweet-top-actions">
                <button data-testid="grok" aria-label="Grok"></button>
                <button data-testid="caret" aria-label="More"></button>
              </div>
            </div>
            <div data-testid="tweetText">Alpha tweet</div>
            <div role="group">
              <button data-testid="${buttonTestId}" aria-label="Bookmark"></button>
            </div>
          </article>
        </main>
      </body>
    </html>`,
    { url: `https://x.com${pathname}` }
  )
}

function createBookmarksDomWithoutTopActions(pathname: string) {
  return new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <main>
          <article data-testid="tweet-2">
            <div data-testid="content-shell">
              <div data-testid="User-Name">
                <a href="/bob"><span>Bob</span></a>
                <a href="/bob/status/222"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
              </div>
              <div data-testid="tweetText">Beta tweet</div>
              <div data-testid="show-more-wrapper">
                <button aria-label="Show more">Show more</button>
              </div>
            </div>
          </article>
        </main>
      </body>
    </html>`,
    { url: `https://x.com${pathname}` }
  )
}

function createBookmarksDomWithAvatarRow(pathname: string) {
  return new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <main>
          <article data-testid="tweet-3">
            <div data-testid="tweet-row">
              <div data-testid="avatar-shell"><img alt="" src="https://example.com/avatar.png" /></div>
              <div data-testid="content-shell">
                <div data-testid="User-Name">
                  <a href="/cara"><span>Cara</span></a>
                  <a href="/cara/status/333"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
                </div>
                <div data-testid="tweetText">Gamma tweet</div>
              </div>
            </div>
          </article>
        </main>
      </body>
    </html>`,
    { url: `https://x.com${pathname}` }
  )
}

function createBookmarksDomWithNestedTopActions(pathname: string) {
  return new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <main>
          <article data-testid="tweet-4">
            <div data-testid="tweet-header">
              <div data-testid="User-Name">
                <a href="/dora"><span>Dora</span></a>
                <a href="/dora/status/444"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
              </div>
              <div data-testid="tweet-top-actions">
                <div data-testid="grok-wrapper">
                  <button data-testid="grok" aria-label="Grok"></button>
                </div>
                <div data-testid="more-wrapper">
                  <button data-testid="caret" aria-label="More"></button>
                </div>
              </div>
            </div>
            <div data-testid="tweetText">Delta tweet</div>
          </article>
        </main>
      </body>
    </html>`,
    { url: `https://x.com${pathname}` }
  )
}

async function settle() {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

function queryShadow<T extends Element>(host: Element | null, selector: string) {
  return host && "shadowRoot" in host ? ((host.shadowRoot?.querySelector(selector) as T | null) ?? null) : null
}

test("bookmarks controller injects one quick-tag button per article and opens the popover", async () => {
  const dom = createBookmarksDom("/i/bookmarks")
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 40,
      y: 120,
      top: 120,
      left: 40,
      right: 640,
      bottom: 620,
      width: 600,
      height: 500,
      toJSON() {
        return {}
      }
    })
  })
  const topActions = dom.window.document.querySelector('[data-testid="tweet-top-actions"]') as HTMLElement
  Object.defineProperty(topActions, "getBoundingClientRect", {
    value: () => ({
      x: 548,
      y: 124,
      top: 124,
      left: 548,
      right: 620,
      bottom: 156,
      width: 72,
      height: 32,
      toJSON() {
        return {}
      }
    })
  })
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "1234567890",
      enabled
    }),
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        locale: "zh-CN",
        tags: [createTag("tag-1", "AI"), createTag("tag-2", "Design")],
        selectedTagIds: ["tag-1"]
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async ({ enabled, tagId }: { bookmarkId: string; tagId: string; enabled: boolean }) => {
      calls.push(`${enabled ? "attach" : "detach"}:${tagId}`)
      return {
        bookmarkId: "1234567890",
        tags: [createTag("tag-1", "AI"), createTag("tag-2", "Design")],
        selectedTagIds: enabled ? ["tag-1", tagId] : ["tag-1"]
      } satisfies SiteTweetTagState
    },
    createSiteTweetTag: async ({ name }: { bookmarkId: string; name: string }) => {
      calls.push(`create:${name}`)
      return {
        bookmarkId: "1234567890",
        createdTag: createTag("tag-3", name),
        tags: [createTag("tag-1", "AI"), createTag("tag-2", "Design"), createTag("tag-3", name)],
        selectedTagIds: ["tag-1", "tag-3"]
      } satisfies SiteTweetCreateTagResult
    }
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  const hosts = dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]')
  assert.equal(hosts.length, 1)
  const host = hosts[0] as HTMLElement
  assert.equal(host.parentElement, dom.window.document.body)
  assert.equal(host.style.position, "fixed")
  assert.equal(host.style.left, "508px")
  assert.equal(host.style.top, "124px")

  const trigger = queryShadow<HTMLButtonElement>(host, '[data-testid="site-tag-trigger"]')
  assert.ok(trigger)
  const triggerLogo = queryShadow<HTMLImageElement>(host, '[data-testid="site-tag-trigger-logo"]')
  assert.ok(triggerLogo)

  trigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }))
  await settle()

  const overlayHost = dom.window.document.querySelector('[data-site-tag-popover-host="true"]')
  const popover = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-popover"]')
  const backdrop = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-modal-backdrop"]')
  assert.ok(popover)
  assert.ok(backdrop)
  assert.deepEqual(calls, ["prepare"])
  assert.match(popover.textContent ?? "", /管理这条推文的标签/)
  assert.match(popover.textContent ?? "", /可用标签/)

  const initialPopover = popover
  const initialBackdrop = backdrop

  const designToggle = queryShadow<HTMLInputElement>(overlayHost, '[data-testid="site-tag-option-tag-2"]')
  assert.ok(designToggle)
  designToggle.checked = true
  designToggle.dispatchEvent(new dom.window.Event("change", { bubbles: true, composed: true }))
  await settle()

  const nextPopover = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-popover"]')
  const nextBackdrop = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-modal-backdrop"]')
  assert.equal(nextPopover, initialPopover)
  assert.equal(nextBackdrop, initialBackdrop)

  const createTrigger = queryShadow<HTMLButtonElement>(overlayHost, '[data-testid="site-tag-create-trigger"]')
  assert.ok(createTrigger)
  createTrigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }))
  await settle()

  const createInput = queryShadow<HTMLInputElement>(overlayHost, '[data-testid="site-tag-create-input"]')
  const createSubmit = queryShadow<HTMLButtonElement>(overlayHost, '[data-testid="site-tag-create-submit"]')
  assert.ok(createInput)
  assert.ok(createSubmit)
  createInput.value = "Research"
  createInput.dispatchEvent(new dom.window.Event("input", { bubbles: true, composed: true }))
  createSubmit.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }))
  await settle()

  assert.deepEqual(calls, ["prepare", "attach:tag-2", "create:Research"])

  controller.destroy()
})

test("bookmarks controller falls back when extension asset url resolution is invalidated", async () => {
  const dom = createBookmarksDom("/i/bookmarks")
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 24,
      y: 64,
      top: 64,
      left: 24,
      right: 424,
      bottom: 364,
      width: 400,
      height: 300,
      toJSON() {
        return {}
      }
    })
  })
  const topActions = dom.window.document.querySelector('[data-testid="tweet-top-actions"]') as HTMLElement
  Object.defineProperty(topActions, "getBoundingClientRect", {
    value: () => ({
      x: 332,
      y: 72,
      top: 72,
      left: 332,
      right: 404,
      bottom: 104,
      width: 72,
      height: 32,
      toJSON() {
        return {}
      }
    })
  })
  const originalChrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    runtime: {
      getURL: () => {
        throw new Error("Extension context invalidated.")
      }
    }
  }

  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "1234567890",
      enabled
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "1234567890",
      locale: "zh-CN",
      tags: [createTag("tag-1", "AI")],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-1", "AI"), createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  try {
    const controller = createSiteTaggingController({
      window: dom.window as unknown as Window,
      document: dom.window.document,
      pathname: dom.window.location.pathname,
      client
    })

    assert.doesNotThrow(() => controller.start())

    article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
    await settle()

    const host = dom.window.document.querySelector('[data-site-tag-overlay-host="true"]')
    const trigger = queryShadow<HTMLButtonElement>(host, '[data-testid="site-tag-trigger"]')
    const triggerLogo = queryShadow<HTMLImageElement>(host, '[data-testid="site-tag-trigger-logo"]')
    assert.ok(trigger)
    assert.equal(triggerLogo?.getAttribute("src"), "assets/branding/logo-72.png")

    trigger.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }))
    await settle()

    const overlayHost = dom.window.document.querySelector('[data-site-tag-popover-host="true"]')
    const popover = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-popover"]')
    assert.ok(overlayHost)
    assert.ok(popover)

    controller.destroy()
  } finally {
    if (originalChrome === undefined) {
      Reflect.deleteProperty(globalThis, "chrome")
    } else {
      ;(globalThis as typeof globalThis & { chrome?: unknown }).chrome = originalChrome
    }
  }
})

test("home controller waits for the native bookmark state to switch before opening the popover", async () => {
  const dom = createBookmarksDom("/home", "bookmark")
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        locale: "en",
        tags: [createTag("tag-1", "AI")],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="bookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)

  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  nativeBookmarkButton.setAttribute("data-testid", "removeBookmark")

  await new Promise((resolve) => setTimeout(resolve, 60))

  const overlayHost = dom.window.document.querySelector('[data-site-tag-popover-host="true"]')
  const popover = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-popover"]')
  const backdrop = queryShadow<HTMLDivElement>(overlayHost, '[data-testid="site-tag-modal-backdrop"]')

  assert.ok(popover)
  assert.ok(backdrop)
  assert.deepEqual(calls, ["sync:add", "prepare"])

  controller.destroy()
})

test("home controller removes any inline tag button hosts and only uses native bookmark click", async () => {
  const dom = createBookmarksDom("/home", "bookmark")
  const staleHost = dom.window.document.createElement("span")
  staleHost.dataset.siteTagButtonHost = "true"
  dom.window.document.body.appendChild(staleHost)
  const staleOverlayHost = dom.window.document.createElement("span")
  staleOverlayHost.dataset.siteTagOverlayHost = "true"
  dom.window.document.body.appendChild(staleOverlayHost)

  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        locale: "zh-CN",
        tags: [createTag("tag-1", "AI")],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-button-host="true"]').length, 0)
  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]').length, 0)

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="bookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)
  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  nativeBookmarkButton.setAttribute("data-testid", "removeBookmark")
  await new Promise((resolve) => setTimeout(resolve, 60))

  assert.deepEqual(calls, ["sync:add", "prepare"])
  assert.ok(dom.window.document.querySelector('[data-site-tag-popover-host="true"]'))

  controller.destroy()
})

test("home controller ignores clicks that do not become a bookmarked state", async () => {
  const dom = createBookmarksDom("/home", "bookmark")
  let prepareCalls = 0
  const client = {
    syncSiteTweetBookmark: async () => ({ bookmarkId: "1234567890", enabled: true }),
    prepareSiteTweetTagging: async () => {
      prepareCalls += 1
      return {
        bookmarkId: "1234567890",
        tags: [],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 2,
      delayMs: 5
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="bookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)
  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))

  await new Promise((resolve) => setTimeout(resolve, 30))

  assert.equal(prepareCalls, 0)
  assert.equal(dom.window.document.querySelector('[data-site-tag-popover-host="true"]'), null)

  controller.destroy()
})

test("home controller removes the local bookmark when native state switches back to unbookmarked", async () => {
  const dom = createBookmarksDom("/home", "removeBookmark")
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        tags: [],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="removeBookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)

  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  nativeBookmarkButton.setAttribute("data-testid", "bookmark")

  await new Promise((resolve) => setTimeout(resolve, 60))

  assert.deepEqual(calls, ["sync:remove"])
  assert.equal(dom.window.document.querySelector('[data-site-tag-popover-host="true"]'), null)

  controller.destroy()
})

test("bookmarks controller opens the tag popover after native re-bookmark succeeds", async () => {
  const dom = createBookmarksDom("/i/bookmarks", "bookmark")
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        locale: "en",
        tags: [createTag("tag-1", "AI")],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="bookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)
  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  nativeBookmarkButton.setAttribute("data-testid", "removeBookmark")

  await new Promise((resolve) => setTimeout(resolve, 60))

  assert.deepEqual(calls, ["sync:add", "prepare"])
  assert.ok(dom.window.document.querySelector('[data-site-tag-popover-host="true"]'))

  controller.destroy()
})

test("bookmarks controller removes the local bookmark when native remove bookmark is clicked", async () => {
  const dom = createBookmarksDom("/i/bookmarks", "removeBookmark")
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "1234567890",
      tags: [createTag("tag-1", "AI")],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 3,
      delayMs: 10
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="removeBookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)
  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  nativeBookmarkButton.remove()

  await new Promise((resolve) => setTimeout(resolve, 40))

  assert.deepEqual(calls, ["sync:remove"])

  controller.destroy()
})

test("bookmarks controller still removes the local bookmark when the tweet draft disappears before confirmation resolves", async () => {
  const dom = createBookmarksDom("/i/bookmarks", "removeBookmark")
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "1234567890",
      tags: [createTag("tag-1", "AI")],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const article = dom.window.document.querySelector("article") as HTMLElement | null
  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 3,
      delayMs: 10
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="removeBookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)
  assert.ok(article)

  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  article.innerHTML = ""

  await new Promise((resolve) => setTimeout(resolve, 40))

  assert.deepEqual(calls, ["sync:remove"])

  controller.destroy()
})

test("standard tweet pages outside home also open the tag popover after native bookmark succeeds", async () => {
  const dom = createBookmarksDom("/alice", "bookmark")
  const calls: string[] = []
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => {
      calls.push(`sync:${enabled ? "add" : "remove"}`)
      return { bookmarkId: "1234567890", enabled }
    },
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        locale: "en",
        tags: [createTag("tag-1", "AI")],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  const nativeBookmarkButton = dom.window.document.querySelector('button[data-testid="bookmark"]') as HTMLButtonElement | null
  assert.ok(nativeBookmarkButton)
  nativeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  nativeBookmarkButton.setAttribute("data-testid", "removeBookmark")

  await new Promise((resolve) => setTimeout(resolve, 60))

  assert.deepEqual(calls, ["sync:add", "prepare"])
  assert.ok(dom.window.document.querySelector('[data-site-tag-popover-host="true"]'))

  controller.destroy()
})

test("controller removes bookmark overlay trigger after navigating away from bookmarks", async () => {
  const dom = createBookmarksDom("/i/bookmarks")
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 40,
      y: 120,
      top: 120,
      left: 40,
      right: 640,
      bottom: 620,
      width: 600,
      height: 500,
      toJSON() {
        return {}
      }
    })
  })
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "1234567890",
      enabled
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "1234567890",
      tags: [createTag("tag-1", "AI")],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]').length, 1)

  dom.window.history.pushState({}, "", "/home")
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]').length, 0)

  controller.destroy()
})

test("controller switches out of bookmarks mode when x spa updates the url without firing history hooks", async () => {
  const dom = createBookmarksDom("/i/bookmarks")
  const calls: string[] = []
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 40,
      y: 120,
      top: 120,
      left: 40,
      right: 640,
      bottom: 620,
      width: 600,
      height: 500,
      toJSON() {
        return {}
      }
    })
  })
  const topActions = dom.window.document.querySelector('[data-testid="tweet-top-actions"]') as HTMLElement
  Object.defineProperty(topActions, "getBoundingClientRect", {
    value: () => ({
      x: 548,
      y: 124,
      top: 124,
      left: 548,
      right: 620,
      bottom: 156,
      width: 72,
      height: 32,
      toJSON() {
        return {}
      }
    })
  })
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "1234567890",
      enabled
    }),
    prepareSiteTweetTagging: async () => {
      calls.push("prepare")
      return {
        bookmarkId: "1234567890",
        tags: [createTag("tag-1", "AI")],
        selectedTagIds: []
      } satisfies SiteTweetTagState
    },
    setSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "1234567890",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client,
    bookmarkConfirmation: {
      attempts: 4,
      delayMs: 10
    }
  })
  controller.start()

  article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()
  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]').length, 1)

  dom.reconfigure({ url: "https://x.com/home" })
  dom.window.document.body.innerHTML = `
    <main>
      <article data-testid="home-tweet">
        <div data-testid="tweet-header">
          <div data-testid="User-Name">
            <a href="/eve"><span>Eve</span></a>
            <a href="/eve/status/999"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
          </div>
        </div>
        <div data-testid="tweetText">Home timeline tweet</div>
        <div role="group">
          <button data-testid="bookmark" aria-label="Bookmark"></button>
        </div>
      </article>
    </main>
  `
  await settle()

  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]').length, 0)

  const homeArticle = dom.window.document.querySelector("article") as HTMLElement
  homeArticle.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  assert.equal(dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]').length, 0)

  const homeBookmarkButton = dom.window.document.querySelector('button[data-testid="bookmark"]') as HTMLButtonElement | null
  assert.ok(homeBookmarkButton)
  homeBookmarkButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 15))
  homeBookmarkButton.setAttribute("data-testid", "removeBookmark")
  await new Promise((resolve) => setTimeout(resolve, 60))

  assert.deepEqual(calls, ["prepare"])
  assert.ok(dom.window.document.querySelector('[data-site-tag-popover-host="true"]'))

  controller.destroy()
})

test("bookmarks controller shows the overlay trigger even when the tweet has no top action rail", async () => {
  const dom = createBookmarksDomWithoutTopActions("/i/bookmarks")
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 12,
      y: 80,
      top: 80,
      left: 12,
      right: 372,
      bottom: 380,
      width: 360,
      height: 300,
      toJSON() {
        return {}
      }
    })
  })
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "222",
      enabled
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "222",
      locale: "zh-CN",
      tags: [],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "222",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "222",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client
  })
  controller.start()

  article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  const host = dom.window.document.querySelector('[data-site-tag-overlay-host="true"]') as HTMLElement | null
  assert.ok(host)
  assert.equal(host.parentElement, dom.window.document.body)
  assert.equal(host.style.left, "328px")
  assert.equal(host.style.top, "92px")

  controller.destroy()
})

test("bookmarks controller reuses one overlay trigger and repositions it for the active article", async () => {
  const dom = new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <main>
          <article data-testid="tweet-a">
            <div data-testid="User-Name">
              <a href="/a"><span>A</span></a>
              <a href="/a/status/1"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
            </div>
            <div data-testid="tweetText">First tweet</div>
          </article>
          <article data-testid="tweet-b">
            <div data-testid="User-Name">
              <a href="/b"><span>B</span></a>
              <a href="/b/status/2"><time datetime="2026-04-01T12:00:00.000Z"></time></a>
            </div>
            <div data-testid="tweetText">Second tweet</div>
          </article>
        </main>
      </body>
    </html>`,
    { url: "https://x.com/i/bookmarks" }
  )
  const [firstArticle, secondArticle] = Array.from(dom.window.document.querySelectorAll("article")) as HTMLElement[]
  Object.defineProperty(firstArticle, "getBoundingClientRect", {
    value: () => ({
      x: 20,
      y: 40,
      top: 40,
      left: 20,
      right: 420,
      bottom: 240,
      width: 400,
      height: 200,
      toJSON() {
        return {}
      }
    })
  })
  Object.defineProperty(secondArticle, "getBoundingClientRect", {
    value: () => ({
      x: 32,
      y: 300,
      top: 300,
      left: 32,
      right: 532,
      bottom: 560,
      width: 500,
      height: 260,
      toJSON() {
        return {}
      }
    })
  })
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "multi",
      enabled
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "multi",
      locale: "zh-CN",
      tags: [],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "multi",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "multi",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client
  })
  controller.start()

  firstArticle.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  let host = dom.window.document.querySelector('[data-site-tag-overlay-host="true"]') as HTMLElement | null
  assert.ok(host)
  assert.equal(host.style.left, "376px")
  assert.equal(host.style.top, "52px")

  secondArticle.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  const overlayHosts = dom.window.document.querySelectorAll('[data-site-tag-overlay-host="true"]')
  assert.equal(overlayHosts.length, 1)
  host = overlayHosts[0] as HTMLElement
  assert.equal(host.style.left, "488px")
  assert.equal(host.style.top, "312px")

  controller.destroy()
})

test("bookmarks controller hides the overlay trigger after leaving the active tweet", async () => {
  const dom = createBookmarksDomWithAvatarRow("/i/bookmarks")
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 30,
      y: 100,
      top: 100,
      left: 30,
      right: 530,
      bottom: 420,
      width: 500,
      height: 320,
      toJSON() {
        return {}
      }
    })
  })
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "333",
      enabled
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "333",
      locale: "zh-CN",
      tags: [],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "333",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "333",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client
  })
  controller.start()

  article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  const host = dom.window.document.querySelector('[data-site-tag-overlay-host="true"]') as HTMLElement | null
  assert.ok(host)
  assert.equal(host.style.opacity, "1")

  article.dispatchEvent(new dom.window.MouseEvent("mouseleave", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  assert.equal(host.style.opacity, "0")
  assert.equal(host.style.pointerEvents, "none")

  controller.destroy()
})

test("bookmarks controller keeps working with nested action-rail markup because it no longer inserts into the tweet DOM", async () => {
  const dom = createBookmarksDomWithNestedTopActions("/i/bookmarks")
  const article = dom.window.document.querySelector("article") as HTMLElement
  Object.defineProperty(article, "getBoundingClientRect", {
    value: () => ({
      x: 40,
      y: 90,
      top: 90,
      left: 40,
      right: 540,
      bottom: 390,
      width: 500,
      height: 300,
      toJSON() {
        return {}
      }
    })
  })
  const client = {
    syncSiteTweetBookmark: async ({ enabled }: { tweet: unknown; enabled: boolean }) => ({
      bookmarkId: "444",
      enabled
    }),
    prepareSiteTweetTagging: async () => ({
      bookmarkId: "444",
      locale: "zh-CN",
      tags: [],
      selectedTagIds: []
    }) satisfies SiteTweetTagState,
    setSiteTweetTag: async () => ({
      bookmarkId: "444",
      tags: [],
      selectedTagIds: []
    }),
    createSiteTweetTag: async () => ({
      bookmarkId: "444",
      createdTag: createTag("tag-2", "Research"),
      tags: [createTag("tag-2", "Research")],
      selectedTagIds: ["tag-2"]
    })
  }

  const controller = createSiteTaggingController({
    window: dom.window as unknown as Window,
    document: dom.window.document,
    pathname: dom.window.location.pathname,
    client
  })

  assert.doesNotThrow(() => controller.start())
  article.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: true, relatedTarget: dom.window.document.body }))
  await settle()

  const host = dom.window.document.querySelector('[data-site-tag-overlay-host="true"]') as HTMLElement | null
  const topActions = dom.window.document.querySelector('[data-testid="tweet-top-actions"]')
  assert.ok(host)
  assert.ok(topActions)
  assert.equal(host.parentElement, dom.window.document.body)

  controller.destroy()
})
