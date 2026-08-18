// SVG relation graph for the tag management mode. SVG instead of canvas keeps the
// nodes real DOM elements, so keyboard focus, screen readers and DOM tests all
// work without a parallel accessibility tree.
import React from "react"
import type { TagRelationEdgeType } from "../../lib/graph/tagRelations.ts"
import type { GraphViewModel } from "../graph/graphModel.ts"
import { getGraphNeighbourTagIds } from "../graph/graphModel.ts"
import type { OptionsCopy } from "../i18n/copy.ts"
import { cn } from "../utils.ts"

const VIEWBOX_SIZE = 1000
const PADDING = 60

function toViewBoxX(x: number) {
  return PADDING + x * (VIEWBOX_SIZE - PADDING * 2)
}

function toViewBoxY(y: number) {
  return PADDING + y * (VIEWBOX_SIZE - PADDING * 2)
}

function getEdgeLabel(copy: OptionsCopy, type: TagRelationEdgeType) {
  if (type === "hierarchy") {
    return copy.graphEdgeHierarchy
  }

  if (type === "author-bridge") {
    return copy.graphEdgeAuthorBridge
  }

  return copy.graphEdgeCooccurrence
}

export interface TagGraphViewProps {
  copy: OptionsCopy
  model: GraphViewModel
  focusedTagId: string | null
  showAuthors: boolean
  onToggleAuthors: () => void
  onFocusTag: (tagId: string | null) => void
  onViewTagBookmarks: (tagId: string) => void
}

