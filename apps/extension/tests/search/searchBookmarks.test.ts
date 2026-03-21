import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import {
  applyBookmarkFilters,
  bookmarkHasMedia,
  bookmarkIsLongform,
  filterBookmarks,
  filterBookmarksByAuthors,
  filterBookmarksByPublishedDate,
  filterBookmarksByFlags,
  filterBookmarksBySavedTime,
  filterBookmarksByTags,
  sortBookmarks
} from "../../src/lib/search/searchBookmarks.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { searchBookmarks } from "../../src/lib/search/searchBookmarks.ts"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"

test("searchBookmarks filters bookmarks by text and author handle", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "typescript note",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      rawPayload: {}
    }
  ])

  const results = await searchBookmarks("alice")

  assert.equal(results.length, 1)
  assert.equal(results[0].tweetId, "1")
})

test("filterBookmarksByTags filters an in-memory bookmark list by all selected tags", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      rawPayload: {}
    }
  ]

  const results = filterBookmarksByTags(
    filterBookmarks(bookmarks, ""),
    [
      { id: "1:tag-1", bookmarkId: "1", tagId: "tag-1", createdAt: "2026-03-16T00:00:00.000Z" },
      { id: "1:tag-2", bookmarkId: "1", tagId: "tag-2", createdAt: "2026-03-16T00:00:00.000Z" },
      { id: "2:tag-1", bookmarkId: "2", tagId: "tag-1", createdAt: "2026-03-16T00:00:00.000Z" }
    ],
    ["tag-1", "tag-2"]
  )

  assert.equal(results.length, 1)
  assert.equal(results[0].tweetId, "1")
})

test("filterBookmarksByAuthors supports match any and match all", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      rawPayload: {}
    }
  ]

  const anyResults = filterBookmarksByAuthors(bookmarks, ["alice", "bob"], "any")
  const allResults = filterBookmarksByAuthors(bookmarks, ["alice", "bob"], "all")

  assert.equal(anyResults.length, 2)
  assert.equal(allResults.length, 0)
})

test("filterBookmarksByTags supports match any", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      rawPayload: {}
    }
  ]

  const results = filterBookmarksByTags(
    bookmarks,
    [
      { id: "1:tag-1", bookmarkId: "1", tagId: "tag-1", createdAt: "2026-03-16T00:00:00.000Z" },
      { id: "2:tag-2", bookmarkId: "2", tagId: "tag-2", createdAt: "2026-03-16T00:00:00.000Z" }
    ],
    ["tag-1", "tag-2"],
    "any"
  )

  assert.equal(results.length, 2)
})

test("filterBookmarksBySavedTime filters by savedAt ranges", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-17T00:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-01-01T00:00:00.000Z",
      rawPayload: {}
    }
  ]

  const results = filterBookmarksBySavedTime(bookmarks, "7d", Date.parse("2026-03-18T00:00:00.000Z"))

  assert.equal(results.length, 1)
  assert.equal(results[0].tweetId, "1")
})

test("filterBookmarksByPublishedDate filters bookmarks to one exact publish day", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-17T00:00:00.000Z",
      savedAt: "2026-03-17T03:00:00.000Z",
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-18T00:00:00.000Z",
      savedAt: "2026-03-18T04:00:00.000Z",
      rawPayload: {}
    }
  ]

  const results = filterBookmarksByPublishedDate(bookmarks, "2026-03-18")

  assert.equal(results.length, 1)
  assert.equal(results[0].tweetId, "2")
})

test("filterBookmarksByFlags keeps only bookmarks matching media and longform filters", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "short note",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      media: [{ type: "photo", url: "https://example.com/1.jpg" }],
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "x".repeat(320),
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      media: [{ type: "photo", url: "https://example.com/2.jpg" }],
      rawPayload: {}
    }
  ]

  const results = filterBookmarksByFlags(bookmarks, {
    onlyWithMedia: true,
    onlyLongform: true
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].tweetId, "2")
  assert.equal(bookmarkHasMedia(results[0]), true)
  assert.equal(bookmarkIsLongform(results[0]), true)
})

test("sortBookmarks sorts by likes descending", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      metrics: { likes: 3, retweets: 1, replies: 0 },
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "world",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:02:00.000Z",
      metrics: { likes: 10, retweets: 2, replies: 1 },
      rawPayload: {}
    }
  ]

  const results = sortBookmarks(bookmarks, "likes-desc")

  assert.deepEqual(
    results.map((bookmark) => bookmark.tweetId),
    ["2", "1"]
  )
})

test("applyBookmarkFilters combines cross-group filters with AND and sorts the result", () => {
  const bookmarks = [
    {
      tweetId: "1",
      tweetUrl: "https://x.com/alice/status/1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "important note",
      createdAtOnX: "2026-03-12T00:00:00.000Z",
      savedAt: "2026-03-17T00:00:00.000Z",
      media: [{ type: "photo", url: "https://example.com/1.jpg" }],
      metrics: { likes: 3, retweets: 1, replies: 0 },
      rawPayload: {}
    },
    {
      tweetId: "2",
      tweetUrl: "https://x.com/bob/status/2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "important note",
      createdAtOnX: "2026-03-11T00:00:00.000Z",
      savedAt: "2026-03-16T00:00:00.000Z",
      media: [{ type: "photo", url: "https://example.com/2.jpg" }],
      metrics: { likes: 10, retweets: 2, replies: 1 },
      rawPayload: {}
    }
  ]

  const results = applyBookmarkFilters(bookmarks, {
    query: "important",
    bookmarkTags: [{ id: "1:tag-1", bookmarkId: "1", tagId: "tag-1", createdAt: "2026-03-16T00:00:00.000Z" }],
    selectedAuthorHandles: ["alice"],
    authorMatchMode: "any",
    selectedTagIds: ["tag-1"],
    tagMatchMode: "all",
    timeRange: "7d",
    onlyWithMedia: true,
    onlyLongform: false,
    sortOrder: "likes-desc",
    currentTime: Date.parse("2026-03-18T00:00:00.000Z")
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].tweetId, "1")
})

test("saveSettings persists settings and getSettings returns them", async () => {
  let storedValue: unknown

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async (value: Record<string, unknown>) => {
          storedValue = value.settings
        }
      }
    }
  }

  const settings = {
    schemaVersion: 1,
    hasCompletedOnboarding: true,
    lastSyncSummary: {
      status: "success" as const,
      fetchedCount: 5,
      insertedCount: 4,
      updatedCount: 1,
      failedCount: 0,
      lastSyncedAt: "2026-03-15T03:00:00.000Z"
    }
  }

  await saveSettings(settings)
  const saved = await getSettings()

  assert.deepEqual(saved, settings)
})
