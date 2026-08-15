import React from "react"
import type { BookmarkRecord, Locale, TagRecord, TagSuggestionRecord } from "../../lib/types.ts"
import type { BookmarkSortOrder } from "../../lib/search/searchBookmarks.ts"
import { AppIcon } from "../../ui/icons.tsx"
import type { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import type { OptionsCopy } from "../i18n/copy.ts"
import { cn } from "../utils.ts"
import { FeedLoadingState, FeedStatusCard } from "./common.tsx"
import { BookmarkCard } from "./BookmarkCard.tsx"
import { WorkspaceToolbar } from "./WorkspaceToolbar.tsx"

export function BulkActionsBar({
  copy,
  selectedCount,
  tags,
  bulkTagId,
  isSavingTags,
  onBulkTagIdChange,
  onSelectFiltered,
  onSelectRendered,
  onClearSelection,
  onApplyTag
}: {
  copy: OptionsCopy
  selectedCount: number
  tags: TagRecord[]
  bulkTagId: string
  isSavingTags: boolean
  onBulkTagIdChange: (tagId: string) => void
  onSelectFiltered: () => void
  onSelectRendered: () => void
  onClearSelection: () => void
  onApplyTag: () => void
}) {
  if (!selectedCount) {
    return null
  }

  return (
    <div data-testid="bulk-actions-bar" className="options-bulk-actions-bar options-theme-panel">
      <div className="options-bulk-actions-meta">
        <AppIcon name="check" size={14} />
        <span>{selectedCount} {copy.selected}</span>
      </div>
      <div className="options-bulk-actions-controls">
        <button type="button" data-testid="bulk-select-filtered" className="options-secondary-button" onClick={onSelectFiltered}>
          {copy.selectCurrentResults}
        </button>
        <button type="button" data-testid="bulk-select-rendered" className="options-secondary-button" onClick={onSelectRendered}>
          {copy.selectRenderedResults}
        </button>
        <select
          data-testid="bulk-tag-select"
          value={bulkTagId}
          aria-label={copy.chooseTag}
          className="field-shell options-bulk-tag-select"
          onChange={(event) => onBulkTagIdChange(event.currentTarget.value)}>
          <option value="">{copy.chooseTag}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="bulk-apply-tag"
          className="options-secondary-button"
          disabled={!bulkTagId || isSavingTags}
          onClick={onApplyTag}>
          <AppIcon name="tag" size={14} />
          {copy.applyTag}
        </button>
        <button type="button" data-testid="bulk-clear-selection" className="options-footer-icon-button" aria-label={copy.clearSelection} onClick={onClearSelection}>
          <AppIcon name="close" size={14} />
        </button>
      </div>
    </div>
  )
}

export function BookmarkResultsPane({
  workspace,
  isLoading,
  locale,
  copy,
  currentScopeLabel,
  searchId,
  query,
  setQuery,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
  filterPopoverOpen,
  setFilterPopoverOpen,
  onlyWithMedia,
  setOnlyWithMedia,
  onlyLongform,
  setOnlyLongform,
  selectedBookmarkId,
  setSelectedBookmarkId,
  visibleBookmarks,
  renderedBookmarks,
  activeRefinementChips,
  tagNamesByBookmarkId,
  pendingSuggestionsByBookmarkId,
  visiblePendingSuggestionCount,
  onAcceptSuggestion,
  onRejectSuggestion,
  onAcceptVisibleSuggestions,
  selectedBulkBookmarkIds,
  bulkTagId,
  onBulkTagIdChange,
  onBulkToggleBookmark,
  onSelectFilteredBookmarks,
  onSelectRenderedBookmarks,
  onClearBulkSelection,
  onApplyBulkTag,
  clearRefinement,
  onResultsScroll
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  isLoading: boolean
  locale: Locale
  copy: OptionsCopy
  currentScopeLabel: string
  searchId: string
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  sortOrder: BookmarkSortOrder
  setSortOrder: React.Dispatch<React.SetStateAction<BookmarkSortOrder>>
  viewMode: "grid" | "list"
  setViewMode: React.Dispatch<React.SetStateAction<"grid" | "list">>
  filterPopoverOpen: boolean
  setFilterPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>
  onlyWithMedia: boolean
  setOnlyWithMedia: React.Dispatch<React.SetStateAction<boolean>>
  onlyLongform: boolean
  setOnlyLongform: React.Dispatch<React.SetStateAction<boolean>>
  selectedBookmarkId: string | undefined
  setSelectedBookmarkId: React.Dispatch<React.SetStateAction<string | undefined>>
  visibleBookmarks: BookmarkRecord[]
  renderedBookmarks: BookmarkRecord[]
  activeRefinementChips: Array<{ key: string; label: string }>
  tagNamesByBookmarkId: Map<string, string[]>
  pendingSuggestionsByBookmarkId: Map<string, TagSuggestionRecord[]>
  visiblePendingSuggestionCount: number
  onAcceptSuggestion: (suggestionId: string) => void
  onRejectSuggestion: (suggestionId: string) => void
  onAcceptVisibleSuggestions: () => void
  selectedBulkBookmarkIds: Set<string>
  bulkTagId: string
  onBulkTagIdChange: (tagId: string) => void
  onBulkToggleBookmark: (bookmarkId: string) => void
  onSelectFilteredBookmarks: () => void
  onSelectRenderedBookmarks: () => void
  onClearBulkSelection: () => void
  onApplyBulkTag: () => void
  clearRefinement: (key: string) => void
  onResultsScroll: (event: React.UIEvent<HTMLDivElement>) => void
}) {
  const hasAnyBookmarks = workspace.bookmarks.length > 0
  const hasFeedRefinement = currentScopeLabel !== copy.allBookmarks || Boolean(query.trim()) || activeRefinementChips.length > 0
  const showLoadErrorState = Boolean(workspace.loadError) && !hasAnyBookmarks

  return (
    <section data-testid="library-workspace" className="options-main-shell min-h-[420px] min-w-0 overflow-hidden p-0 xl:h-[100dvh]">
      <div className="flex h-full min-h-0 flex-col">
        <div
          data-testid="library-results-scroll"
          className="scroll-shell min-h-0 flex-1 overflow-y-auto"
          onScroll={onResultsScroll}>
          <div
            data-testid="results-shell"
            className={cn(
              "options-results-shell options-theme-surface mx-auto w-full px-5 pb-10 pt-4 lg:px-8",
              viewMode === "grid" ? "options-results-shell-grid" : "options-results-shell-list"
            )}>
            <WorkspaceToolbar
              locale={locale}
              copy={copy}
              loadError={showLoadErrorState ? null : workspace.loadError}
              currentScopeLabel={currentScopeLabel}
              visibleBookmarksCount={visibleBookmarks.length}
              query={query}
              setQuery={setQuery}
              searchId={searchId}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              viewMode={viewMode}
              setViewMode={setViewMode}
              filterPopoverOpen={filterPopoverOpen}
              setFilterPopoverOpen={setFilterPopoverOpen}
              onlyWithMedia={onlyWithMedia}
              setOnlyWithMedia={setOnlyWithMedia}
              onlyLongform={onlyLongform}
              setOnlyLongform={setOnlyLongform}
              activeRefinementChips={activeRefinementChips}
              clearRefinement={clearRefinement}
            />

            <BulkActionsBar
              copy={copy}
              selectedCount={selectedBulkBookmarkIds.size}
              tags={workspace.tags}
              bulkTagId={bulkTagId}
              isSavingTags={workspace.isSavingTags}
              onBulkTagIdChange={onBulkTagIdChange}
              onSelectFiltered={onSelectFilteredBookmarks}
              onSelectRendered={onSelectRenderedBookmarks}
              onClearSelection={onClearBulkSelection}
              onApplyTag={onApplyBulkTag}
            />

            {visiblePendingSuggestionCount ? (
              <div data-testid="suggestions-actions-bar" className="options-bulk-actions-bar options-theme-panel">
                <div className="options-bulk-actions-meta">
                  <AppIcon name="tag" size={14} />
                  <span>
                    {visiblePendingSuggestionCount} {copy.pendingSuggestionsTitle}
                  </span>
                </div>
                <div className="options-bulk-actions-controls">
                  <button
                    type="button"
                    data-testid="suggestions-accept-all"
                    className="options-secondary-button"
                    disabled={workspace.isSavingTags}
                    onClick={onAcceptVisibleSuggestions}>
                    <AppIcon name="check" size={14} />
                    {copy.acceptAllSuggestions}
                  </button>
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <FeedLoadingState copy={copy} />
            ) : showLoadErrorState ? (
              <FeedStatusCard
                testId="feed-error-state"
                icon={<AppIcon name="sync" size={24} />}
                overline={copy.infoLabel}
                title={copy.loadFailedTitle}
                description={workspace.loadError ?? copy.loadFailedDescription}
                tone="error"
                action={
                  <button
                    type="button"
                    data-testid="feed-error-retry"
                    className="options-secondary-button"
                    onClick={() => void workspace.refreshData()}>
                    <AppIcon name="sync" size={16} />
                    {copy.retryLoad}
                  </button>
                }
              />
            ) : visibleBookmarks.length ? (
              <div
                data-testid="results-stack"
                className={cn(
                  "content-start",
                  viewMode === "grid"
                    ? "options-results-grid options-results-masonry options-results-stack-grid columns-1 lg:columns-2"
                    : "options-results-list options-results-stack-list flex flex-col"
                )}>
                {renderedBookmarks.map((bookmark, index) => {
                  const currentTagNames = tagNamesByBookmarkId.get(bookmark.tweetId) ?? []
                  const isSelected = selectedBookmarkId === bookmark.tweetId

                  return (
                    <BookmarkCard
                      key={bookmark.tweetId}
                      bookmark={bookmark}
                      index={index}
                      currentTagNames={currentTagNames}
                      pendingSuggestions={pendingSuggestionsByBookmarkId.get(bookmark.tweetId) ?? []}
                      selected={isSelected}
                      bulkSelected={selectedBulkBookmarkIds.has(bookmark.tweetId)}
                      viewMode={viewMode}
                      locale={locale}
                      copy={copy}
                      onSelect={() => setSelectedBookmarkId(bookmark.tweetId)}
                      onBulkToggle={() => onBulkToggleBookmark(bookmark.tweetId)}
                      onAcceptSuggestion={onAcceptSuggestion}
                      onRejectSuggestion={onRejectSuggestion}
                    />
                  )
                })}
              </div>
            ) : (
              <FeedStatusCard
                testId="feed-empty-state"
                icon={<AppIcon name={hasFeedRefinement ? "filter" : "bookmark"} size={24} />}
                overline={copy.infoLabel}
                title={hasAnyBookmarks || hasFeedRefinement ? copy.noBookmarksTitle : copy.emptyFeedTitle}
                description={hasAnyBookmarks || hasFeedRefinement ? copy.noBookmarksDescription : copy.emptyFeedDescription}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
