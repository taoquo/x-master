import { extractCsrfToken } from "./auth.ts"
import { parseBookmarkEntries } from "./parseBookmarks.ts"

export const BOOKMARKS_QUERY_ID = "-LGfdImKeQz0xS_jjUwzlA"
export const BOOKMARKS_BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
export const BOOKMARKS_FEATURES = {
  graphql_timeline_v2_bookmark_timeline: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_enhance_cards_enabled: false
}
export const BOOKMARKS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const DEFAULT_PAGE_SIZE = 20

export interface BookmarkRequestContext {
  cookieHeader: string
  csrfToken: string
  bearerToken?: string
  fetchImpl?: typeof fetch
}

export function buildBookmarkTimelineUrl(cursor?: string | null, count = DEFAULT_PAGE_SIZE) {
  const cappedCount = Math.min(Math.max(count, 1), DEFAULT_PAGE_SIZE)
  const variables = {
    count: cappedCount,
    cursor: cursor ?? undefined,
    includePromotedContent: false
  }

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(BOOKMARKS_FEATURES)
  })

  return `https://x.com/i/api/graphql/${BOOKMARKS_QUERY_ID}/Bookmarks?${params.toString()}`
}

export async function requestBookmarksPage({
  url,
  requestContext
}: {
  url: string
  requestContext: BookmarkRequestContext
}) {
  const { cookieHeader, csrfToken, bearerToken = BOOKMARKS_BEARER_TOKEN, fetchImpl = fetch } = requestContext

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      cookie: cookieHeader,
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "user-agent": BOOKMARKS_USER_AGENT
    },
    credentials: "include"
  })

  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 200)
    throw new Error(`X API error ${response.status}: ${responseText}`)
  }

  return response.json()
}

export async function fetchBookmarksPage({
  requestContext,
  cursor,
  count = DEFAULT_PAGE_SIZE,
  requestBookmarksPageImpl = requestBookmarksPage
}: {
  requestContext: Omit<BookmarkRequestContext, "csrfToken"> & { csrfToken?: string }
  cursor?: string | null
  count?: number
  requestBookmarksPageImpl?: typeof requestBookmarksPage
}) {
  const resolvedCsrfToken = requestContext.csrfToken ?? extractCsrfToken(requestContext.cookieHeader)
  const payload = await requestBookmarksPageImpl({
    url: buildBookmarkTimelineUrl(cursor, count),
    requestContext: {
      ...requestContext,
      csrfToken: resolvedCsrfToken
    }
  })

  return parseBookmarkEntries(payload)
}
