// Typed relation graph for the tag association view. Pure functions only so the
// edge model can be unit tested without any rendering layer.
//
// Three edge types carry different meaning:
// - cooccurrence: two tags sit on the same bookmark (topic adjacency)
// - hierarchy:    parent theme -> child tag (structural backbone)
// - author-bridge: two tags come from the same authors but never share a
//   bookmark, which surfaces "same people, different topics"
import type { BookmarkRecord, BookmarkTagRecord, TagRecord } from "../types.ts"

export type TagRelationEdgeType = "cooccurrence" | "hierarchy" | "author-bridge"

export interface TagRelationAuthor {
  authorHandle: string
  count: number
}

// Authors are first-class nodes when the caller asks for them: the tag/author
// bipartite layer is what turns "topics that sit together" into "people who
// connect topics", which is the base signal the 3D view will need.
export interface TagRelationAuthorNode {
  authorHandle: string
  bookmarkCount: number
  tagCount: number
}

export interface AuthorTagEdge {
  authorHandle: string
  tagId: string
  weight: number
  rawCount: number
}

export interface TagRelationNode {
  tagId: string
  name: string
  bookmarkCount: number
  aliases: string[]
  parentId?: string
  depth: 0 | 1
  clusterId: string
  authorCount: number
  topAuthors: TagRelationAuthor[]
}

export interface TagRelationEdge {
  sourceTagId: string
  targetTagId: string
  type: TagRelationEdgeType
  weight: number
  rawCount: number
}

export interface TagRelationGraph {
  nodes: TagRelationNode[]
  edges: TagRelationEdge[]
  authorNodes: TagRelationAuthorNode[]
  authorEdges: AuthorTagEdge[]
  droppedEdgeCount: number
}

export interface TagRelationGraphOptions {
  minCooccurrenceCount?: number
  minCooccurrenceWeight?: number
  minAuthorBridgeCount?: number
  maxEdgesPerNode?: number
  topAuthorsPerTag?: number
  includeAuthors?: boolean
  minAuthorTagCount?: number
  maxAuthors?: number
}

export const DEFAULT_TAG_RELATION_OPTIONS: Required<TagRelationGraphOptions> = {
  minCooccurrenceCount: 1,
  minCooccurrenceWeight: 0.05,
  minAuthorBridgeCount: 2,
  maxEdgesPerNode: 8,
  topAuthorsPerTag: 3,
  includeAuthors: false,
  minAuthorTagCount: 2,
  maxAuthors: 24
}

const PAIR_SEPARATOR = "\u0000"

function pairKey(tagIdA: string, tagIdB: string) {
  return tagIdA < tagIdB
    ? `${tagIdA}${PAIR_SEPARATOR}${tagIdB}`
    : `${tagIdB}${PAIR_SEPARATOR}${tagIdA}`
}

function splitPairKey(key: string) {
  const [sourceTagId, targetTagId] = key.split(PAIR_SEPARATOR)
  return { sourceTagId, targetTagId }
}

function compareAuthors(left: TagRelationAuthor, right: TagRelationAuthor) {
  return right.count - left.count || left.authorHandle.localeCompare(right.authorHandle)
}

const EDGE_TYPE_PRIORITY: Record<TagRelationEdgeType, number> = {
  hierarchy: 0,
  cooccurrence: 1,
  "author-bridge": 2
}

function compareEdges(left: TagRelationEdge, right: TagRelationEdge) {
  return (
    EDGE_TYPE_PRIORITY[left.type] - EDGE_TYPE_PRIORITY[right.type] ||
    right.weight - left.weight ||
    left.sourceTagId.localeCompare(right.sourceTagId) ||
    left.targetTagId.localeCompare(right.targetTagId)
  )
}

function roundWeight(value: number) {
  return Math.round(value * 1000) / 1000
}

