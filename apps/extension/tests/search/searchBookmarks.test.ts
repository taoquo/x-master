import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import {
  applyBookmarkFilters,
  bookmarkHasMedia,
  bookmarkIsLongform,
  filterBookmarks,
  filterBookmarksByAuthors,
  filterBookmarksByList,
  filterBookmarksBySavedTime,
  filterBookmarksByTags,
  filterBookmarksByFlags,
  sortBookmarks
} from "../../src/lib/search/searchBookmarks.ts"
import { saveSettings } from "../../src/lib/storage/settings.ts"

const bookmarks = [
  {
    tweetId: "1",
    tweetUrl: "https://x.com/alice/status/1",
    authorName: "Alice",
    authorHandle: "alice",
    text: "Agent workflow with code snippets",
    createdAtOnX: "2026-03-10T00:00:00.000Z",
    savedAt: "2026-03-16T00:00:00.000Z",
    media: [{ type: "photo", url: "https://example.com/1.png" }],
    metrics: { likes: 5, retweets: 1, replies: 0 },
    rawPayload: {}
  },
  {
    tweetId: "2",
    tweetUrl: "https://x.com/bob/status/2",
    authorName: "Bob",
    authorHandle: "bob",
    text: "Short note",
    createdAtOnX: "2026-03-12T00:00:00.000Z",
    savedAt: "2026-03-14T00:00:00.000Z",
    metrics: { likes: 12, retweets: 4, replies: 1 },
    rawPayload: {}
  },
  {
    tweetId: "3",
    tweetUrl: "https://x.com/alice/status/3",
    authorName: "Alice",
    authorHandle: "alice",
    text: "L".repeat(320),
    createdAtOnX: "2026-03-13T00:00:00.000Z",
    savedAt: "2026-03-13T00:00:00.000Z",
    rawPayload: {}
  }
]

const bookmarkTags = [
  { id: "1:tag-ai", bookmarkId: "1", tagId: "tag-ai", createdAt: "2026-03-16T00:00:00.000Z" },
  { id: "3:tag-long", bookmarkId: "3", tagId: "tag-long", createdAt: "2026-03-16T00:00:00.000Z" }
]

const bookmarkLists = [
  { bookmarkId: "1", listId: "list-research", updatedAt: "2026-03-16T00:00:00.000Z" },
  { bookmarkId: "2", listId: "list-inbox", updatedAt: "2026-03-16T00:00:00.000Z" },
  { bookmarkId: "3", listId: "list-research", updatedAt: "2026-03-16T00:00:00.000Z" }
]

test("basic search matches bookmark text and author metadata", () => {
  const filtered = filterBookmarks(bookmarks, "agent")
  assert.deepEqual(filtered.map((bookmark) => bookmark.tweetId), ["1"])
})

test("list and tag filters narrow bookmarks to one management slice", () => {
  const byList = filterBookmarksByList(bookmarks, bookmarkLists, "list-research")
  const byTag = filterBookmarksByTags(byList, bookmarkTags, ["tag-long"], "all")

  assert.deepEqual(byList.map((bookmark) => bookmark.tweetId), ["1", "3"])
  assert.deepEqual(byTag.map((bookmark) => bookmark.tweetId), ["3"])
})

test("author, time, flags, and sort helpers stay scoped to bookmark-management behavior", () => {
  assert.deepEqual(filterBookmarksByAuthors(bookmarks, ["alice"], "any").map((bookmark) => bookmark.tweetId), ["1", "3"])
  assert.deepEqual(filterBookmarksBySavedTime(bookmarks, "7d", Date.parse("2026-03-16T12:00:00.000Z")).map((bookmark) => bookmark.tweetId), ["1", "2", "3"])
  assert.equal(bookmarkHasMedia(bookmarks[0]), true)
  assert.equal(bookmarkIsLongform(bookmarks[2]), true)
  assert.deepEqual(filterBookmarksByFlags(bookmarks, { onlyWithMedia: true, onlyLongform: false }).map((bookmark) => bookmark.tweetId), ["1"])
  assert.deepEqual(sortBookmarks(bookmarks, "likes-desc").map((bookmark) => bookmark.tweetId), ["2", "1", "3"])
})

test("applyBookmarkFilters combines list, author, tag, and flag filters with sorting", () => {
  const filtered = applyBookmarkFilters(bookmarks, {
    query: "",
    bookmarkLists,
    selectedListId: "list-research",
    bookmarkTags,
    selectedAuthorHandles: ["alice"],
    authorMatchMode: "any",
    selectedTagIds: ["tag-ai"],
    tagMatchMode: "all",
    timeRange: "all",
    onlyWithMedia: true,
    onlyLongform: false,
    sortOrder: "saved-desc"
  })

  assert.deepEqual(filtered.map((bookmark) => bookmark.tweetId), ["1"])
})

test("settings writes used by search-related UI still compile against reduced settings", async () => {
  let storedValue: unknown

  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async (value: Record<string, unknown>) => {
          storedValue = value.settings
        }
      }
    }
  }

  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "system",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 5,
      insertedCount: 4,
      updatedCount: 1,
      failedCount: 0,
      lastSyncedAt: "2026-03-16T00:00:00.000Z"
    },
    classificationRules: []
  })

  assert.ok(storedValue)
})
