import type { SiteTweetDraft } from "../lib/types.ts"
import type { SiteTaggingClient } from "./site-client.ts"
import { createSiteTaggingClient } from "./site-client.ts"
import { SiteTagPopover } from "./tag-popover.ts"
import { extractSiteTweetDraft } from "./tweet-dom.ts"

const TAG_BUTTON_LOGO_PATH = "assets/branding/logo-72.png"
const BOOKMARK_OVERLAY_SIZE = 32
const BOOKMARK_OVERLAY_INSET = 12
const BOOKMARK_OVERLAY_GAP = 8
const BUTTON_STYLE = `
  :host {
    all: initial;
    --folio-paper: #fbf7f3;
    --folio-border: #e4d7cb;
    --folio-brand: #b83d2e;
    --folio-ink: #191514;
  }

  button {
    appearance: none;
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--folio-brand) 16%, var(--folio-border));
    background:
      radial-gradient(circle at 30% 30%, rgba(255, 253, 249, 0.98), rgba(246, 236, 228, 0.92) 58%, rgba(240, 225, 214, 0.96));
    border-radius: 999px;
    box-shadow:
      0 10px 24px rgba(58, 49, 45, 0.16),
      inset 0 1px 0 rgba(255, 253, 249, 0.78);
    padding: 0;
    cursor: pointer;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  button img {
    width: 14px;
    height: 14px;
    display: block;
    border-radius: 999px;
    object-fit: cover;
  }

  .logo-fallback {
    position: relative;
    width: 14px;
    height: 14px;
    display: none;
    border-radius: 5px;
    background:
      linear-gradient(135deg, rgba(111, 220, 205, 0.96), rgba(255, 208, 112, 0.96));
    box-shadow: inset 0 0 0 1px rgba(255, 253, 249, 0.72);
  }

  .logo-fallback::before {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    top: 3px;
    bottom: 3px;
    border: 1px solid rgba(255, 253, 249, 0.9);
    border-bottom: 0;
    border-radius: 2px 2px 1px 1px;
  }

  .logo-fallback::after {
    content: "";
    position: absolute;
    left: 5px;
    right: 5px;
    bottom: 3px;
    height: 4px;
    border-left: 1px solid rgba(255, 253, 249, 0.9);
    border-right: 1px solid rgba(255, 253, 249, 0.9);
    transform: skewY(-28deg);
    transform-origin: top center;
  }

  button[data-logo-loaded="false"] .logo-fallback {
    display: block;
  }

  button:hover {
    transform: translateY(-1px) scale(1.02);
    border-color: color-mix(in srgb, var(--folio-brand) 34%, var(--folio-border));
    box-shadow:
      0 14px 30px rgba(58, 49, 45, 0.22),
      inset 0 1px 0 rgba(255, 253, 249, 0.82);
  }

  button:active {
    transform: translateY(0) scale(0.98);
  }
`

interface BookmarkConfirmationOptions {
  attempts: number
  delayMs: number
}

interface SiteTaggingControllerOptions {
  window?: Window
  document?: Document
  pathname?: string
  client?: SiteTaggingClient
  bookmarkConfirmation?: BookmarkConfirmationOptions
  extractDraft?: (article: Element | null) => SiteTweetDraft | null
}

