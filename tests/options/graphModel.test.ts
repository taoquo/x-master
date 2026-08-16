import test from "node:test"
import assert from "node:assert/strict"
import {
  buildGraphViewModel,
  getGraphNeighbourTagIds,
  type GraphScope
} from "../../src/options/graph/graphModel.ts"
import type { BookmarkRecord, BookmarkTagRecord, TagRecord } from "../../src/lib/types.ts"

const createdAt = "2026-03-15T00:00:00.000Z"

function tag(id: string, name: string, extra: Partial<TagRecord> = {}): TagRecord {
  return { id, name, createdAt, ...extra }
}

function relation(bookmarkId: string, tagId: string): BookmarkTagRecord {
  return { id: `${bookmarkId}:${tagId}`, bookmarkId, tagId, createdAt }
}

function bookmark(id: string, authorHandle: string): BookmarkRecord {
  return {
    id,
    tweetId: id,
    tweetUrl: `https://x.com/${authorHandle}/status/${id}`,
    authorName: authorHandle,
    authorHandle,
    text: "post",
    createdAtOnX: createdAt,
    savedAt: createdAt
  }
}

function scope(overrides: Partial<GraphScope> = {}): GraphScope {
  return { activeTagIds: ["all"], activeAuthorHandles: [], searchQuery: "", ...overrides }
}

test("buildGraphViewModel returns an empty model without tags", () => {
  const model = buildGraphViewModel({ tags: [], bookmarkTags: [] })

  assert.deepEqual(model, {
    nodes: [],
    edges: [],
    totalTagCount: 0,
    hiddenTagCount: 0,
    droppedEdgeCount: 0
  })
})

test("buildGraphViewModel places nodes inside the unit box and sizes them by count", () => {
  const model = buildGraphViewModel({
    tags: [tag("tag-a", "A"), tag("tag-b", "B")],
    bookmarkTags: [relation("tweet-1", "tag-a"), relation("tweet-2", "tag-a"), relation("tweet-1", "tag-b")]
  })

  for (const node of model.nodes) {
    assert.ok(node.x >= 0 && node.x <= 1, `x out of range: ${node.x}`)
    assert.ok(node.y >= 0 && node.y <= 1, `y out of range: ${node.y}`)
    assert.ok(node.radius > 0)
  }

  const [first, second] = model.nodes
  assert.equal(first.name, "A")
  assert.ok(first.radius > second.radius)
})

test("buildGraphViewModel puts child tags further from the centre than their theme", () => {
  const model = buildGraphViewModel({
    tags: [tag("tag-theme", "Theme"), tag("tag-child", "Child", { parentId: "tag-theme" })],
    bookmarkTags: []
  })

  const theme = model.nodes.find((node) => node.tagId === "tag-theme")
  const child = model.nodes.find((node) => node.tagId === "tag-child")
  assert.ok(theme && child)
  const themeDistance = Math.hypot(theme.x - 0.5, theme.y - 0.5)
  const childDistance = Math.hypot(child.x - 0.5, child.y - 0.5)
  assert.ok(childDistance > themeDistance)
  assert.equal(child.clusterId, "tag-theme")
})

test("buildGraphViewModel scopes cooccurrence to the active authors", () => {
  const tags = [tag("tag-a", "A"), tag("tag-b", "B")]
  const bookmarkTags = [
    relation("tweet-alice", "tag-a"),
    relation("tweet-alice", "tag-b"),
    relation("tweet-bob", "tag-a"),
    relation("tweet-bob", "tag-b")
  ]
  const bookmarks = [bookmark("tweet-alice", "alice"), bookmark("tweet-bob", "bob")]

  const unscoped = buildGraphViewModel({ tags, bookmarkTags, bookmarks })
  assert.equal(unscoped.edges[0].rawCount, 2)

  const scoped = buildGraphViewModel({
    tags,
    bookmarkTags,
    bookmarks,
    scope: scope({ activeAuthorHandles: ["@Alice"] })
  })
  assert.equal(scoped.edges.length, 1)
  assert.equal(scoped.edges[0].rawCount, 1)
})

test("buildGraphViewModel keeps the neighbours of a focused tag", () => {
  const model = buildGraphViewModel({
    tags: [tag("tag-a", "A"), tag("tag-b", "B"), tag("tag-c", "C")],
    bookmarkTags: [
      relation("tweet-1", "tag-a"),
      relation("tweet-1", "tag-b"),
      relation("tweet-2", "tag-c")
    ],
    scope: scope({ activeTagIds: ["tag-a"] })
  })

  assert.deepEqual(
    model.nodes.map((node) => node.tagId).sort(),
    ["tag-a", "tag-b"]
  )
  assert.equal(model.hiddenTagCount, 1)
})

test("buildGraphViewModel filters by search query across aliases", () => {
  const model = buildGraphViewModel({
    tags: [tag("tag-a", "Agents", { aliases: ["autonomous"] }), tag("tag-b", "Design")],
    bookmarkTags: [],
    scope: scope({ searchQuery: "AUTONOM" })
  })

  assert.deepEqual(
    model.nodes.map((node) => node.tagId),
    ["tag-a"]
  )
  assert.equal(model.totalTagCount, 2)
  assert.equal(model.hiddenTagCount, 1)
})

test("buildGraphViewModel caps nodes at the limit and drops their edges", () => {
  const tags = [tag("tag-a", "A"), tag("tag-b", "B"), tag("tag-c", "C")]
  const bookmarkTags = [
    relation("tweet-1", "tag-a"),
    relation("tweet-1", "tag-b"),
    relation("tweet-2", "tag-a"),
    relation("tweet-3", "tag-b"),
    relation("tweet-4", "tag-c")
  ]

  const model = buildGraphViewModel({ tags, bookmarkTags, nodeLimit: 2 })

  assert.equal(model.nodes.length, 2)
  assert.equal(model.hiddenTagCount, 1)
  for (const edge of model.edges) {
    assert.ok(edge.sourceTagId !== "tag-c" && edge.targetTagId !== "tag-c")
  }
})

test("getGraphNeighbourTagIds collects both edge directions", () => {
  const neighbours = getGraphNeighbourTagIds(
    [
      { sourceTagId: "tag-a", targetTagId: "tag-b", type: "cooccurrence", weight: 1, rawCount: 1 },
      { sourceTagId: "tag-c", targetTagId: "tag-a", type: "hierarchy", weight: 1, rawCount: 1 },
      { sourceTagId: "tag-d", targetTagId: "tag-e", type: "cooccurrence", weight: 1, rawCount: 1 }
    ],
    "tag-a"
  )

  assert.deepEqual([...neighbours].sort(), ["tag-b", "tag-c"])
})
