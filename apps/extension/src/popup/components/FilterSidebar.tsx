import React from "react"
import type { BookmarkSortOrder, MultiValueMatchMode, SavedTimeRange } from "../../lib/search/searchBookmarks.ts"
import type { FolderRecord, TagRecord } from "../../lib/types.ts"
import { SearchBar } from "./SearchBar.tsx"

interface AuthorOption {
  handle: string
  label: string
  count: number
}

interface FolderTreeNode extends FolderRecord {
  children: FolderTreeNode[]
}

type FilterSectionKey = "folders" | "authors" | "tags" | "time" | "content" | "sort"

interface FilterSidebarProps {
  query: string
  onQueryChange: (query: string) => void
  folderTree: FolderTreeNode[]
  selectedFolderId?: string
  onSelectFolder: (folderId?: string) => void
  authorOptions: AuthorOption[]
  selectedAuthorHandles: string[]
  authorMatchMode: MultiValueMatchMode
  onToggleAuthor: (authorHandle: string) => void
  onAuthorMatchModeChange: (matchMode: MultiValueMatchMode) => void
  tags: TagRecord[]
  selectedTagIds: string[]
  tagMatchMode: MultiValueMatchMode
  onToggleTag: (tagId: string) => void
  onTagMatchModeChange: (matchMode: MultiValueMatchMode) => void
  timeRange: SavedTimeRange
  onTimeRangeChange: (timeRange: SavedTimeRange) => void
  onlyWithMedia: boolean
  onOnlyWithMediaChange: (value: boolean) => void
  onlyLongform: boolean
  onOnlyLongformChange: (value: boolean) => void
  sortOrder: BookmarkSortOrder
  onSortOrderChange: (sortOrder: BookmarkSortOrder) => void
  collapsedSections: Record<FilterSectionKey, boolean>
  onToggleSection: (section: FilterSectionKey) => void
  onClearFilters: () => void
}

function renderMatchModeControl({
  id,
  value,
  onChange
}: {
  id: string
  value: MultiValueMatchMode
  onChange: (nextValue: MultiValueMatchMode) => void
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as MultiValueMatchMode)}>
      <option value="any">Match any</option>
      <option value="all">Match all</option>
    </select>
  )
}

function renderSectionHeader({
  title,
  summary,
  isCollapsed,
  onToggle
}: {
  title: string
  summary: string
  isCollapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "8px 0",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid #e6edf5",
        textAlign: "left",
        cursor: "pointer"
      }}>
      <span style={{ fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: "#52606d" }}>
        {summary} {isCollapsed ? "▸" : "▾"}
      </span>
    </button>
  )
}