export function createSiteTaggingController({
  window = globalThis.window,
  document = globalThis.document,
  pathname = globalThis.location?.pathname ?? "",
  client = createSiteTaggingClient(),
  bookmarkConfirmation = { attempts: 16, delayMs: 120 },
  extractDraft = extractSiteTweetDraft
}: SiteTaggingControllerOptions = {}) {
  const popover = new SiteTagPopover({
    document,
    client,
    onOpenStateChange(triggerHost, isOpen) {
      popoverIsOpen = isOpen
      if (!isOpen) {
        activePopoverTweetId = null
      }

      if (!triggerHost) {
        return
      }

      triggerHost.dataset.open = isOpen ? "true" : "false"
      setButtonVisibility(triggerHost, isOpen)
    }
  })

  let mountedArticles = new WeakSet<Element>()
  let currentPathname = pathname
  let bookmarkOverlayHost: HTMLElement | null = null
  let bookmarkOverlayShadowRoot: ShadowRoot | null = null
  let activeBookmarkArticle: HTMLElement | null = null
  let activePopoverTweetId: string | null = null
  let popoverIsOpen = false
  let bookmarkOverlayHovered = false
  const pendingBookmarkArticles = new WeakSet<Element>()
  let observer: MutationObserver | null = null
  const originalPushState = window.history.pushState.bind(window.history)
  const originalReplaceState = window.history.replaceState.bind(window.history)

  function handleRouteChange() {
    syncRouteMode()
  }

  function syncRouteMode() {
    const nextPathname = window.location.pathname
    if (nextPathname === currentPathname) {
      return false
    }

    currentPathname = nextPathname
    applyRouteMode()
    return true
  }

  function start() {
    window.addEventListener("popstate", handleRouteChange)
    window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPushState(...args)
      handleRouteChange()
    }) as History["pushState"]
    window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      originalReplaceState(...args)
      handleRouteChange()
    }) as History["replaceState"]
    document.removeEventListener("click", handleNativeBookmarkClick, true)
    document.addEventListener("click", handleNativeBookmarkClick, true)
    ensureRouteObserver()
    applyRouteMode()
  }

  function destroy() {
    window.removeEventListener("popstate", handleRouteChange)
    window.history.pushState = originalPushState
    window.history.replaceState = originalReplaceState
    document.removeEventListener("click", handleNativeBookmarkClick, true)
    observer?.disconnect()
    observer = null
    teardownBookmarkMode()
    teardownHomeMode()
    popover.destroy()
  }

  function applyRouteMode() {
    if (isBookmarksPath(currentPathname)) {
      teardownHomeMode()
      setupBookmarkMode()
      return
    }

    teardownBookmarkMode()

    if (isHomePath(currentPathname)) {
      setupHomeMode()
      return
    }

    teardownHomeMode()
  }

  function setupBookmarkMode() {
    removeBookmarkTriggerArtifacts()
    scanBookmarkArticles()
    window.addEventListener("scroll", handleBookmarkViewportChange, true)
    window.addEventListener("resize", handleBookmarkViewportChange)
  }

  function teardownBookmarkMode() {
    window.removeEventListener("scroll", handleBookmarkViewportChange, true)
    window.removeEventListener("resize", handleBookmarkViewportChange)
    removeBookmarkTriggerArtifacts()
    mountedArticles = new WeakSet<Element>()
    popover.close()
  }

  function setupHomeMode() {
    removeBookmarkTriggerArtifacts()
  }

  function teardownHomeMode() {
    removeBookmarkTriggerArtifacts()
    popover.close()
  }

  function ensureRouteObserver() {
    if (observer) {
      return
    }

    const MutationObserverCtor =
      (window as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver ??
      globalThis.MutationObserver
    if (!MutationObserverCtor) {
      return
    }

    const nextObserver = new MutationObserverCtor(() => {
      if (syncRouteMode()) {
        return
      }

      if (isBookmarksPath(currentPathname)) {
        scanBookmarkArticles()
      }
    })
    nextObserver.observe(document.body, { childList: true, subtree: true })
    observer = nextObserver
  }

  function scanBookmarkArticles() {
    if (!isBookmarksPath(currentPathname)) {
      return
    }

    document.querySelectorAll("article").forEach((article) => {
      if (mountedArticles.has(article)) {
        return
      }
      attachBookmarkOverlayHandlers(article as HTMLElement)
      mountedArticles.add(article)
    })
  }

  function attachBookmarkOverlayHandlers(article: HTMLElement) {
    const show = () => {
      if (syncRouteMode() || !isBookmarksPath(currentPathname)) {
        return
      }

      activeBookmarkArticle = article
      ensureBookmarkOverlayTrigger()
      positionBookmarkOverlay()
      if (bookmarkOverlayHost) {
        setButtonVisibility(bookmarkOverlayHost, true)
      }
    }

    const hide = (relatedTarget?: EventTarget | null) => {
      if (!bookmarkOverlayHost) {
        return
      }

      if (isOverlayInteractionTarget(relatedTarget)) {
        return
      }

      if (bookmarkOverlayHovered || bookmarkOverlayHost.dataset.open === "true") {
        return
      }

      if (relatedTarget && typeof relatedTarget === "object" && "nodeType" in relatedTarget && article.contains(relatedTarget as Node)) {
        return
      }

      if (activeBookmarkArticle === article) {
        activeBookmarkArticle = null
      }
      setButtonVisibility(bookmarkOverlayHost, false)
    }

    article.addEventListener("mouseenter", show)
    article.addEventListener("focusin", show)
    article.addEventListener("mouseleave", (event) => hide(event.relatedTarget))
    article.addEventListener("focusout", (event) => hide(event.relatedTarget))
  }

  function ensureBookmarkOverlayTrigger() {
    if (bookmarkOverlayHost && bookmarkOverlayShadowRoot) {
      return
    }

    const host = document.createElement("span")
    host.dataset.siteTagOverlayHost = "true"
    host.dataset.open = "false"
    host.style.position = "fixed"
    host.style.left = "0px"
    host.style.top = "0px"
    host.style.width = `${BOOKMARK_OVERLAY_SIZE}px`
    host.style.height = `${BOOKMARK_OVERLAY_SIZE}px`
    host.style.display = "inline-flex"
    host.style.opacity = "0"
    host.style.pointerEvents = "none"
    host.style.transition = "opacity 120ms ease"
    host.style.zIndex = "2147483646"
    const logoUrl = resolveExtensionAssetUrl(TAG_BUTTON_LOGO_PATH)
    const shadowRoot = host.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = `
      <style>${BUTTON_STYLE}</style>
      <button type="button" class="folio-site-trigger" data-testid="site-tag-trigger" aria-label="Manage tags" data-logo-loaded="${logoUrl ? "true" : "false"}">
        ${logoUrl ? `<img data-testid="site-tag-trigger-logo" alt="" src="${escapeAttribute(logoUrl)}" />` : ""}
        <span class="logo-fallback" data-testid="site-tag-trigger-logo-fallback" aria-hidden="true"></span>
      </button>
    `

    host.addEventListener("mouseenter", () => {
      bookmarkOverlayHovered = true
      setButtonVisibility(host, true)
    })
    host.addEventListener("mouseleave", (event) => {
      bookmarkOverlayHovered = false
      if (host.dataset.open === "true") {
        return
      }

      if (activeBookmarkArticle && event.relatedTarget instanceof Node && activeBookmarkArticle.contains(event.relatedTarget)) {
        return
      }

      activeBookmarkArticle = null
      setButtonVisibility(host, false)
    })

    const trigger = shadowRoot.querySelector("button") as HTMLButtonElement
    const triggerLogo = shadowRoot.querySelector<HTMLImageElement>('[data-testid="site-tag-trigger-logo"]')
    triggerLogo?.addEventListener("error", () => {
      triggerLogo.hidden = true
      trigger.dataset.logoLoaded = "false"
    })
    trigger.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!activeBookmarkArticle) {
        return
      }

      const draft = extractDraft(activeBookmarkArticle)
      if (!draft) {
        return
      }

      activePopoverTweetId = draft.tweetId
      void popover.open({
        anchor: trigger,
        triggerHost: host,
        tweet: draft
      })
    })

    document.body.appendChild(host)
    bookmarkOverlayHost = host
    bookmarkOverlayShadowRoot = shadowRoot
  }

  function handleBookmarkViewportChange() {
    if (syncRouteMode() || !isBookmarksPath(currentPathname)) {
      return
    }

    if (!bookmarkOverlayHost || !activeBookmarkArticle) {
      return
    }

    positionBookmarkOverlay()
  }

  function positionBookmarkOverlay() {
    if (!bookmarkOverlayHost || !activeBookmarkArticle) {
      return
    }

    const rect = activeBookmarkArticle.getBoundingClientRect()
    const actionAnchorRect = resolveBookmarkOverlayAnchorRect(activeBookmarkArticle)
    const unclampedLeft = actionAnchorRect
      ? actionAnchorRect.left - BOOKMARK_OVERLAY_SIZE - BOOKMARK_OVERLAY_GAP
      : rect.right - BOOKMARK_OVERLAY_SIZE - BOOKMARK_OVERLAY_INSET
    const unclampedTop = actionAnchorRect
      ? actionAnchorRect.top + Math.max(0, (actionAnchorRect.height - BOOKMARK_OVERLAY_SIZE) / 2)
      : rect.top + BOOKMARK_OVERLAY_INSET
    const maxLeft = Math.max(12, window.innerWidth - BOOKMARK_OVERLAY_SIZE - 12)
    const maxTop = Math.max(12, window.innerHeight - BOOKMARK_OVERLAY_SIZE - 12)
    const left = Math.min(maxLeft, Math.max(12, unclampedLeft))
    const top = Math.min(maxTop, Math.max(12, unclampedTop))

    bookmarkOverlayHost.style.left = `${Math.round(left)}px`
    bookmarkOverlayHost.style.top = `${Math.round(top)}px`
  }

  function handleNativeBookmarkClick(event: Event) {
    syncRouteMode()
    const target = event.target as (Element & { closest?: typeof Element.prototype.closest }) | null
    if (!target?.closest) {
      return
    }

    const button = target.closest('button[data-testid="bookmark"], button[data-testid="removeBookmark"]') as HTMLButtonElement | null
    if (!button) {
      return
    }

    const article = button.closest("article")
    if (!article || pendingBookmarkArticles.has(article)) {
      return
    }

    pendingBookmarkArticles.add(article)
    const shouldEnable = button.dataset.testid === "bookmark"
    const initialDraft = extractDraft(article)
    const pathnameAtClick = currentPathname

    void waitForBookmarkConfirmation({
      article,
      document,
      options: bookmarkConfirmation,
      shouldEnable,
      tweetId: initialDraft?.tweetId,
      extractDraft
    }).then(async (confirmedArticle) => {
      pendingBookmarkArticles.delete(article)
      if (!confirmedArticle) {
        return
      }

      const draft = extractDraft(confirmedArticle) ?? initialDraft
      if (!draft) {
        return
      }

      await client.syncSiteTweetBookmark({
        tweet: draft,
        enabled: shouldEnable
      })

      if (!shouldEnable) {
        if (activePopoverTweetId === draft.tweetId) {
          popover.close()
        }
        return
      }

      if (pathnameAtClick !== currentPathname) {
        return
      }

      if (popoverIsOpen) {
        return
      }

      const activeBookmarkButton = resolveHomeBookmarkButton(confirmedArticle) ?? resolveHomeBookmarkButton(article) ?? button
      activePopoverTweetId = draft.tweetId
      void popover.open({
        anchor: activeBookmarkButton,
        triggerHost: null,
        tweet: draft
      })
    })
  }

  function removeBookmarkTriggerArtifacts() {
    activeBookmarkArticle = null
    bookmarkOverlayHovered = false
    bookmarkOverlayHost?.remove()
    bookmarkOverlayHost = null
    bookmarkOverlayShadowRoot = null
    document.querySelectorAll('[data-site-tag-button-host="true"]').forEach((host) => host.remove())
    document.querySelectorAll('[data-site-tag-overlay-host="true"]').forEach((host) => host.remove())
  }

  return {
    start,
    destroy
  }
}