export function buildTagRelationGraph({
  tags,
  bookmarkTags,
  bookmarks = [],
  options
}: {
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  bookmarks?: BookmarkRecord[]
  options?: TagRelationGraphOptions
}): TagRelationGraph {
  const settings = { ...DEFAULT_TAG_RELATION_OPTIONS, ...options }
  const tagById = new Map(tags.map((tag) => [tag.id, tag]))

  const tagIdsByBookmarkId = new Map<string, Set<string>>()
  const bookmarkCountByTagId = new Map<string, number>()

  for (const relation of bookmarkTags) {
    if (!tagById.has(relation.tagId)) {
      continue
    }

    const tagIdsForBookmark = tagIdsByBookmarkId.get(relation.bookmarkId) ?? new Set<string>()
    if (tagIdsForBookmark.has(relation.tagId)) {
      continue
    }

    tagIdsForBookmark.add(relation.tagId)
    tagIdsByBookmarkId.set(relation.bookmarkId, tagIdsForBookmark)
    bookmarkCountByTagId.set(relation.tagId, (bookmarkCountByTagId.get(relation.tagId) ?? 0) + 1)
  }

  const authorHandleByBookmarkId = new Map<string, string>()
  for (const bookmark of bookmarks) {
    const bookmarkId = bookmark.id ?? bookmark.tweetId
    const authorHandle = bookmark.authorHandle.trim()
    if (!bookmarkId || !authorHandle) {
      continue
    }

    authorHandleByBookmarkId.set(bookmarkId, authorHandle)
  }

  const authorCountsByTagId = new Map<string, Map<string, number>>()
  const tagIdsByAuthorHandle = new Map<string, Set<string>>()
  const taggedBookmarkCountByAuthor = new Map<string, number>()

  for (const [bookmarkId, tagIdsForBookmark] of tagIdsByBookmarkId) {
    const authorHandle = authorHandleByBookmarkId.get(bookmarkId)
    if (!authorHandle) {
      continue
    }

    const tagIdsForAuthor = tagIdsByAuthorHandle.get(authorHandle) ?? new Set<string>()
    taggedBookmarkCountByAuthor.set(authorHandle, (taggedBookmarkCountByAuthor.get(authorHandle) ?? 0) + 1)

    for (const tagId of tagIdsForBookmark) {
      tagIdsForAuthor.add(tagId)
      const counts = authorCountsByTagId.get(tagId) ?? new Map<string, number>()
      counts.set(authorHandle, (counts.get(authorHandle) ?? 0) + 1)
      authorCountsByTagId.set(tagId, counts)
    }

    tagIdsByAuthorHandle.set(authorHandle, tagIdsForAuthor)
  }

  const cooccurrenceByPairKey = new Map<string, number>()
  for (const tagIdsForBookmark of tagIdsByBookmarkId.values()) {
    const sortedTagIds = [...tagIdsForBookmark].sort()

    for (let i = 0; i < sortedTagIds.length; i += 1) {
      for (let j = i + 1; j < sortedTagIds.length; j += 1) {
        const key = pairKey(sortedTagIds[i], sortedTagIds[j])
        cooccurrenceByPairKey.set(key, (cooccurrenceByPairKey.get(key) ?? 0) + 1)
      }
    }
  }

  const authorHandlesByPairKey = new Map<string, Set<string>>()
  for (const [authorHandle, tagIdsForAuthor] of tagIdsByAuthorHandle) {
    if (tagIdsForAuthor.size < 2) {
      continue
    }

    const sortedTagIds = [...tagIdsForAuthor].sort()
    for (let i = 0; i < sortedTagIds.length; i += 1) {
      for (let j = i + 1; j < sortedTagIds.length; j += 1) {
        const key = pairKey(sortedTagIds[i], sortedTagIds[j])
        // Same-bookmark adjacency is the stronger signal, so it wins the pair.
        if (cooccurrenceByPairKey.has(key)) {
          continue
        }

        const handles = authorHandlesByPairKey.get(key) ?? new Set<string>()
        handles.add(authorHandle)
        authorHandlesByPairKey.set(key, handles)
      }
    }
  }

  const nodes: TagRelationNode[] = tags.map((tag) => {
    // A parentId pointing at a removed tag degrades to a root node.
    const parentId = tag.parentId && tagById.has(tag.parentId) ? tag.parentId : undefined
    const authorCounts = authorCountsByTagId.get(tag.id)
    const topAuthors = authorCounts
      ? [...authorCounts.entries()]
          .map(([authorHandle, count]) => ({ authorHandle, count }))
          .sort(compareAuthors)
          .slice(0, Math.max(0, settings.topAuthorsPerTag))
      : []

    const node: TagRelationNode = {
      tagId: tag.id,
      name: tag.name,
      bookmarkCount: bookmarkCountByTagId.get(tag.id) ?? 0,
      aliases: tag.aliases ?? [],
      depth: parentId ? 1 : 0,
      clusterId: parentId ?? tag.id,
      authorCount: authorCounts?.size ?? 0,
      topAuthors
    }

    if (parentId) {
      node.parentId = parentId
    }

    return node
  })

  const authorCountByTagId = new Map(nodes.map((node) => [node.tagId, node.authorCount]))
  const hierarchyEdges: TagRelationEdge[] = []
  for (const node of nodes) {
    if (!node.parentId) {
      continue
    }

    hierarchyEdges.push({
      sourceTagId: node.parentId,
      targetTagId: node.tagId,
      type: "hierarchy",
      weight: 1,
      rawCount: 1
    })
  }

  let droppedEdgeCount = 0
  const weightedEdges: TagRelationEdge[] = []

  for (const [key, rawCount] of cooccurrenceByPairKey) {
    const { sourceTagId, targetTagId } = splitPairKey(key)
    const sourceCount = bookmarkCountByTagId.get(sourceTagId) ?? 0
    const targetCount = bookmarkCountByTagId.get(targetTagId) ?? 0
    const union = sourceCount + targetCount - rawCount
    // Jaccard keeps a high-volume tag from dominating every edge in the graph.
    const weight = union > 0 ? rawCount / union : 0

    if (rawCount < settings.minCooccurrenceCount || weight < settings.minCooccurrenceWeight) {
      droppedEdgeCount += 1
      continue
    }

    weightedEdges.push({
      sourceTagId,
      targetTagId,
      type: "cooccurrence",
      weight: roundWeight(weight),
      rawCount
    })
  }

  for (const [key, handles] of authorHandlesByPairKey) {
    const { sourceTagId, targetTagId } = splitPairKey(key)
    const rawCount = handles.size

    if (rawCount < settings.minAuthorBridgeCount) {
      droppedEdgeCount += 1
      continue
    }

    const denominator = Math.min(
      authorCountByTagId.get(sourceTagId) ?? 0,
      authorCountByTagId.get(targetTagId) ?? 0
    )
    const weight = denominator > 0 ? Math.min(1, rawCount / denominator) : 0

    weightedEdges.push({
      sourceTagId,
      targetTagId,
      type: "author-bridge",
      weight: roundWeight(weight),
      rawCount
    })
  }

  const keptEdges = applyPerNodeEdgeBudget(weightedEdges, settings.maxEdgesPerNode)
  droppedEdgeCount += weightedEdges.length - keptEdges.length

  const { authorNodes, authorEdges } = settings.includeAuthors
    ? buildAuthorLayer({
        tagIdsByAuthorHandle,
        taggedBookmarkCountByAuthor,
        authorCountsByTagId,
        minAuthorTagCount: settings.minAuthorTagCount,
        maxAuthors: settings.maxAuthors
      })
    : { authorNodes: [], authorEdges: [] }

  return {
    nodes,
    edges: [...hierarchyEdges, ...keptEdges].sort(compareEdges),
    authorNodes,
    authorEdges,
    droppedEdgeCount
  }
}

