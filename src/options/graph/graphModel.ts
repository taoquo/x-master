// View model between the workspace data and the graph renderer. Pure functions
// only: layout positions are computed here so the renderer stays a thin drawing
// layer and every scoping rule can be unit tested.
import {
  buildTagRelationGraph,
  type AuthorTagEdge,
  type TagRelationEdge,
  type TagRelationGraph,
  type TagRelationGraphOptions,
  type TagRelationNode,
  type TagRelationAuthorNode
} from "../../lib/graph/tagRelations.ts"
import type { BookmarkRecord, BookmarkTagRecord, TagRecord } from "../../lib/types.ts"
import { compareNaturalNames } from "../collation.ts"

export const DEFAULT_GRAPH_NODE_LIMIT = 60
// Authors are opt-in and capped much lower than tags: they exist to explain why
// two topics touch, not to become the bulk of the canvas.
export const DEFAULT_GRAPH_AUTHOR_LIMIT = 18

export interface GraphScope {
  activeTagIds: string[]
  activeAuthorHandles: string[]
  searchQuery: string
}

export interface GraphViewNode extends TagRelationNode {
  x: number
  y: number
  radius: number
}

export interface GraphViewAuthorNode extends TagRelationAuthorNode {
  x: number
  y: number
  radius: number
}

export interface GraphViewModel {
  nodes: GraphViewNode[]
  edges: TagRelationEdge[]
  authorNodes: GraphViewAuthorNode[]
  authorEdges: AuthorTagEdge[]
  totalTagCount: number
  hiddenTagCount: number
  droppedEdgeCount: number
}

export const EMPTY_GRAPH_SCOPE: GraphScope = {
  activeTagIds: ["all"],
  activeAuthorHandles: [],
  searchQuery: ""
}

export const EMPTY_GRAPH_VIEW_MODEL: GraphViewModel = {
  nodes: [],
  edges: [],
  authorNodes: [],
  authorEdges: [],
  totalTagCount: 0,
  hiddenTagCount: 0,
  droppedEdgeCount: 0
}

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase().replace(/^@/, "")
}

// Author scoping happens before the graph is built so cooccurrence weights
// reflect the visible slice instead of the whole workspace.
function selectScopedBookmarkTags({
  bookmarks,
  bookmarkTags,
  activeAuthorHandles
}: {
  bookmarks: BookmarkRecord[]
  bookmarkTags: BookmarkTagRecord[]
  activeAuthorHandles: string[]
}) {
  const handles = new Set(activeAuthorHandles.map(normalizeHandle).filter(Boolean))
  if (!handles.size) {
    return bookmarkTags
  }

  const allowedBookmarkIds = new Set<string>()
  for (const bookmark of bookmarks) {
    if (!handles.has(normalizeHandle(bookmark.authorHandle))) {
      continue
    }

    allowedBookmarkIds.add(bookmark.id ?? bookmark.tweetId)
  }

  return bookmarkTags.filter((relation) => allowedBookmarkIds.has(relation.bookmarkId))
}

function matchesSearchQuery(node: TagRelationNode, searchQuery: string) {
  const trimmed = searchQuery.trim().toLowerCase()
  if (!trimmed) {
    return true
  }

  return [node.name, ...node.aliases].some((value) => value.toLowerCase().includes(trimmed))
}

// A focused node keeps its direct neighbours so the graph still shows context
// instead of a lone dot.
function selectFocusTagIds(graph: TagRelationGraph, activeTagIds: string[]) {
  const focused = new Set(activeTagIds.filter((tagId) => tagId && tagId !== "all"))
  if (!focused.size) {
    return null
  }

  const visible = new Set(focused)
  for (const edge of graph.edges) {
    if (focused.has(edge.sourceTagId)) {
      visible.add(edge.targetTagId)
    }

    if (focused.has(edge.targetTagId)) {
      visible.add(edge.sourceTagId)
    }
  }

  return visible
}

function compareNodesByWeight(left: TagRelationNode, right: TagRelationNode) {
  return (
    right.bookmarkCount - left.bookmarkCount ||
    right.authorCount - left.authorCount ||
    compareNaturalNames(left.name, right.name)
  )
}

