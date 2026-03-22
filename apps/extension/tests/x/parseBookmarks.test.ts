import test from "node:test"
import assert from "node:assert/strict"
import { parseBookmarkEntries } from "../../src/lib/x/parseBookmarks.ts"

const response = {
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
                          created_at: "Mon Mar 15 00:00:00 +0000 2026",
                          favorite_count: 10,
                          retweet_count: 2,
                          reply_count: 1
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
              },
              {
                entryId: "tweet-456",
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: "456",
                        legacy: {
                          full_text: "legacy teaser",
                          created_at: "Tue Mar 16 00:00:00 +0000 2026",
                          favorite_count: 5,
                          retweet_count: 1,
                          reply_count: 0
                        },
                        note_tweet: {
                          note_tweet_results: {
                            result: {
                              text: "full note tweet body"
                            }
                          }
                        },
                        core: {
                          user_results: {
                            result: {
                              legacy: {
                                name: "Bob",
                                screen_name: "bob"
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              {
                entryId: "cursor-bottom-1",
                content: {
                  value: "next-cursor"
                }
              }
            ]
          }
        ]
      }
    }
  }
}

test("parseBookmarkEntries extracts normalized bookmark records", () => {
  const result = parseBookmarkEntries(response)

  assert.equal(result.bookmarks.length, 2)
  assert.equal(result.bookmarks[0].tweetId, "123")
  assert.equal(result.bookmarks[0].authorHandle, "alice")
  assert.equal(result.bookmarks[0].text, "hello world")
  assert.equal(result.bookmarks[0].sourceKind, "x-bookmark")
  assert.equal(result.bookmarks[1].tweetId, "456")
  assert.equal(result.bookmarks[1].text, "full note tweet body")
  assert.equal(result.bookmarks[1].sourceKind, "x-note-tweet")
  assert.equal(result.nextCursor, "next-cursor")
})