function setButtonVisibility(host: HTMLElement, visible: boolean) {
  host.style.opacity = visible ? "1" : "0"
  host.style.pointerEvents = visible ? "auto" : "none"
}

function isOverlayInteractionTarget(target: EventTarget | null | undefined) {
  if (!target || typeof target !== "object" || !("nodeType" in target)) {
    return false
  }

  const node = target as Node
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement
  return Boolean(element?.closest('[data-site-tag-overlay-host="true"]'))
}

function resolveBookmarkOverlayAnchorRect(article: Element) {
  const actionRail = findHeaderActionRail(article)
  if (!actionRail) {
    return null
  }

  const primaryControl =
    findControlInRail(actionRail, ["grok"]) ??
    (actionRail.querySelector("button, a") as HTMLElement | null) ??
    actionRail

  const rect = primaryControl.getBoundingClientRect()
  return rect.width > 0 || rect.height > 0 ? rect : actionRail.getBoundingClientRect()
}

function resolveHomeBookmarkButton(article: Element) {
  return article.querySelector('button[data-testid="removeBookmark"], button[data-testid="bookmark"]') as HTMLElement | null
}

async function waitForBookmarkConfirmation({
  article,
  document,
  options,
  shouldEnable,
  tweetId,
  extractDraft
}: {
  article: Element
  document: Document
  options: BookmarkConfirmationOptions
  shouldEnable: boolean
  tweetId?: string
  extractDraft: (article: Element | null) => SiteTweetDraft | null
}) {
  for (let index = 0; index < options.attempts; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, options.delayMs))
    const currentArticle = resolveConfirmedArticle(article, document, tweetId, extractDraft)
    const isBookmarked = Boolean(currentArticle?.querySelector('button[data-testid="removeBookmark"]'))
    if (shouldEnable ? isBookmarked : !isBookmarked || !currentArticle?.isConnected) {
      return currentArticle ?? article
    }
  }

  return null
}

