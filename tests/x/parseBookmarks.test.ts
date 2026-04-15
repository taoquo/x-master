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

test("parseBookmarkEntries skips tweet entries without a rest_id", () => {
  const result = parseBookmarkEntries({
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                {
                  entryId: "tweet-missing-id",
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          legacy: {
                            full_text: "missing id should be ignored"
                          },
                          core: {
                            user_results: {
                              result: {
                                legacy: {
                                  name: "Ghost",
                                  screen_name: "ghost"
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
                  entryId: "tweet-789",
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          rest_id: "789",
                          legacy: {
                            full_text: "valid bookmark",
                            created_at: "Wed Mar 17 00:00:00 +0000 2026"
                          },
                          core: {
                            user_results: {
                              result: {
                                legacy: {
                                  name: "Carol",
                                  screen_name: "carol"
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
  })

  assert.equal(result.bookmarks.length, 1)
  assert.equal(result.bookmarks[0].tweetId, "789")
})

test("parseBookmarkEntries prefers playable mp4 variants for video media", () => {
  const result = parseBookmarkEntries({
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                {
                  entryId: "tweet-video-1",
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          rest_id: "video-1",
                          legacy: {
                            full_text: "video bookmark",
                            created_at: "Thu Mar 18 00:00:00 +0000 2026",
                            extended_entities: {
                              media: [
                                {
                                  type: "video",
                                  media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg",
                                  video_info: {
                                    variants: [
                                      {
                                        content_type: "application/x-mpegURL",
                                        url: "https://video.twimg.com/ext_tw_video/master.m3u8"
                                      },
                                      {
                                        bitrate: 832000,
                                        content_type: "video/mp4",
                                        url: "https://video.twimg.com/ext_tw_video/vid/640x360/video-360.mp4"
                                      },
                                      {
                                        bitrate: 2176000,
                                        content_type: "video/mp4",
                                        url: "https://video.twimg.com/ext_tw_video/vid/1280x720/video-720.mp4"
                                      }
                                    ]
                                  }
                                }
                              ]
                            }
                          },
                          core: {
                            user_results: {
                              result: {
                                legacy: {
                                  name: "Video User",
                                  screen_name: "video_user"
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
  })

  assert.equal(result.bookmarks.length, 1)
  assert.equal(result.bookmarks[0].media?.[0]?.type, "video")
  assert.equal(result.bookmarks[0].media?.[0]?.url, "https://video.twimg.com/ext_tw_video/vid/1280x720/video-720.mp4")
})
