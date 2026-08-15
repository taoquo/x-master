import test from "node:test"
import assert from "node:assert/strict"
import { computeAuthorTagAffinity, computeHeuristicSuggestions } from "../../src/lib/autotag/heuristics.ts"
import type { AutoTagSettings, BookmarkRecord, BookmarkTagRecord, TagRecord, TagSuggestionRecord } from "../../src/lib/types.ts"

function makeBookmark(overrides: Partial<BookmarkRecord> & { tweetId: string }): BookmarkRecord {
  return {
    tweetUrl: `https://x.com/user/status/${overrides.tweetId}`,
    authorName: "Author",
    authorHandle: "author",
    text: "",
    createdAtOnX: "2026-01-01T00:00:00.000Z",
    savedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

function makeTag(id: string, name: string): TagRecord {
  return { id, name, createdAt: "2026-01-01T00:00:00.000Z" }
}

function makeBookmarkTag(bookmarkId: string, tagId: string): BookmarkTagRecord {
  return { id: `${bookmarkId}:${tagId}`, bookmarkId, tagId, createdAt: "2026-01-01T00:00:00.000Z" }
}

function makeHeuristicSettings(
  overrides: Partial<AutoTagSettings["heuristics"]> = {}
): AutoTagSettings["heuristics"] {
  return {
    useHashtags: true,
    useAuthors: true,
    keywordRules: [],
    ...overrides
  }
}

test("hashtag rule suggests normalized hashtags for untagged bookmarks only", () => {
  const suggestions = computeHeuristicSuggestions({
    bookmarks: [
      makeBookmark({ tweetId: "t1", hashtags: ["AI", "#Rust"] }),
      makeBookmark({ tweetId: "t2", hashtags: ["Ignored"] })
    ],
    // Hashtags that already exist as real tags bypass the frequency threshold.
    tags: [makeTag("tag-1", "Existing"), makeTag("tag-2", "AI"), makeTag("tag-3", "Rust")],
    bookmarkTags: [makeBookmarkTag("t2", "tag-1")],
    suggestions: [],
    settings: makeHeuristicSettings({ useAuthors: false })
  })

  assert.deepEqual(
    suggestions.map((suggestion) => [suggestion.bookmarkId, suggestion.tagName, suggestion.source, suggestion.confidence]),
    [
      ["t1", "AI", "hashtag", 0.9],
      ["t1", "Rust", "hashtag", 0.9]
    ]
  )
})

test("hashtag rule ignores long-tail hashtags below the frequency threshold", () => {
  const rare = computeHeuristicSuggestions({
    bookmarks: [makeBookmark({ tweetId: "t1", hashtags: ["Design"] }), makeBookmark({ tweetId: "t2", hashtags: ["Design"] })],
    tags: [],
    bookmarkTags: [],
    suggestions: [],
    settings: makeHeuristicSettings({ useAuthors: false })
  })

  assert.deepEqual(rare, [])

  const frequent = computeHeuristicSuggestions({
    bookmarks: [
      makeBookmark({ tweetId: "t1", hashtags: ["Design"] }),
      makeBookmark({ tweetId: "t2", hashtags: ["design"] }),
      makeBookmark({ tweetId: "t3", hashtags: ["#Designs"] })
    ],
    tags: [],
    bookmarkTags: [],
    suggestions: [],
    settings: makeHeuristicSettings({ useAuthors: false })
  })

  assert.deepEqual(
    frequent.map((suggestion) => [suggestion.bookmarkId, suggestion.tagName]),
    [
      ["t1", "Design"],
      ["t2", "design"],
      ["t3", "Designs"]
    ]
  )
})

test("hashtag rule skips canonical keys the user deleted on purpose", () => {
  const suggestions = computeHeuristicSuggestions({
    bookmarks: [makeBookmark({ tweetId: "t1", hashtags: ["AI"] })],
    tags: [makeTag("tag-1", "AI")],
    bookmarkTags: [],
    suggestions: [],
    settings: makeHeuristicSettings({ useAuthors: false }),
    blockedTagKeys: ["ai"]
  })

  assert.deepEqual(suggestions, [])
})

test("existing suggestions act as a negative cache regardless of status", () => {
  const rejected: TagSuggestionRecord = {
    id: "t1::ai",
    bookmarkId: "t1",
    tagName: "AI",
    source: "hashtag",
    confidence: 0.9,
    status: "rejected",
    createdAt: "2026-01-01T00:00:00.000Z"
  }

  const suggestions = computeHeuristicSuggestions({
    bookmarks: [makeBookmark({ tweetId: "t1", hashtags: ["AI"] })],
    tags: [],
    bookmarkTags: [],
    suggestions: [rejected],
    settings: makeHeuristicSettings({ useAuthors: false })
  })

  assert.equal(suggestions.length, 0)
})

test("author rule requires >=3 tagged bookmarks and >=60% share", () => {
  const bookmarks = [
    makeBookmark({ tweetId: "t1", authorHandle: "alice" }),
    makeBookmark({ tweetId: "t2", authorHandle: "alice" }),
    makeBookmark({ tweetId: "t3", authorHandle: "alice" }),
    makeBookmark({ tweetId: "t4", authorHandle: "alice" }),
    makeBookmark({ tweetId: "t5", authorHandle: "bob" }),
    makeBookmark({ tweetId: "t6", authorHandle: "bob" })
  ]
  const tags = [makeTag("tag-ml", "ML"), makeTag("tag-misc", "Misc")]
  const bookmarkTags = [
    makeBookmarkTag("t1", "tag-ml"),
    makeBookmarkTag("t2", "tag-ml"),
    makeBookmarkTag("t3", "tag-misc"),
    makeBookmarkTag("t3", "tag-ml"),
    // bob has only 1 tagged bookmark: below the sample threshold.
    makeBookmarkTag("t5", "tag-ml")
  ]

  const suggestions = computeHeuristicSuggestions({
    bookmarks,
    tags,
    bookmarkTags,
    suggestions: [],
    settings: makeHeuristicSettings({ useHashtags: false })
  })

  // alice: 3 tagged bookmarks, ML share 3/3 -> suggest ML for untagged t4.
  // Misc share 1/3 -> below 60%. bob: sample too small -> nothing for t6.
  assert.deepEqual(
    suggestions.map((suggestion) => [suggestion.bookmarkId, suggestion.tagName, suggestion.source, suggestion.confidence]),
    [["t4", "ML", "author", 0.6]]
  )
})

test("keyword rule matches case-insensitive substrings", () => {
  const suggestions = computeHeuristicSuggestions({
    bookmarks: [
      makeBookmark({ tweetId: "t1", text: "Learning RUST the hard way" }),
      makeBookmark({ tweetId: "t2", text: "nothing relevant" })
    ],
    tags: [],
    bookmarkTags: [],
    suggestions: [],
    settings: makeHeuristicSettings({
      useHashtags: false,
      useAuthors: false,
      keywordRules: [
        { keyword: "rust", tagName: "Rust" },
        { keyword: "  ", tagName: "Empty" }
      ]
    })
  })

  assert.deepEqual(
    suggestions.map((suggestion) => [suggestion.bookmarkId, suggestion.tagName, suggestion.source, suggestion.confidence]),
    [["t1", "Rust", "keyword", 0.7]]
  )
})

test("rules deduplicate the same bookmark+tag pair within a single run", () => {
  const suggestions = computeHeuristicSuggestions({
    bookmarks: [makeBookmark({ tweetId: "t1", text: "all about ai", hashtags: ["AI"] })],
    tags: [makeTag("tag-ai", "AI")],
    bookmarkTags: [],
    suggestions: [],
    settings: makeHeuristicSettings({
      useAuthors: false,
      keywordRules: [{ keyword: "ai", tagName: "AI" }]
    })
  })

  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0]?.source, "hashtag")
})

test("computeAuthorTagAffinity reports per-author tag shares", () => {
  const affinities = computeAuthorTagAffinity({
    bookmarks: [
      makeBookmark({ tweetId: "t1", authorHandle: "alice" }),
      makeBookmark({ tweetId: "t2", authorHandle: "alice" })
    ],
    tags: [makeTag("tag-ml", "ML")],
    bookmarkTags: [makeBookmarkTag("t1", "tag-ml")]
  })

  assert.deepEqual(affinities, [
    {
      authorHandle: "alice",
      tagName: "ML",
      taggedBookmarkCount: 1,
      tagOccurrenceCount: 1,
      share: 1
    }
  ])
})