export function TagGraphView({
  copy,
  model,
  focusedTagId,
  showAuthors,
  onToggleAuthors,
  onFocusTag,
  onViewTagBookmarks
}: TagGraphViewProps) {
  const neighbourTagIds = focusedTagId
    ? getGraphNeighbourTagIds(model.edges, focusedTagId)
    : new Set<string>()
  const focusedNode = focusedTagId
    ? model.nodes.find((node) => node.tagId === focusedTagId)
    : undefined
  const nodeById = new Map(model.nodes.map((node) => [node.tagId, node]))
  const authorNodeByHandle = new Map(model.authorNodes.map((node) => [node.authorHandle, node]))
  // With a tag focused, only that tag's authors stay lit; otherwise the author
  // ring adds noise instead of explanation.
  const focusedAuthorHandles = focusedTagId
    ? new Set(
        model.authorEdges
          .filter((edge) => edge.tagId === focusedTagId)
          .map((edge) => edge.authorHandle)
      )
    : null

  return (
    <div data-testid="tag-results-graph" className="options-tag-graph-shell options-theme-panel">
      <div className="options-tag-graph-head">
        <span data-testid="tag-graph-summary" className="options-meta-copy">
          {model.nodes.length} {copy.tagsCountSuffix} · {model.edges.length} {copy.graphEdgesSuffix}
          {model.hiddenTagCount ? ` · ${model.hiddenTagCount} ${copy.graphHiddenSuffix}` : ""}
          {showAuthors ? ` · ${model.authorNodes.length} ${copy.graphAuthorNodesSuffix}` : ""}
        </span>
        <div className="options-tag-graph-head-actions">
          <button
            type="button"
            data-testid="tag-graph-toggle-authors"
            className={cn("options-secondary-button", showAuthors && "is-active")}
            aria-pressed={showAuthors}
            onClick={onToggleAuthors}>
            {copy.graphShowAuthors}
          </button>
          {focusedTagId ? (
            <button
              type="button"
              data-testid="tag-graph-clear-focus"
              className="options-secondary-button"
              onClick={() => onFocusTag(null)}>
              {copy.graphClearFocus}
            </button>
          ) : null}
        </div>
      </div>

      {model.nodes.length ? (
        <svg
          data-testid="tag-graph-canvas"
          className="options-tag-graph-canvas"
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          role="img"
          aria-label={copy.graphAriaLabel}>
          <g className="options-tag-graph-edges">
            {model.edges.map((edge) => {
              const source = model.nodes.find((node) => node.tagId === edge.sourceTagId)
              const target = model.nodes.find((node) => node.tagId === edge.targetTagId)
              if (!source || !target) {
                return null
              }

              const isActive =
                !focusedTagId ||
                edge.sourceTagId === focusedTagId ||
                edge.targetTagId === focusedTagId

              return (
                <line
                  key={`${edge.type}:${edge.sourceTagId}:${edge.targetTagId}`}
                  data-graph-edge={`${edge.sourceTagId}:${edge.targetTagId}`}
                  data-graph-edge-type={edge.type}
                  className={cn("options-tag-graph-edge", `is-${edge.type}`, !isActive && "is-dimmed")}
                  x1={toViewBoxX(source.x)}
                  y1={toViewBoxY(source.y)}
                  x2={toViewBoxX(target.x)}
                  y2={toViewBoxY(target.y)}
                  strokeWidth={1 + edge.weight * 4}>
                  <title>{`${source.name} — ${target.name} · ${getEdgeLabel(copy, edge.type)} (${edge.rawCount})`}</title>
                </line>
              )
            })}
          </g>
          {showAuthors ? (
            <g className="options-tag-graph-author-edges">
              {model.authorEdges.map((edge) => {
                const source = authorNodeByHandle.get(edge.authorHandle)
                const target = nodeById.get(edge.tagId)
                if (!source || !target) {
                  return null
                }

                const isActive = !focusedTagId || edge.tagId === focusedTagId

                return (
                  <line
                    key={`author:${edge.authorHandle}:${edge.tagId}`}
                    data-graph-author-edge={`${edge.authorHandle}:${edge.tagId}`}
                    className={cn("options-tag-graph-edge", "is-author-tag", !isActive && "is-dimmed")}
                    x1={toViewBoxX(source.x)}
                    y1={toViewBoxY(source.y)}
                    x2={toViewBoxX(target.x)}
                    y2={toViewBoxY(target.y)}
                    strokeWidth={0.75 + edge.weight * 2}>
                    <title>{`@${edge.authorHandle} — ${target.name} · ${copy.graphAuthorTagLink} (${edge.rawCount})`}</title>
                  </line>
                )
              })}
            </g>
          ) : null}
          <g className="options-tag-graph-nodes">
            {model.nodes.map((node) => {
              const isFocused = node.tagId === focusedTagId
              const isNeighbour = neighbourTagIds.has(node.tagId)
              const isDimmed = Boolean(focusedTagId) && !isFocused && !isNeighbour

              return (
                <g
                  key={node.tagId}
                  data-graph-node={node.tagId}
                  className={cn(
                    "options-tag-graph-node",
                    node.depth === 1 && "is-child",
                    isFocused && "is-focused",
                    isDimmed && "is-dimmed"
                  )}>
                  <circle
                    cx={toViewBoxX(node.x)}
                    cy={toViewBoxY(node.y)}
                    r={node.radius}
                    className="options-tag-graph-node-dot"
                  />
                  <text
                    x={toViewBoxX(node.x)}
                    y={toViewBoxY(node.y) - node.radius - 6}
                    className="options-tag-graph-node-label"
                    textAnchor="middle">
                    {node.name}
                  </text>
                </g>
              )
            })}
          </g>
          {showAuthors ? (
            <g className="options-tag-graph-author-nodes">
              {model.authorNodes.map((node) => {
                const isDimmed = Boolean(focusedAuthorHandles) && !focusedAuthorHandles?.has(node.authorHandle)

                return (
                  <g
                    key={`author:${node.authorHandle}`}
                    data-graph-author-node={node.authorHandle}
                    className={cn("options-tag-graph-author", isDimmed && "is-dimmed")}>
                    <circle
                      cx={toViewBoxX(node.x)}
                      cy={toViewBoxY(node.y)}
                      r={node.radius}
                      className="options-tag-graph-author-dot"
                    />
                    <text
                      x={toViewBoxX(node.x)}
                      y={toViewBoxY(node.y) + node.radius + 12}
                      className="options-tag-graph-author-label"
                      textAnchor="middle">
                      {`@${node.authorHandle}`}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : null}
        </svg>
      ) : null}

      {focusedNode ? (
        <div data-testid="tag-graph-focus-panel" className="options-tag-graph-focus">
          <div className="options-overline">{focusedNode.name}</div>
          <p className="options-meta-copy">
            {focusedNode.bookmarkCount} {copy.tagTableBookmarks} · {focusedNode.authorCount}{" "}
            {copy.graphAuthorsSuffix}
          </p>
          {focusedNode.topAuthors.length ? (
            <p data-testid="tag-graph-focus-authors" className="options-meta-copy">
              {focusedNode.topAuthors.map((author) => `@${author.authorHandle} (${author.count})`).join(", ")}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="tag-graph-open-bookmarks"
            className="options-secondary-button"
            onClick={() => onViewTagBookmarks(focusedNode.tagId)}>
            {copy.graphOpenBookmarks}
          </button>
        </div>
      ) : null}

      <ul data-testid="tag-graph-node-list" className="options-tag-graph-list">
        {model.nodes.map((node) => (
          <li key={node.tagId}>
            <button
              type="button"
              data-graph-node-button={node.tagId}
              className={cn(
                "options-tag-graph-chip",
                node.tagId === focusedTagId && "is-active",
                node.depth === 1 && "is-child"
              )}
              aria-pressed={node.tagId === focusedTagId}
              onClick={() => onFocusTag(node.tagId === focusedTagId ? null : node.tagId)}>
              {node.name}
              <span className="options-tag-graph-chip-count">{node.bookmarkCount}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
