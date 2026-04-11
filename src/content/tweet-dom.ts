import type { SiteTweetDraft } from "../lib/types.ts"

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? ""
}

function toAbsoluteUrl(href: string) {
  return new URL(href, "https://x.com").toString()
}

function findStatusAnchor(article: Element) {
  return article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null
}

function extractTweetIdFromUrl(url: string) {
  const match = url.match(/\/status\/(\d+)/)
  return match?.[1] ?? null
}

function extractAuthorHandleFromUrl(url: string) {
  const match = url.match(/^\/([^/]+)(?:\/|$)/)
  return match?.[1] ?? null
}

function extractAuthorName(article: Element) {
  const userNameRoot = article.querySelector('[data-testid="User-Name"]')
  if (!userNameRoot) {
    return ""
  }

  const labelCandidate = Array.from(userNameRoot.querySelectorAll("span"))
    .map((node) => normalizeText(node.textContent))
    .find((text) => text && !text.startsWith("@"))

  return labelCandidate ?? ""
}

function extractTweetText(article: Element) {
  const textNode = article.querySelector('[data-testid="tweetText"]')
  return normalizeText(textNode?.textContent)
}

export function extractSiteTweetDraft(article: Element | null): SiteTweetDraft | null {
  if (!article) {
    return null
  }

  const statusAnchor = findStatusAnchor(article)
  const timeElement = article.querySelector("time[datetime]")
  const createdAtOnX = timeElement?.getAttribute("datetime") ?? ""

  if (!statusAnchor || !createdAtOnX) {
    return null
  }

  const tweetUrl = toAbsoluteUrl(statusAnchor.getAttribute("href") ?? "")
  const tweetId = extractTweetIdFromUrl(tweetUrl)
  const authorHandle = extractAuthorHandleFromUrl(statusAnchor.getAttribute("href") ?? "")
  const authorName = extractAuthorName(article)
  const text = extractTweetText(article)

  if (!tweetId || !authorHandle || !authorName || !text || !createdAtOnX) {
    return null
  }

  return {
    tweetId,
    tweetUrl,
    authorName,
    authorHandle,
    text,
    createdAtOnX
  }
}