// Bipartite author layer: only authors who bridge at least `minAuthorTagCount`
// topics are worth a node, otherwise every one-off author becomes a leaf and
// the graph turns into a hairball. Ranking by bridged topics first keeps the
// connectors, not just the loudest accounts.
function buildAuthorLayer({
  tagIdsByAuthorHandle,
  taggedBookmarkCountByAuthor,
  authorCountsByTagId,
  minAuthorTagCount,
  maxAuthors
}: {
  tagIdsByAuthorHandle: Map<string, Set<string>>
  taggedBookmarkCountByAuthor: Map<string, number>
  authorCountsByTagId: Map<string, Map<string, number>>
  minAuthorTagCount: number
  maxAuthors: number
}): { authorNodes: TagRelationAuthorNode[]; authorEdges: AuthorTagEdge[] } {
  if (maxAuthors <= 0) {
    return { authorNodes: [], authorEdges: [] }
  }

  const ranked: TagRelationAuthorNode[] = []
  for (const [authorHandle, tagIdsForAuthor] of tagIdsByAuthorHandle) {
    if (tagIdsForAuthor.size < Math.max(1, minAuthorTagCount)) {
      continue
    }

    ranked.push({
      authorHandle,
      bookmarkCount: taggedBookmarkCountByAuthor.get(authorHandle) ?? 0,
      tagCount: tagIdsForAuthor.size
    })
  }

  ranked.sort(
    (left, right) =>
      right.tagCount - left.tagCount ||
      right.bookmarkCount - left.bookmarkCount ||
      left.authorHandle.localeCompare(right.authorHandle)
  )

  const authorNodes = ranked.slice(0, maxAuthors)
  const keptHandles = new Set(authorNodes.map((node) => node.authorHandle))
  const authorEdges: AuthorTagEdge[] = []

  for (const [tagId, counts] of authorCountsByTagId) {
    for (const [authorHandle, rawCount] of counts) {
      if (!keptHandles.has(authorHandle)) {
        continue
      }

      const authorTotal = taggedBookmarkCountByAuthor.get(authorHandle) ?? 0
      authorEdges.push({
        authorHandle,
        tagId,
        weight: authorTotal > 0 ? roundWeight(Math.min(1, rawCount / authorTotal)) : 0,
        rawCount
      })
    }
  }

  authorEdges.sort(
    (left, right) =>
      left.authorHandle.localeCompare(right.authorHandle) ||
      right.rawCount - left.rawCount ||
      left.tagId.localeCompare(right.tagId)
  )

  return { authorNodes, authorEdges }
}

// An edge survives when it ranks inside the budget of either endpoint, which is
// what keeps a 50-tag graph readable instead of near fully connected.
function applyPerNodeEdgeBudget(edges: TagRelationEdge[], maxEdgesPerNode: number) {
  if (maxEdgesPerNode <= 0) {
    return []
  }

  const edgesByTagId = new Map<string, TagRelationEdge[]>()
  for (const edge of edges) {
    for (const tagId of [edge.sourceTagId, edge.targetTagId]) {
      const bucket = edgesByTagId.get(tagId) ?? []
      bucket.push(edge)
      edgesByTagId.set(tagId, bucket)
    }
  }

  const kept = new Set<TagRelationEdge>()
  for (const bucket of edgesByTagId.values()) {
    const ranked = [...bucket].sort(compareEdges).slice(0, maxEdgesPerNode)
    for (const edge of ranked) {
      kept.add(edge)
    }
  }

  return edges.filter((edge) => kept.has(edge))
}
