import test from "node:test"
import assert from "node:assert/strict"
import { buildTagGraph } from "../../src/lib/graph/tagGraph.ts"

const createdAt = "2026-03-15T00:00:00.000Z"

function tag(id: string, name: string) {
  return { id, name, createdAt }
}

function relation(bookmarkId: string, tagId: string) {
  return { id: `${bookmarkId}:${tagId}`, bookmarkId, tagId, createdAt }
}

test("buildTagGraph returns an empty graph for empty inputs", () => {
  const graph = buildTagGraph([], [])

  assert.deepEqual(graph, { nodes: [], edges: [] })
})

test("buildTagGraph counts bookmarks per tag with no edges for a single tag", () => {
  const graph = buildTagGraph(
    [tag("tag-ai", "AI")],
    [relation("tweet-1", "tag-ai"), relation("tweet-2", "tag-ai")]
  )

  assert.deepEqual(graph.nodes, [{ tagId: "tag-ai", name: "AI", bookmarkCount: 2 }])
  assert.deepEqual(graph.edges, [])
})

test("buildTagGraph accumulates co-occurrence counts across bookmarks", () => {
  const graph = buildTagGraph(
    [tag("tag-ai", "AI"), tag("tag-code", "Code"), tag("tag-news", "News")],
    [
      relation("tweet-1", "tag-ai"),
      relation("tweet-1", "tag-code"),
      relation("tweet-2", "tag-ai"),
      relation("tweet-2", "tag-code"),
      relation("tweet-2", "tag-news")
    ]
  )

  assert.deepEqual(graph.nodes, [
    { tagId: "tag-ai", name: "AI", bookmarkCount: 2 },
    { tagId: "tag-code", name: "Code", bookmarkCount: 2 },
    { tagId: "tag-news", name: "News", bookmarkCount: 1 }
  ])

  const sortedEdges = [...graph.edges].sort((a, b) =>
    `${a.sourceTagId}:${a.targetTagId}`.localeCompare(`${b.sourceTagId}:${b.targetTagId}`)
  )
  assert.deepEqual(sortedEdges, [
    { sourceTagId: "tag-ai", targetTagId: "tag-code", cooccurrence: 2 },
    { sourceTagId: "tag-ai", targetTagId: "tag-news", cooccurrence: 1 },
    { sourceTagId: "tag-code", targetTagId: "tag-news", cooccurrence: 1 }
  ])
})

test("buildTagGraph deduplicates unordered pairs and duplicate relations", () => {
  const graph = buildTagGraph(
    [tag("tag-b", "B"), tag("tag-a", "A")],
    [
      relation("tweet-1", "tag-b"),
      relation("tweet-1", "tag-a"),
      { id: "tweet-1:tag-a:dup", bookmarkId: "tweet-1", tagId: "tag-a", createdAt }
    ]
  )

  assert.equal(graph.edges.length, 1)
  assert.deepEqual(graph.edges[0], { sourceTagId: "tag-a", targetTagId: "tag-b", cooccurrence: 1 })
  assert.deepEqual(graph.nodes, [
    { tagId: "tag-b", name: "B", bookmarkCount: 1 },
    { tagId: "tag-a", name: "A", bookmarkCount: 1 }
  ])
})

test("buildTagGraph ignores relations that reference unknown tags", () => {
  const graph = buildTagGraph(
    [tag("tag-ai", "AI")],
    [relation("tweet-1", "tag-ai"), relation("tweet-1", "tag-ghost")]
  )

  assert.deepEqual(graph.nodes, [{ tagId: "tag-ai", name: "AI", bookmarkCount: 1 }])
  assert.deepEqual(graph.edges, [])
})
