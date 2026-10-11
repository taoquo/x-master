import React from "react"
import type { BookmarkSortOrder } from "../../lib/search/searchBookmarks.ts"
import { AppIcon } from "../../ui/icons.tsx"
import type { OptionsCopy } from "../i18n/copy.ts"
import { cn, getNextSortOrder, getSortLabel } from "../utils.ts"
import { InlineMessage, TextInputField } from "./common.tsx"

export function WorkspaceToolbar({
  copy,
  loadError,
  currentScopeLabel,
  visibleBookmarksCount,
  query,
  setQuery,
  searchId,
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
  activeRefinementChips,
  clearRefinement
}: {
  copy: OptionsCopy
  loadError: string | null
  currentScopeLabel: string
  visibleBookmarksCount: number
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  searchId: string
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
  activeRefinementChips: Array<{ key: string; label: string }>
  clearRefinement: (key: string) => void
}) {
  const activeFilterCount = Number(onlyWithMedia) + Number(onlyLongform)

  return (
    <div data-testid="library-header-section" className="options-main-header space-y-4">
      <div className="options-main-header-top">
        <div className="options-main-header-row">
          <div className="options-main-header-copy min-w-0">
            <div className="options-overline">{copy.libraryTitle}</div>
            <h2 className="options-display-title-sm mt-3 truncate font-bold">{currentScopeLabel}</h2>
          </div>
          <div className="options-main-header-summary text-right">
            <div data-testid="results-count" className="options-results-value options-main-header-summary-value font-bold">{visibleBookmarksCount}</div>
            <div className="options-overline options-main-header-summary-label mt-1">{copy.results}</div>
          </div>
        </div>
      </div>

      <InlineMessage message={loadError} />

      <div data-testid="workspace-toolbar" className="options-toolbar-shell folio-filter-bar options-theme-panel">
        <div className="options-toolbar-primary">
          <div className="options-toolbar-search relative min-w-0 flex-1">
            <AppIcon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <TextInputField
              id={searchId}
              ariaLabel={copy.search}
              type="search"
              value={query}
              placeholder={copy.searchPlaceholder}
              onChange={setQuery}
              className="workspace-input options-toolbar-field options-toolbar-field-compact pl-10 pr-4"
            />
          </div>

          <div className="options-toolbar-controls options-toolbar-inline">
            <div className="relative">
              <button
                type="button"
              data-testid="filter-trigger"
                className="options-toolbar-action"
                aria-expanded={filterPopoverOpen}
                onClick={() => setFilterPopoverOpen((current) => !current)}>
                <AppIcon name="filter" size={14} />
                <span>{copy.filters}</span>
                {activeFilterCount ? <span className="options-toolbar-badge">{activeFilterCount}</span> : null}
              </button>

              {filterPopoverOpen ? (
                <div data-testid="filter-popover" className="options-filter-popover options-theme-elevated">
                  <div className="space-y-1.5 pb-3">
                    <h4 className="text-sm font-medium leading-none text-[var(--text-primary)]">{copy.filterConditions}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">{copy.filterDescription}</p>
                  </div>
                  <label data-testid="filter-option-media" className="options-filter-row">
                    <input
                      type="checkbox"
                      checked={onlyWithMedia}
                      onChange={(event) => setOnlyWithMedia(event.currentTarget.checked)}
                    />
                    <span>{copy.hasMedia}</span>
                  </label>
                  <label data-testid="filter-option-longform" className="options-filter-row">
                    <input
                      type="checkbox"
                      checked={onlyLongform}
                      onChange={(event) => setOnlyLongform(event.currentTarget.checked)}
                    />
                    <span>{copy.longform}</span>
                  </label>
                  <label data-testid="filter-option-unread" className="options-filter-row is-disabled">
                    <input type="checkbox" disabled />
                    <span>{copy.unread}</span>
                  </label>
                  <label data-testid="filter-option-archived" className="options-filter-row is-disabled">
                    <input type="checkbox" disabled />
                    <span>{copy.archived}</span>
                  </label>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              data-testid="sort-trigger"
              className="options-toolbar-action"
              onClick={() => setSortOrder((current) => getNextSortOrder(current))}>
              <AppIcon name="sort" size={14} />
              <span>{getSortLabel(copy, sortOrder)}</span>
            </button>

            <span className="options-toolbar-divider" aria-hidden="true" />

            <div className="options-view-toggle-group">
              <button
                type="button"
                data-testid="view-toggle-grid"
                className={cn("options-view-toggle", viewMode === "grid" && "is-active")}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}>
                <AppIcon name="grid" size={16} />
              </button>
              <button
                type="button"
                data-testid="view-toggle-list"
                className={cn("options-view-toggle", viewMode === "list" && "is-active")}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}>
                <AppIcon name="list" size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="options-toolbar-summary-row options-toolbar-context-row">
          <div data-testid="active-filters-row" className="options-active-filters">
            <span className="options-active-filters-label">{copy.activeFilters}</span>
            {activeRefinementChips.length ? (
              <>
                {activeRefinementChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => clearRefinement(chip.key)}
                    className="chip-button options-chip options-theme-elevated !px-3 !py-1.5 !text-xs">
                    <span>{chip.label}</span>
                    <AppIcon name="close" size={12} />
                  </button>
                ))}
              </>
            ) : (
              <span className="options-active-filters-empty" aria-hidden="true" />
            )}
          </div>
          <span data-testid="library-results-summary" className="options-toolbar-results-meta">
            {visibleBookmarksCount} {copy.results}
          </span>
        </div>
      </div>
    </div>
  )
}
