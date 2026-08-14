import type { BookmarkTagRecord, TagRecord } from "../types.ts"

export interface TagGraphNode {
  tagId: string
  name: string
  bookmarkCount: number
}

export interface TagGraphEdge {
  sourceTagId: string
  targetTagId: string
  cooccurrence: number
}

export interface TagGraph {
  nodes: TagGraphNode[]
  edges: TagGraphEdge[]
}

function edgeKey(tagIdA: string, tagIdB: string) {
  return tagIdA < tagIdB ? `${tagIdA}\u0000${tagIdB}` : `${tagIdB}\u0000${tagIdA}`
}

export function buildTagGraph(tags: TagRecord[], bookmarkTags: BookmarkTagRecord[]): TagGraph {
  const tagIds = new Set(tags.map((tag) => tag.id))
  const bookmarkCountByTagId = new Map<string, number>()
  const tagIdsByBookmarkId = new Map<string, Set<string>>()

  for (const relation of bookmarkTags) {
    if (!tagIds.has(relation.tagId)) {
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

  const cooccurrenceByEdgeKey = new Map<string, TagGraphEdge>()

  for (const tagIdsForBookmark of tagIdsByBookmarkId.values()) {
    const sortedTagIds = [...tagIdsForBookmark].sort()

    for (let i = 0; i < sortedTagIds.length; i += 1) {
      for (let j = i + 1; j < sortedTagIds.length; j += 1) {
        const key = edgeKey(sortedTagIds[i], sortedTagIds[j])
        const existing = cooccurrenceByEdgeKey.get(key)

        if (existing) {
          existing.cooccurrence += 1
        } else {
          cooccurrenceByEdgeKey.set(key, {
            sourceTagId: sortedTagIds[i],
            targetTagId: sortedTagIds[j],
            cooccurrence: 1
          })
        }
      }
    }
  }

  return {
    nodes: tags.map((tag) => ({
      tagId: tag.id,
      name: tag.name,
      bookmarkCount: bookmarkCountByTagId.get(tag.id) ?? 0
    })),
    edges: [...cooccurrenceByEdgeKey.values()]
  }
}
