import React from "react"
import type { BookmarkSortOrder, MultiValueMatchMode, SavedTimeRange } from "../../lib/search/searchBookmarks.ts"
import type { FolderRecord, TagRecord } from "../../lib/types.ts"

interface AuthorOption {
  handle: string
  label: string
  count: number
}

interface InboxWorkbenchToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  sortOrder: BookmarkSortOrder
  onSortOrderChange: (sortOrder: BookmarkSortOrder) => void
  timeRange: SavedTimeRange
  onTimeRangeChange: (timeRange: SavedTimeRange) => void
  onlyWithMedia: boolean
  onOnlyWithMediaChange: (value: boolean) => void
  onlyLongform: boolean
  onOnlyLongformChange: (value: boolean) => void
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
  resultCount: number
  totalCount: number
  selectedCount: number
  onSelectAllVisible: () => void
  onClearSelection: () => void
  bulkFolderId: string
  onBulkFolderIdChange: (folderId: string) => void
  bulkTagId: string
  onBulkTagIdChange: (tagId: string) => void
  folders: FolderRecord[]
  onBulkMove: () => void
  onBulkTag: () => void
  isSavingFolder: boolean
  isSavingTag: boolean
  showAdvancedFilters: boolean
  onToggleAdvancedFilters: () => void
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

export function InboxWorkbenchToolbar({
  query,
  onQueryChange,
  sortOrder,
  onSortOrderChange,
  timeRange,
  onTimeRangeChange,
  onlyWithMedia,
  onOnlyWithMediaChange,
  onlyLongform,
  onOnlyLongformChange,
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
  resultCount,
  totalCount,
  selectedCount,
  onSelectAllVisible,
  onClearSelection,
  bulkFolderId,
  onBulkFolderIdChange,
  bulkTagId,
  onBulkTagIdChange,
  folders,
  onBulkMove,
  onBulkTag,
  isSavingFolder,
  isSavingTag,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onClearFilters
}: InboxWorkbenchToolbarProps) {
  const selectionDisabled = selectedCount === 0
  const advancedFilterCount = selectedAuthorHandles.length + selectedTagIds.length

  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: 16,
        border: "1px solid #d7e3ee",
        borderRadius: 16,
        background: "#ffffff"
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h3 style={{ margin: 0, fontSize: 20 }}>Inbox workbench</h3>
          <p style={{ margin: 0, color: "#52606d" }}>
            {resultCount} visible of {totalCount} total bookmarks
          </p>
        </div>
        <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{selectedCount} selected</p>
          <p style={{ margin: 0, fontSize: 13, color: "#52606d" }}>Bulk actions stay scoped to the current table view.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, minWidth: 240, flex: "1 1 240px" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Search</span>
          <input
            type="search"
            value={query}
            placeholder="Search bookmarks"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Sort</span>
          <select value={sortOrder} onChange={(event) => onSortOrderChange(event.target.value as BookmarkSortOrder)}>
            <option value="saved-desc">Newest saved</option>
            <option value="saved-asc">Oldest saved</option>
            <option value="created-desc">Newest on X</option>
            <option value="likes-desc">Most likes</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Saved time</span>
          <select value={timeRange} onChange={(event) => onTimeRangeChange(event.target.value as SavedTimeRange)}>
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 6 }}>
          <input type="checkbox" checked={onlyWithMedia} onChange={(event) => onOnlyWithMediaChange(event.target.checked)} />
          <span>Only with media</span>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 6 }}>
          <input type="checkbox" checked={onlyLongform} onChange={(event) => onOnlyLongformChange(event.target.checked)} />
          <span>Only longform</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <button type="button" onClick={onToggleAdvancedFilters}>
          {showAdvancedFilters ? "Hide filters" : `More filters${advancedFilterCount ? ` (${advancedFilterCount})` : ""}`}
        </button>
        <button type="button" onClick={onClearFilters}>
          Clear filters
        </button>
        <button type="button" onClick={onSelectAllVisible} disabled={!resultCount}>
          Select all visible
        </button>
        <button type="button" onClick={onClearSelection} disabled={selectionDisabled}>
          Clear selection
        </button>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Move selected to</span>
          <select value={bulkFolderId} onChange={(event) => onBulkFolderIdChange(event.target.value)}>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onBulkMove} disabled={selectionDisabled || !bulkFolderId || isSavingFolder}>
          Move selected
        </button>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Tag selected with</span>
          <select value={bulkTagId} onChange={(event) => onBulkTagIdChange(event.target.value)}>
            <option value="">Select a tag</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onBulkTag} disabled={selectionDisabled || !bulkTagId || isSavingTag}>
          Apply tag
        </button>
      </div>

      {showAdvancedFilters ? (
        <section
          style={{
            display: "grid",
            gap: 16,
            padding: 16,
            border: "1px solid #e6edf5",
            borderRadius: 12,
            background: "#f8fbfd"
          }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h4 style={{ margin: 0 }}>Author filters</h4>
              {renderMatchModeControl({
                id: "author-match-mode",
                value: authorMatchMode,
                onChange: onAuthorMatchModeChange
              })}
            </div>
            {!authorOptions.length ? <p style={{ margin: 0, color: "#52606d" }}>No authors available.</p> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {authorOptions.map((author) => (
                <label
                  key={author.handle}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 10px",
                    border: "1px solid #d9e2ec",
                    borderRadius: 999
                  }}>
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
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h4 style={{ margin: 0 }}>Tag filters</h4>
              {renderMatchModeControl({
                id: "tag-match-mode",
                value: tagMatchMode,
                onChange: onTagMatchModeChange
              })}
            </div>
            {!tags.length ? <p style={{ margin: 0, color: "#52606d" }}>No tags available.</p> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 10px",
                    border: "1px solid #d9e2ec",
                    borderRadius: 999
                  }}>
                  <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => onToggleTag(tag.id)} />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}
