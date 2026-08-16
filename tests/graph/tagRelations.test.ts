import test from "node:test"
import assert from "node:assert/strict"
import { buildTagRelationGraph } from "../../src/lib/graph/tagRelations.ts"
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

test("buildTagRelationGraph returns an empty graph for empty inputs", () => {
  const graph = buildTagRelationGraph({ tags: [], bookmarkTags: [] })

  assert.deepEqual(graph, { nodes: [], edges: [], droppedEdgeCount: 0 })
})

test("buildTagRelationGraph normalizes cooccurrence weight with jaccard", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-a", "A"), tag("tag-b", "B")],
    bookmarkTags: [
      relation("tweet-1", "tag-a"),
      relation("tweet-1", "tag-b"),
      relation("tweet-2", "tag-a"),
      relation("tweet-3", "tag-a")
    ]
  })

  assert.equal(graph.edges.length, 1)
  const [edge] = graph.edges
  assert.equal(edge.type, "cooccurrence")
  assert.equal(edge.rawCount, 1)
  // 1 shared bookmark over a union of 3 -> 0.333
  assert.equal(edge.weight, 0.333)
  assert.equal(edge.sourceTagId, "tag-a")
  assert.equal(edge.targetTagId, "tag-b")
})

test("buildTagRelationGraph dedupes unordered pairs and ignores unknown tags", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-a", "A"), tag("tag-b", "B")],
    bookmarkTags: [
      relation("tweet-1", "tag-b"),
      relation("tweet-1", "tag-a"),
      relation("tweet-2", "tag-a"),
      relation("tweet-2", "tag-b"),
      relation("tweet-2", "tag-ghost")
    ]
  })

  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].rawCount, 2)
  assert.equal(graph.edges[0].weight, 1)
  assert.deepEqual(
    graph.nodes.map((node) => node.bookmarkCount),
    [2, 2]
  )
})

test("buildTagRelationGraph emits hierarchy edges and depth from parentId", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-theme", "Theme"), tag("tag-child", "Child", { parentId: "tag-theme" })],
    bookmarkTags: []
  })

  assert.deepEqual(graph.edges, [
    { sourceTagId: "tag-theme", targetTagId: "tag-child", type: "hierarchy", weight: 1, rawCount: 1 }
  ])
  assert.deepEqual(
    graph.nodes.map((node) => [node.name, node.depth, node.clusterId]),
    [
      ["Theme", 0, "tag-theme"],
      ["Child", 1, "tag-theme"]
    ]
  )
})

test("buildTagRelationGraph treats a dangling parentId as a root node", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-child", "Child", { parentId: "tag-removed" })],
    bookmarkTags: []
  })

  assert.equal(graph.edges.length, 0)
  assert.equal(graph.nodes[0].parentId, undefined)
  assert.equal(graph.nodes[0].depth, 0)
  assert.equal(graph.nodes[0].clusterId, "tag-child")
})

test("buildTagRelationGraph builds author bridges only for tags that never share a bookmark", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-a", "A"), tag("tag-b", "B")],
    bookmarkTags: [
      relation("tweet-1", "tag-a"),
      relation("tweet-2", "tag-b"),
      relation("tweet-3", "tag-a"),
      relation("tweet-4", "tag-b")
    ],
    bookmarks: [
      bookmark("tweet-1", "alice"),
      bookmark("tweet-2", "alice"),
      bookmark("tweet-3", "bob"),
      bookmark("tweet-4", "bob")
    ]
  })

  assert.equal(graph.edges.length, 1)
  const [edge] = graph.edges
  assert.equal(edge.type, "author-bridge")
  assert.equal(edge.rawCount, 2)
  assert.equal(edge.weight, 1)
  assert.deepEqual(
    graph.nodes.map((node) => node.authorCount),
    [2, 2]
  )
})

test("buildTagRelationGraph drops author bridges below the shared author threshold", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-a", "A"), tag("tag-b", "B")],
    bookmarkTags: [relation("tweet-1", "tag-a"), relation("tweet-2", "tag-b")],
    bookmarks: [bookmark("tweet-1", "alice"), bookmark("tweet-2", "alice")]
  })

  assert.equal(graph.edges.length, 0)
  assert.equal(graph.droppedEdgeCount, 1)
})