function resolveConfirmedArticle(
  article: Element,
  document: Document,
  tweetId: string | undefined,
  extractDraft: (article: Element | null) => SiteTweetDraft | null
) {
  if (article.isConnected) {
    return article
  }

  if (!tweetId) {
    return null
  }

  return (
    Array.from(document.querySelectorAll("article")).find((candidate) => extractDraft(candidate)?.tweetId === tweetId) ?? null
  )
}

function findHeaderActionRail(article: Element) {
  const userName = article.querySelector('[data-testid="User-Name"]')
  if (!userName) {
    return null
  }

  let current: Element | null = userName.parentElement
  while (current && current !== article) {
    const children = Array.from(current.children)
    for (const child of children) {
      if (child.contains(userName)) {
        continue
      }

      if (!isLikelyHeaderActionRail(child)) {
        continue
      }

      return child as HTMLElement
    }

    current = current.parentElement
  }

  return null
}

function isLikelyHeaderActionRail(element: Element) {
  const controls = Array.from(element.querySelectorAll("button, a"))
  if (controls.length === 0 || controls.length > 4) {
    return false
  }

  const ownMarkers = [element.getAttribute("data-testid"), element.getAttribute("aria-label"), element.textContent]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  if (ownMarkers.includes("show more") || ownMarkers.includes("显示更多")) {
    return false
  }

  const hasBodySelectors = element.querySelector('[data-testid="tweetText"], [data-testid="show-more-wrapper"], time')
  if (hasBodySelectors) {
    return false
  }

  const text = (element.textContent ?? "").trim()
  return text.length < 40
}

function findControlInRail(rail: Element, keywords: string[]) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase())

  return Array.from(rail.querySelectorAll("button, a")).find((element) => {
    const text = [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return normalizedKeywords.some((keyword) => text.includes(keyword))
  }) as HTMLElement | undefined
}

function resolveExtensionAssetUrl(assetPath: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL(assetPath)
    } catch {
      return null
    }
  }

  return assetPath
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
}

function isBookmarksPath(pathname: string) {
  return pathname.startsWith("/i/bookmarks")
}

function isHomePath(pathname: string) {
  return pathname === "/home" || pathname.startsWith("/home")
}