// Deterministic radial seed layout: themes on an inner ring, child tags on an
// outer ring next to their parent. The renderer can relax it further, but the
// seed alone is already readable and keeps snapshots stable.
function assignLayout(nodes: TagRelationNode[]): GraphViewNode[] {
  if (!nodes.length) {
    return []
  }

  const maxBookmarkCount = nodes.reduce((max, node) => Math.max(max, node.bookmarkCount), 0)
  const roots = nodes.filter((node) => node.depth === 0)
  const angleByClusterId = new Map<string, number>()

  roots.forEach((node, index) => {
    angleByClusterId.set(node.clusterId, (index / Math.max(1, roots.length)) * Math.PI * 2)
  })

  const childIndexByClusterId = new Map<string, number>()
  const childTotalByClusterId = new Map<string, number>()
  for (const node of nodes) {
    if (node.depth !== 1) {
      continue
    }

    childTotalByClusterId.set(node.clusterId, (childTotalByClusterId.get(node.clusterId) ?? 0) + 1)
  }

  return nodes.map((node) => {
    const baseAngle = angleByClusterId.get(node.clusterId) ?? 0
    let angle = baseAngle
    let distance = 0.42

    if (node.depth === 1) {
      const total = childTotalByClusterId.get(node.clusterId) ?? 1
      const index = childIndexByClusterId.get(node.clusterId) ?? 0
      childIndexByClusterId.set(node.clusterId, index + 1)
      const spread = Math.PI / 6
      angle = baseAngle + (total > 1 ? (index / (total - 1) - 0.5) * spread * 2 : 0)
      distance = 0.82
    }

    const scale = maxBookmarkCount > 0 ? node.bookmarkCount / maxBookmarkCount : 0

    return {
      ...node,
      x: Math.round((0.5 + Math.cos(angle) * distance * 0.5) * 1000) / 1000,
      y: Math.round((0.5 + Math.sin(angle) * distance * 0.5) * 1000) / 1000,
      radius: Math.round((6 + Math.sqrt(scale) * 14) * 100) / 100
    }
  })
}

// Authors ride an outer ring so the tag core stays readable. Order is stable
// (the relation layer already sorted them), which keeps DOM snapshots stable.
function assignAuthorLayout(nodes: TagRelationAuthorNode[]): GraphViewAuthorNode[] {
  if (!nodes.length) {
    return []
  }

  const maxBookmarkCount = nodes.reduce((max, node) => Math.max(max, node.bookmarkCount), 0)

  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 + Math.PI / nodes.length
    const scale = maxBookmarkCount > 0 ? node.bookmarkCount / maxBookmarkCount : 0

    return {
      ...node,
      x: Math.round((0.5 + Math.cos(angle) * 0.49) * 1000) / 1000,
      y: Math.round((0.5 + Math.sin(angle) * 0.49) * 1000) / 1000,
      radius: Math.round((4 + Math.sqrt(scale) * 7) * 100) / 100
    }
  })
}

export function buildGraphViewModel({
  tags,
  bookmarkTags,
  bookmarks = [],
  scope = EMPTY_GRAPH_SCOPE,
  nodeLimit = DEFAULT_GRAPH_NODE_LIMIT,
  authorLimit = DEFAULT_GRAPH_AUTHOR_LIMIT,
  includeAuthors = false,
  relationOptions
}: {
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  bookmarks?: BookmarkRecord[]
  scope?: GraphScope
  nodeLimit?: number
  authorLimit?: number
  includeAuthors?: boolean
  relationOptions?: TagRelationGraphOptions
}): GraphViewModel {
  const scopedBookmarkTags = selectScopedBookmarkTags({
    bookmarks,
    bookmarkTags,
    activeAuthorHandles: scope.activeAuthorHandles
  })

  const graph = buildTagRelationGraph({
    tags,
    bookmarkTags: scopedBookmarkTags,
    bookmarks,
    options: { ...relationOptions, includeAuthors, maxAuthors: Math.max(0, authorLimit) }
  })

  const focusTagIds = selectFocusTagIds(graph, scope.activeTagIds)
  const candidates = graph.nodes.filter((node) => {
    if (focusTagIds && !focusTagIds.has(node.tagId)) {
      return false
    }

    return matchesSearchQuery(node, scope.searchQuery)
  })

  const ranked = [...candidates].sort(compareNodesByWeight)
  const limit = Math.max(0, nodeLimit)
  const kept = ranked.slice(0, limit)
  const keptTagIds = new Set(kept.map((node) => node.tagId))

  const edges = graph.edges.filter(
    (edge) => keptTagIds.has(edge.sourceTagId) && keptTagIds.has(edge.targetTagId)
  )

  // An author only stays on the canvas while at least one of its topics is still
  // visible, so scoping a tag never leaves floating author dots behind.
  const authorEdges = graph.authorEdges.filter((edge) => keptTagIds.has(edge.tagId))
  const connectedHandles = new Set(authorEdges.map((edge) => edge.authorHandle))
  const authorNodes = graph.authorNodes.filter((node) => connectedHandles.has(node.authorHandle))

  return {
    nodes: assignLayout(kept),
    edges,
    authorNodes: assignAuthorLayout(authorNodes),
    authorEdges,
    totalTagCount: graph.nodes.length,
    hiddenTagCount: graph.nodes.length - kept.length,
    droppedEdgeCount: graph.droppedEdgeCount
  }
}

export function getGraphNeighbourTagIds(edges: TagRelationEdge[], tagId: string) {
  const neighbours = new Set<string>()
  for (const edge of edges) {
    if (edge.sourceTagId === tagId) {
      neighbours.add(edge.targetTagId)
    }

    if (edge.targetTagId === tagId) {
      neighbours.add(edge.sourceTagId)
    }
  }

  return neighbours
}
