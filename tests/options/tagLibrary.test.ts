import test from "node:test"
import assert from "node:assert/strict"
import type { BookmarkTagRecord, TagRecord, TagSuggestionRecord } from "../../src/lib/types.ts"
import {
  buildTagLibraryItems,
  countLongTailTags,
  countOrphanTags,
  countUnparentedTags,
  filterSidebarTags,
  getRemovableOrphanTagIds,
  getRootTagCandidates,
  getVisibleSidebarTags,
  hasParentCandidates,
  getParentCandidates,
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

test("long-tail filter surfaces the tags used by one or two bookmarks", () => {
  const items = buildTagLibraryItems({
    tags: [tag("tag-ai", "ai"), tag("tag-thin", "thin"), tag("tag-orphan", "orphan"), tag("tag-child", "child", { parentId: "tag-ai" })],
    bookmarkTags: [
      relation("bookmark-1", "tag-ai"),
      relation("bookmark-2", "tag-ai"),
      relation("bookmark-3", "tag-ai"),
      relation("bookmark-1", "tag-thin"),
      relation("bookmark-2", "tag-child")
    ],
    tagSuggestions: []
  })

  // "orphan" has no bookmarks at all, "ai" is a theme with three bookmarks and
  // one child, so only "thin" and the child tag are long tail.
  assert.equal(countLongTailTags(items), 2)
  assert.deepEqual(
    getVisibleTagLibraryItems({ items, searchQuery: "", filter: "long-tail", sortOrder: "name-asc" }).map(
      (item) => item.tagId
    ),
    ["tag-child", "tag-thin"]
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

test("buildTagLibraryItems resolves parent names and child counts", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai"),
      tag("tag-agents", "agents", { parentId: "tag-ai" }),
      tag("tag-rag", "rag", { parentId: "tag-ai" }),
      tag("tag-design", "design")
    ],
    bookmarkTags: [],
    tagSuggestions: []
  })

  const byId = new Map(items.map((item) => [item.tagId, item]))

  assert.equal(byId.get("tag-ai")?.childCount, 2)
  assert.equal(byId.get("tag-ai")?.parentId, undefined)
  assert.equal(byId.get("tag-agents")?.parentId, "tag-ai")
  assert.equal(byId.get("tag-agents")?.parentName, "ai")
  assert.equal(byId.get("tag-agents")?.childCount, 0)
  assert.equal(byId.get("tag-design")?.childCount, 0)
})

test("buildTagLibraryItems treats a parentId pointing at a deleted tag as unparented", () => {
  const items = buildTagLibraryItems({
    tags: [tag("tag-agents", "agents", { parentId: "tag-removed" })],
    bookmarkTags: [],
    tagSuggestions: []
  })

  assert.equal(items[0].parentId, undefined)
  assert.equal(items[0].parentName, undefined)
  assert.equal(items[0].childCount, 0)
  assert.equal(countUnparentedTags(items), 1)
})

test("countUnparentedTags skips themes and children", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai"),
      tag("tag-agents", "agents", { parentId: "tag-ai" }),
      tag("tag-design", "design")
    ],
    bookmarkTags: [],
    tagSuggestions: []
  })

  assert.equal(countUnparentedTags(items), 1)
})

test("getParentCandidates only offers root tags and never a tag that already has children", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai"),
      tag("tag-agents", "agents", { parentId: "tag-ai" }),
      tag("tag-design", "design"),
      tag("tag-build", "build")
    ],
    bookmarkTags: [],
    tagSuggestions: []
  })

  assert.deepEqual(getParentCandidates(items, "tag-ai"), [])
  assert.deepEqual(getParentCandidates(items, "tag-unknown"), [])
  assert.deepEqual(
    getParentCandidates(items, "tag-design").map((item) => item.tagId),
    ["tag-ai", "tag-build"]
  )
  assert.deepEqual(
    getParentCandidates(items, "tag-agents").map((item) => item.tagId),
    ["tag-ai", "tag-build", "tag-design"]
  )
})

test("getVisibleTagLibraryItems supports the unparented filter and parent name search", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai"),
      tag("tag-agents", "agents", { parentId: "tag-ai" }),
      tag("tag-design", "design")
    ],
    bookmarkTags: [],
    tagSuggestions: []
  })

  assert.deepEqual(
    getVisibleTagLibraryItems({ items, searchQuery: "", filter: "unparented", sortOrder: "name-asc" }).map(
      (item) => item.tagId
    ),
    ["tag-design"]
  )
  assert.deepEqual(
    getVisibleTagLibraryItems({ items, searchQuery: "ai", filter: "all", sortOrder: "name-asc" }).map(
      (item) => item.tagId
    ),
    ["tag-agents", "tag-ai"]
  )
})

test("getRootTagCandidates and hasParentCandidates agree with getParentCandidates", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai"),
      tag("tag-agents", "agents", { parentId: "tag-ai" }),
      tag("tag-design", "design"),
      tag("tag-build", "build")
    ],
    bookmarkTags: [],
    tagSuggestions: []
  })
  const rootCandidates = getRootTagCandidates(items)

  assert.deepEqual(
    rootCandidates.map((item) => item.tagId),
    ["tag-ai", "tag-build", "tag-design"]
  )

  for (const item of items) {
    assert.equal(
      hasParentCandidates(rootCandidates, item),
      getParentCandidates(items, item.tagId).length > 0,
      item.tagId
    )
  }
})

test("hasParentCandidates is false when a lone root tag has nothing to nest under", () => {
  const items = buildTagLibraryItems({
    tags: [tag("tag-ai", "ai")],
    bookmarkTags: [],
    tagSuggestions: []
  })

  assert.equal(hasParentCandidates(getRootTagCandidates(items), items[0]), false)
})

test("getRemovableOrphanTagIds skips tags with bookmarks or children", () => {
  const items = buildTagLibraryItems({
    tags: [
      tag("tag-ai", "ai"),
      tag("tag-agents", "agents", { parentId: "tag-ai" }),
      tag("tag-design", "design"),
      tag("tag-empty", "empty")
    ],
    bookmarkTags: [relation("tweet-1", "tag-design")],
    tagSuggestions: []
  })

  assert.deepEqual(getRemovableOrphanTagIds(items), ["tag-agents", "tag-empty"])
})

test("getVisibleSidebarTags caps the collapsed list and expands on search", () => {
  const tags = [tag("tag-a", "alpha"), tag("tag-b", "beta"), tag("tag-c", "gamma")]

  const collapsed = getVisibleSidebarTags({
    tags,
    searchQuery: "",
    expanded: false,
    defaultVisibleCount: 2
  })
  assert.deepEqual(
    collapsed.items.map((item) => item.id),
    ["tag-a", "tag-b"]
  )
  assert.equal(collapsed.shouldShowToggle, true)

  const expanded = getVisibleSidebarTags({
    tags,
    searchQuery: "",
    expanded: true,
    defaultVisibleCount: 2
  })
  assert.equal(expanded.items.length, 3)
  assert.equal(expanded.shouldShowToggle, false)

  const searched = getVisibleSidebarTags({
    tags,
    searchQuery: "gam",
    expanded: false,
    defaultVisibleCount: 2
  })
  assert.deepEqual(
    searched.items.map((item) => item.id),
    ["tag-c"]
  )
  assert.equal(searched.shouldShowToggle, false)
})