function FolderNode({
  node,
  depth,
  selectedFolderId,
  onSelectFolder
}: {
  node: FolderTreeNode
  depth: number
  selectedFolderId?: string
  onSelectFolder: (folderId?: string) => void
}) {
  const isSelected = node.id === selectedFolderId

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button
        type="button"
        onClick={() => onSelectFolder(node.id)}
        style={{
          marginLeft: depth * 14,
          padding: "6px 10px",
          borderRadius: 8,
          border: isSelected ? "1px solid #486581" : "1px solid #d9e2ec",
          background: isSelected ? "#e3f2fd" : "#ffffff",
          textAlign: "left"
        }}>
        {node.name}
      </button>
      {node.children.map((childNode) => (
        <FolderNode
          key={childNode.id}
          node={childNode}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  )
}

export function FilterSidebar({
  query,
  onQueryChange,
  folderTree,
  selectedFolderId,
  onSelectFolder,
  authorOptions,
  selectedAuthorHandles,
  authorMatchMode,
  onToggleAuthor,
  onAuthorMatchModeChange,
  tags,
  selectedTagIds,
  tagMatchMode,
  onToggleTag,
  onTagMatchModeChange,
  timeRange,
  onTimeRangeChange,
  onlyWithMedia,
  onOnlyWithMediaChange,
  onlyLongform,
  onOnlyLongformChange,
  sortOrder,
  onSortOrderChange,
  collapsedSections,
  onToggleSection,
  onClearFilters
}: FilterSidebarProps) {
  return (
    <aside
      style={{
        display: "grid",
        alignContent: "start",
        gap: 16,
        minHeight: 0,
        padding: 16,
        border: "1px solid #d7e3ee",
        borderRadius: 16,
        background: "#ffffff",
        overflowY: "auto"
      }}>
      <header style={{ display: "grid", gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Organize</h2>
        <p style={{ margin: 0, color: "#52606d" }}>Inbox first, folders for structure, tags for cross-cutting labels.</p>
      </header>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Search</h3>
        <SearchBar query={query} onQueryChange={onQueryChange} />
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {renderSectionHeader({
          title: "Folders",
          summary: selectedFolderId ? "1 selected" : "All folders",
          isCollapsed: collapsedSections.folders,
          onToggle: () => onToggleSection("folders")
        })}
        {!collapsedSections.folders ? (
          <div style={{ display: "grid", gap: 8 }}>
            <button type="button" onClick={() => onSelectFolder(undefined)}>
              Show all folders
            </button>
            {folderTree.map((folderNode) => (
              <FolderNode
                key={folderNode.id}
                node={folderNode}
                depth={0}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {renderSectionHeader({
          title: "Authors",
          summary: selectedAuthorHandles.length ? `${selectedAuthorHandles.length} selected` : "Any author",
          isCollapsed: collapsedSections.authors,
          onToggle: () => onToggleSection("authors")
        })}
        {!collapsedSections.authors ? (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#52606d" }}>Author logic</span>
              {renderMatchModeControl({
                id: "author-match-mode",
                value: authorMatchMode,
                onChange: onAuthorMatchModeChange
              })}
            </label>
            {!authorOptions.length ? <p style={{ margin: 0, color: "#52606d" }}>No authors available.</p> : null}
            {authorOptions.map((author) => (
              <label key={author.handle} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={selectedAuthorHandles.includes(author.handle)}
                  onChange={() => onToggleAuthor(author.handle)}
                />
                <span>
                  {author.label} ({author.count})
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {renderSectionHeader({
          title: "Tags",
          summary: selectedTagIds.length ? `${tagMatchMode} · ${selectedTagIds.length} selected` : "Any tag",
          isCollapsed: collapsedSections.tags,
          onToggle: () => onToggleSection("tags")
        })}
        {!collapsedSections.tags ? (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#52606d" }}>Tag logic</span>
              {renderMatchModeControl({
                id: "tag-match-mode",
                value: tagMatchMode,
                onChange: onTagMatchModeChange
              })}
            </label>
            {!tags.length ? <p style={{ margin: 0, color: "#52606d" }}>No tags available.</p> : null}
            {tags.map((tag) => (
              <label key={tag.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => onToggleTag(tag.id)} />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {renderSectionHeader({
          title: "Saved time",
          summary:
            timeRange === "all"
              ? "All time"
              : timeRange === "7d"
                ? "Last 7 days"
                : timeRange === "30d"
                  ? "Last 30 days"
                  : "Last 90 days",
          isCollapsed: collapsedSections.time,
          onToggle: () => onToggleSection("time")
        })}
        {!collapsedSections.time ? (
          <label>
            <span style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#52606d" }}>Range</span>
            <select value={timeRange} onChange={(event) => onTimeRangeChange(event.target.value as SavedTimeRange)}>
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </label>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {renderSectionHeader({
          title: "Content",
          summary:
            onlyWithMedia || onlyLongform
              ? `${onlyWithMedia ? "media" : ""}${onlyWithMedia && onlyLongform ? " · " : ""}${onlyLongform ? "longform" : ""}`
              : "All content",
          isCollapsed: collapsedSections.content,
          onToggle: () => onToggleSection("content")
        })}
        {!collapsedSections.content ? (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={onlyWithMedia} onChange={(event) => onOnlyWithMediaChange(event.target.checked)} />
              <span>Only with media</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={onlyLongform} onChange={(event) => onOnlyLongformChange(event.target.checked)} />
              <span>Only longform</span>
            </label>
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {renderSectionHeader({
          title: "Sort",
          summary:
            sortOrder === "saved-desc"
              ? "Newest saved"
              : sortOrder === "saved-asc"
                ? "Oldest saved"
                : sortOrder === "created-desc"
                  ? "Newest on X"
                  : "Most likes",
          isCollapsed: collapsedSections.sort,
          onToggle: () => onToggleSection("sort")
        })}
        {!collapsedSections.sort ? (
          <select value={sortOrder} onChange={(event) => onSortOrderChange(event.target.value as BookmarkSortOrder)}>
            <option value="saved-desc">Newest saved</option>
            <option value="saved-asc">Oldest saved</option>
            <option value="created-desc">Newest on X</option>
            <option value="likes-desc">Most likes</option>
          </select>
        ) : null}
      </section>

      <button type="button" onClick={onClearFilters}>
        Clear filters
      </button>
    </aside>
  )
}
