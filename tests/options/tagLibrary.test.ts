import test from "node:test"
import assert from "node:assert/strict"
import type { BookmarkTagRecord, TagRecord, TagSuggestionRecord } from "../../src/lib/types.ts"
import {
  buildTagLibraryItems,
  countOrphanTags,
  filterSidebarTags,
  getVisibleTagLibraryItems
} from "../../src/options/tagLibrary.ts"

function tag(id: string, name: string, overrides: Partial<TagRecord> = {}): TagRecord {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

function relation(bookmarkId: string, tagId: string): BookmarkTagRecord {
  return {
    id: `${bookmarkId}:${tagId}`,
    bookmarkId,
    tagId,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
}

function suggestion(
  id: string,
  tagName: string,
  status: TagSuggestionRecord["status"] = "pending"
): TagSuggestionRecord {
  return {
    id,
    bookmarkId: `bookmark-${id}`,
    tagName,
    source: "llm",
    confidence: 0.8,
    status,
    createdAt: "2026-01-02T00:00:00.000Z"
  }
}

test("buildTagLibraryItems returns an empty list for empty input", () => {
  assert.deepEqual(buildTagLibraryItems({ tags: [], bookmarkTags: [], tagSuggestions: [] }), [])
})

test("buildTagLibraryItems counts bookmarks, pending suggestions and keeps the input order", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai", { aliases: ["machine learning"], updatedAt: "2026-02-01T00:00:00.000Z" }),
      tag("tag-design", "design"),
      tag("tag-orphan", "orphan")
    ],
    bookmarkTags: [
      relation("bookmark-1", "tag-ai"),
      relation("bookmark-2", "tag-ai"),
      relation("bookmark-1", "tag-design")
    ],
    tagSuggestions: [
      suggestion("s1", "AI"),
      suggestion("s2", " #ai "),
      suggestion("s3", "design", "accepted"),
      suggestion("s4", ""),
      suggestion("s5", "Designs")
    ]
  })

  assert.deepEqual(
    items.map((item) => item.tagId),
    ["tag-ai", "tag-design", "tag-orphan"]
  )
  assert.equal(items[0].bookmarkCount, 2)
  assert.equal(items[0].pendingSuggestionCount, 2)
  assert.deepEqual(items[0].aliases, ["machine learning"])
  assert.equal(items[0].updatedAt, "2026-02-01T00:00:00.000Z")
  assert.equal(items[1].bookmarkCount, 1)
  assert.equal(items[1].pendingSuggestionCount, 1)
  assert.equal(items[2].bookmarkCount, 0)
  assert.equal(items[2].updatedAt, "2026-01-01T00:00:00.000Z")
  assert.equal(countOrphanTags(items), 1)
})

test("getVisibleTagLibraryItems searches names and aliases", () => {
  const items = buildTagLibraryItems({
    tags: [tag("tag-ai", "ai", { aliases: ["machine learning"] }), tag("tag-design", "design")],
    bookmarkTags: [],
    tagSuggestions: []
  })

  const byAlias = getVisibleTagLibraryItems({
    items,
    searchQuery: "machine",
    filter: "all",
    sortOrder: "name-asc"
  })
  assert.deepEqual(byAlias.map((item) => item.tagId), ["tag-ai"])

  const byName = getVisibleTagLibraryItems({
    items,
    searchQuery: "DESI",
    filter: "all",
    sortOrder: "name-asc"
  })
  assert.deepEqual(byName.map((item) => item.tagId), ["tag-design"])

  const noMatch = getVisibleTagLibraryItems({
    items,
    searchQuery: "nothing",
    filter: "all",
    sortOrder: "name-asc"
  })
  assert.equal(noMatch.length, 0)
})

test("getVisibleTagLibraryItems applies the orphan and pending filters", () => {
  const items = buildTagLibraryItems({
    tags: [tag("tag-ai", "ai"), tag("tag-design", "design"), tag("tag-orphan", "orphan")],
    bookmarkTags: [relation("bookmark-1", "tag-ai"), relation("bookmark-1", "tag-design")],
    tagSuggestions: [suggestion("s1", "orphan")]
  })

  assert.deepEqual(
    getVisibleTagLibraryItems({ items, searchQuery: "", filter: "orphan", sortOrder: "name-asc" }).map(
      (item) => item.tagId
    ),
    ["tag-orphan"]
  )
  assert.deepEqual(
    getVisibleTagLibraryItems({ items, searchQuery: "", filter: "pending", sortOrder: "name-asc" }).map(
      (item) => item.tagId
    ),
    ["tag-orphan"]
  )
  assert.equal(
    getVisibleTagLibraryItems({ items, searchQuery: "", filter: "all", sortOrder: "name-asc" }).length,
    3
  )
})

test("getVisibleTagLibraryItems supports all four sort orders", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-b", "beta", { updatedAt: "2026-03-01T00:00:00.000Z" }),
      tag("tag-a", "alpha", { updatedAt: "2026-05-01T00:00:00.000Z" }),
      tag("tag-c", "gamma", { updatedAt: "2026-04-01T00:00:00.000Z" })
    ],
    bookmarkTags: [
      relation("bookmark-1", "tag-b"),
      relation("bookmark-2", "tag-b"),
      relation("bookmark-1", "tag-c")
    ],
    tagSuggestions: []
  })

  const ids = (sortOrder: Parameters<typeof getVisibleTagLibraryItems>[0]["sortOrder"]) =>
    getVisibleTagLibraryItems({ items, searchQuery: "", filter: "all", sortOrder }).map((item) => item.tagId)

  assert.deepEqual(ids("count-desc"), ["tag-b", "tag-c", "tag-a"])
  assert.deepEqual(ids("count-asc"), ["tag-a", "tag-c", "tag-b"])
  assert.deepEqual(ids("name-asc"), ["tag-a", "tag-b", "tag-c"])
  assert.deepEqual(ids("recent"), ["tag-a", "tag-c", "tag-b"])
})

test("filterSidebarTags keeps every tag for an empty query and matches aliases", () => {
  const tags = [tag("tag-ai", "ai", { aliases: ["machine learning"] }), tag("tag-design", "design")]

  assert.equal(filterSidebarTags(tags, "  ").length, 2)
  assert.deepEqual(filterSidebarTags(tags, "learning").map((item) => item.id), ["tag-ai"])
  assert.deepEqual(filterSidebarTags(tags, "design").map((item) => item.id), ["tag-design"])
  assert.equal(filterSidebarTags(tags, "zzz").length, 0)
})
