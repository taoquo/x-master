import test from "node:test"
import assert from "node:assert/strict"
import {
  BOOKMARKS_BEARER_TOKEN,
  BOOKMARKS_FEATURES,
  BOOKMARKS_QUERY_ID,
  BOOKMARKS_USER_AGENT,
  buildBookmarkTimelineUrl,
  fetchBookmarksPage,
  requestBookmarksPage
} from "../../src/lib/x/client.ts"
import { normalizeSyncError } from "../../src/lib/x/syncErrors.ts"

test("buildBookmarkTimelineUrl includes cursor and caps the page size", () => {
  const url = new URL(buildBookmarkTimelineUrl("cursor-1", 200))

  assert.equal(url.origin, "https://x.com")
  assert.equal(url.pathname, `/i/api/graphql/${BOOKMARKS_QUERY_ID}/Bookmarks`)

  const variables = JSON.parse(url.searchParams.get("variables") ?? "{}")
  const features = JSON.parse(url.searchParams.get("features") ?? "{}")
  assert.equal(variables.cursor, "cursor-1")
  assert.equal(variables.count, 20)
  assert.deepEqual(features, BOOKMARKS_FEATURES)
})

test("fetchBookmarksPage derives csrf token from the cookie header when omitted", async () => {
  const result = await fetchBookmarksPage({
    cursor: null,
    requestContext: {
      cookieHeader: "auth_token=abc; ct0=token123"
    },
    requestBookmarksPageImpl: async ({ requestContext }) => {
      assert.equal(requestContext.csrfToken, "token123")

      return {
        data: {
          bookmark_timeline_v2: {
            timeline: {
              instructions: [
                {
                  type: "TimelineAddEntries",
                  entries: [
                    {
                      entryId: "tweet-123",
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              rest_id: "123",
                              legacy: {
                                full_text: "hello world",
                                created_at: "Wed Mar 15 00:00:00 +0000 2026",
                                favorite_count: 1,
                                retweet_count: 2,
                                reply_count: 3
                              },
                              core: {
                                user_results: {
                                  result: {
                                    legacy: {
                                      name: "Alice",
                                      screen_name: "alice"
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
      }
    }
  })

  assert.equal(result.bookmarks.length, 1)
  assert.equal(result.bookmarks[0].tweetId, "123")
})

test("requestBookmarksPage sends the expected X auth headers", async () => {
  let capturedUrl = ""
  let capturedInit: RequestInit | undefined

  const payload = await requestBookmarksPage({
    url: "https://x.com/i/api/graphql/test/Bookmarks?variables=%7B%7D",
    requestContext: {
      cookieHeader: "auth_token=abc; ct0=token123",
      csrfToken: "token123",
      fetchImpl: async (url, init) => {
        capturedUrl = String(url)
        capturedInit = init

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      }
    }
  })

  assert.deepEqual(payload, { ok: true })
  assert.equal(capturedUrl, "https://x.com/i/api/graphql/test/Bookmarks?variables=%7B%7D")
  assert.equal(capturedInit?.headers instanceof Headers, false)
  assert.deepEqual(capturedInit?.headers, {
    authorization: `Bearer ${BOOKMARKS_BEARER_TOKEN}`,
    cookie: "auth_token=abc; ct0=token123",
    "content-type": "application/json",
    "x-csrf-token": "token123",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "user-agent": BOOKMARKS_USER_AGENT
  })
})

test("requestBookmarksPage keeps X auth failures classifiable without exposing raw response text", async () => {
  await assert.rejects(
    () =>
      requestBookmarksPage({
        url: "https://x.com/i/api/graphql/test/Bookmarks?variables=%7B%7D",
        requestContext: {
          cookieHeader: "auth_token=abc; ct0=token123",
          csrfToken: "token123",
          fetchImpl: async () =>
            new Response("unauthorized response body", {
              status: 401
            })
        }
      }),
    (error) => {
      const normalized = normalizeSyncError(error)
      assert.equal(normalized.kind, "auth_expired")
      assert.doesNotMatch(normalized.summary, /unauthorized response body/)
      return true
    }
  )
})

test("requestBookmarksPage classifies forbidden X responses as auth expired", async () => {
  await assert.rejects(
    () =>
      requestBookmarksPage({
        url: "https://x.com/i/api/graphql/test/Bookmarks?variables=%7B%7D",
        requestContext: {
          cookieHeader: "auth_token=abc; ct0=token123",
          csrfToken: "token123",
          fetchImpl: async () => new Response("forbidden response body", { status: 403 })
        }
      }),
    (error) => {
      assert.equal(normalizeSyncError(error).kind, "auth_expired")
      return true
    }
  )
})

test("requestBookmarksPage classifies X rate limits", async () => {
  await assert.rejects(
    () =>
      requestBookmarksPage({
        url: "https://x.com/i/api/graphql/test/Bookmarks?variables=%7B%7D",
        requestContext: {
          cookieHeader: "auth_token=abc; ct0=token123",
          csrfToken: "token123",
          fetchImpl: async () => new Response("rate limited", { status: 429 })
        }
      }),
    (error) => {
      assert.equal(normalizeSyncError(error).kind, "rate_limited")
      return true
    }
  )
})

test("requestBookmarksPage classifies fetch network failures", async () => {
  await assert.rejects(
    () =>
      requestBookmarksPage({
        url: "https://x.com/i/api/graphql/test/Bookmarks?variables=%7B%7D",
        requestContext: {
          cookieHeader: "auth_token=abc; ct0=token123",
          csrfToken: "token123",
          fetchImpl: async () => {
            throw new TypeError("Failed to fetch")
          }
        }
      }),
    (error) => {
      assert.equal(normalizeSyncError(error).kind, "network_error")
      return true
    }
  )
})