test("buildTagRelationGraph ranks top authors per tag", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-a", "A")],
    bookmarkTags: [
      relation("tweet-1", "tag-a"),
      relation("tweet-2", "tag-a"),
      relation("tweet-3", "tag-a")
    ],
    bookmarks: [
      bookmark("tweet-1", "alice"),
      bookmark("tweet-2", "alice"),
      bookmark("tweet-3", "bob")
    ],
    options: { topAuthorsPerTag: 1 }
  })

  assert.deepEqual(graph.nodes[0].topAuthors, [{ authorHandle: "alice", count: 2 }])
  assert.equal(graph.nodes[0].authorCount, 2)
})

test("buildTagRelationGraph drops weak cooccurrence edges below the weight floor", () => {
  const bookmarkTags: BookmarkTagRecord[] = [relation("tweet-0", "tag-a"), relation("tweet-0", "tag-b")]
  for (let index = 1; index <= 40; index += 1) {
    bookmarkTags.push(relation(`tweet-a-${index}`, "tag-a"))
  }

  const graph = buildTagRelationGraph({
    tags: [tag("tag-a", "A"), tag("tag-b", "B")],
    bookmarkTags
  })

  assert.equal(graph.edges.length, 0)
  assert.equal(graph.droppedEdgeCount, 1)
})

test("buildTagRelationGraph keeps an edge that fits the budget of either endpoint", () => {
  const tags = [tag("tag-hub", "Hub")]
  const bookmarkTags: BookmarkTagRecord[] = []

  for (let index = 1; index <= 4; index += 1) {
    const tagId = `tag-${index}`
    tags.push(tag(tagId, `Tag ${index}`))
    bookmarkTags.push(relation(`tweet-${index}`, "tag-hub"), relation(`tweet-${index}`, tagId))
  }

  const graph = buildTagRelationGraph({ tags, bookmarkTags, options: { maxEdgesPerNode: 2 } })

  // Each leaf has a single edge, so the hub keeps all four rather than leaving
  // isolated nodes behind.
  assert.equal(graph.edges.length, 4)
  assert.equal(graph.droppedEdgeCount, 0)
})

test("buildTagRelationGraph caps hub edges when leaves have stronger neighbours", () => {
  const tags = [
    tag("tag-hub", "Hub"),
    tag("tag-1", "Tag 1"),
    tag("tag-2", "Tag 2"),
    tag("tag-3", "Tag 3"),
    tag("tag-4", "Tag 4")
  ]
  const bookmarkTags: BookmarkTagRecord[] = []

  // A tight clique between the four leaves outranks their hub edges.
  for (const bookmarkId of ["clique-1", "clique-2", "clique-3"]) {
    for (const tagId of ["tag-1", "tag-2", "tag-3", "tag-4"]) {
      bookmarkTags.push(relation(bookmarkId, tagId))
    }
  }

  for (let index = 1; index <= 4; index += 1) {
    for (let repeat = 0; repeat < index; repeat += 1) {
      const bookmarkId = `hub-${index}-${repeat}`
      bookmarkTags.push(relation(bookmarkId, "tag-hub"), relation(bookmarkId, `tag-${index}`))
    }
  }

  const graph = buildTagRelationGraph({ tags, bookmarkTags, options: { maxEdgesPerNode: 2 } })

  const hubNeighbours = graph.edges
    .filter((edge) => edge.sourceTagId === "tag-hub" || edge.targetTagId === "tag-hub")
    .map((edge) => (edge.sourceTagId === "tag-hub" ? edge.targetTagId : edge.sourceTagId))
    .sort()

  assert.deepEqual(hubNeighbours, ["tag-3", "tag-4"])
  assert.ok(graph.droppedEdgeCount >= 2)
})

test("buildTagRelationGraph sorts hierarchy edges ahead of weighted edges", () => {
  const graph = buildTagRelationGraph({
    tags: [tag("tag-theme", "Theme"), tag("tag-child", "Child", { parentId: "tag-theme" })],
    bookmarkTags: [relation("tweet-1", "tag-theme"), relation("tweet-1", "tag-child")]
  })

  assert.deepEqual(
    graph.edges.map((edge) => edge.type),
    ["hierarchy", "cooccurrence"]
  )
})
