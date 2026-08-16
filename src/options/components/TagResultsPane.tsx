import React, { useState } from "react"
import type { Locale } from "../../lib/types.ts"
import {
  mergePlanKey,
  renamePlanKey,
  type TagMergePlan,
  type TagRenamePlan
} from "../../lib/autotag/vocabularyReview.ts"
import { AppIcon } from "../../ui/icons.tsx"
import type { OptionsCopy } from "../i18n/copy.ts"
import {
  countOrphanTags,
  type TagLibraryFilter,
  type TagLibraryItem,
  type TagLibrarySortOrder
} from "../tagLibrary.ts"
import { cn, createFieldId, formatTimestamp, getSectionOverline } from "../utils.ts"
import { FeedStatusCard, InlineMessage, TextInputField } from "./common.tsx"

function getTagSortLabel(copy: OptionsCopy, sortOrder: TagLibrarySortOrder) {
  if (sortOrder === "count-asc") {
    return copy.tagSortFewestBookmarks
  }

  if (sortOrder === "name-asc") {
    return copy.tagSortName
  }

  if (sortOrder === "recent") {
    return copy.tagSortRecent
  }

  return copy.tagSortMostBookmarks
}

export interface TagResultsPaneProps {
  locale: Locale
  copy: OptionsCopy
  loadError: string | null
  isSavingTags: boolean
  tagItems: TagLibraryItem[]
  visibleTagItems: TagLibraryItem[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  filter: TagLibraryFilter
  onFilterChange: (filter: TagLibraryFilter) => void
  sortOrder: TagLibrarySortOrder
  onSortOrderChange: (sortOrder: TagLibrarySortOrder) => void
  viewMode: "grid" | "table"
  onViewModeChange: (viewMode: "grid" | "table") => void
  filterPopoverOpen: boolean
  onFilterPopoverOpenChange: (open: boolean) => void
  selectedTagIds: Set<string>
  mergeTargetTagId: string
  onToggleTagSelection: (tagId: string) => void
  onSelectListedTags: () => void
  onClearTagSelection: () => void
  onMergeTargetChange: (tagId: string) => void
  onMergeSelectedTags: () => void
  onDeleteSelectedTags: () => void
  onRenameTag: (tagId: string, name: string) => Promise<unknown>
  onDeleteTag: (tagId: string, tagName: string) => void
  onViewTagBookmarks: (tagId: string) => void
  onExitTagManagement: () => void
  reviewStatus: "idle" | "running" | "ready" | "error"
  reviewError?: string
  reviewMerges: TagMergePlan[]
  reviewRenames: TagRenamePlan[]
  selectedReviewKeys: Set<string>
  onReviewVocabulary: () => void
  onToggleReviewSelection: (key: string) => void
  onApplyReview: () => void
  onDismissReview: () => void
}

export function TagResultsPane({
  locale,
  copy,
  loadError,
  isSavingTags,
  tagItems,
  visibleTagItems,
  searchQuery,
  onSearchQueryChange,
  filter,
  onFilterChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
  filterPopoverOpen,
  onFilterPopoverOpenChange,
  selectedTagIds,
  mergeTargetTagId,
  onToggleTagSelection,
  onSelectListedTags,
  onClearTagSelection,
  onMergeTargetChange,
  onMergeSelectedTags,
  onDeleteSelectedTags,
  onRenameTag,
  onDeleteTag,
  onViewTagBookmarks,
  onExitTagManagement,
  reviewStatus,
  reviewError,
  reviewMerges,
  reviewRenames,
  selectedReviewKeys,
  onReviewVocabulary,
  onToggleReviewSelection,
  onApplyReview,
  onDismissReview
}: TagResultsPaneProps) {
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)
  const [renamingTagName, setRenamingTagName] = useState("")
  const [isSubmittingRename, setIsSubmittingRename] = useState(false)
  const searchId = createFieldId("tags", "search")
  const sortId = createFieldId("tags", "sort")
  const orphanCount = countOrphanTags(tagItems)
  const selectedCount = selectedTagIds.size
  const activeFilterCount = filter === "all" ? 0 : 1
  const reviewProposalCount = reviewMerges.length + reviewRenames.length

  function startRename(item: TagLibraryItem) {
    setRenamingTagId(item.tagId)
    setRenamingTagName(item.name)
  }

  function cancelRename() {
    setRenamingTagId(null)
    setRenamingTagName("")
  }

  async function submitRename(tagId: string, nextName: string) {
    const trimmed = nextName.trim()
    if (!trimmed) {
      cancelRename()
      return
    }

    setIsSubmittingRename(true)
    try {
      await onRenameTag(tagId, trimmed)
    } finally {
      setIsSubmittingRename(false)
      cancelRename()
    }
  }

  function renderRenameInput(item: TagLibraryItem) {
    return (
      <input
        autoFocus
        type="text"
        value={renamingTagName}
        data-testid="tag-rename-input"
        aria-label={`${copy.renameTagLabel} ${item.name}`}
        disabled={isSubmittingRename}
        className="options-nav-row-input options-tag-rename-input"
        onChange={(event) => setRenamingTagName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            void submitRename(item.tagId, event.currentTarget.value)
            return
          }

          if (event.key === "Escape") {
            event.preventDefault()
            cancelRename()
          }
        }}
        onBlur={(event) => {
          void submitRename(item.tagId, event.currentTarget.value)
        }}
      />
    )
  }

  function renderRowActions(item: TagLibraryItem) {
    return (
      <span className="options-tag-card-actions">
        <button
          type="button"
          data-testid="tag-view-bookmarks"
          className="options-nav-row-delete"
          aria-label={`${copy.viewTagBookmarks} ${item.name}`}
          onClick={() => onViewTagBookmarks(item.tagId)}>
          <AppIcon name="search" size={12} />
        </button>
        <button
          type="button"
          data-testid="tag-rename"
          className="options-nav-row-delete"
          aria-label={`${copy.renameTagLabel} ${item.name}`}
          onClick={() => startRename(item)}>
          <AppIcon name="edit" size={12} />
        </button>
        <button
          type="button"
          data-testid="tag-delete"
          className="options-nav-row-delete"
          aria-label={`${copy.deleteLabel} ${item.name}`}
          onClick={() => onDeleteTag(item.tagId, item.name)}>
          <AppIcon name="trash" size={12} />
        </button>
      </span>
    )
  }

  return (
    <section
      data-testid="tag-library-workspace"
      className="options-main-shell min-h-[420px] min-w-0 overflow-hidden p-0 xl:h-[100dvh]">
      <div className="flex h-full min-h-0 flex-col">
        <div data-testid="tag-library-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto">
          <div
            data-testid="tag-results-shell"
            className={cn(
              "options-results-shell options-theme-surface mx-auto w-full px-5 pb-10 pt-4 lg:px-8",
              viewMode === "grid" ? "options-results-shell-grid" : "options-results-shell-list"
            )}>
            <div data-testid="tag-header-section" className="options-main-header space-y-4">
              <div className="options-main-header-top">
                <div className="options-main-header-row">
                  <div className="options-main-header-copy min-w-0">
                    <div className="options-overline">{getSectionOverline(locale, copy.tagLibrary, "Taxonomy")}</div>
                    <h2 className="options-display-title-sm mt-3 truncate font-bold">{copy.manageTagsLabel}</h2>
                    <div data-testid="tag-header-meta" className="options-meta-copy options-tag-header-meta">
                      {tagItems.length} {copy.tagsCountSuffix} · {orphanCount} {copy.orphanTagsSuffix}
                    </div>
                  </div>
                  <div className="options-main-header-summary text-right">
                    <div data-testid="tag-count" className="options-results-value options-main-header-summary-value font-bold">
                      {tagItems.length}
                    </div>
                    <div className="options-overline options-main-header-summary-label mt-1">{copy.tagsCountSuffix}</div>
                  </div>
                </div>
              </div>

              <InlineMessage message={loadError} />

              <div data-testid="tag-toolbar" className="options-toolbar-shell folio-filter-bar options-theme-panel">
                <div className="options-toolbar-primary">
                  <div className="options-toolbar-search relative min-w-0 flex-1">
                    <AppIcon
                      name="search"
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <TextInputField
                      id={searchId}
                      dataTestId="tag-search-input"
                      ariaLabel={copy.searchTags}
                      type="search"
                      value={searchQuery}
                      placeholder={copy.searchTagsPlaceholder}
                      onChange={onSearchQueryChange}
                      className="workspace-input options-toolbar-field options-toolbar-field-compact pl-10 pr-4"
                    />
                  </div>

                  <div className="options-toolbar-controls options-toolbar-inline">
                    <button
                      type="button"
                      data-testid="tag-exit-management"
                      className="options-toolbar-action"
                      onClick={onExitTagManagement}>
                      <AppIcon name="back" size={14} />
                      <span>{copy.exitTagManagement}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="tag-review-vocabulary"
                      className="options-toolbar-action"
                      disabled={reviewStatus === "running" || isSavingTags}
                      onClick={onReviewVocabulary}>
                      <AppIcon name="sparkle" size={14} />
                      <span>{reviewStatus === "running" ? copy.reviewVocabularyRunning : copy.reviewVocabularyLabel}</span>
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        data-testid="tag-filter-trigger"
                        className="options-toolbar-action"
                        aria-expanded={filterPopoverOpen}
                        onClick={() => onFilterPopoverOpenChange(!filterPopoverOpen)}>
                        <AppIcon name="filter" size={14} />
                        <span>{copy.filters}</span>
                        {activeFilterCount ? <span className="options-toolbar-badge">{activeFilterCount}</span> : null}
                      </button>

                      {filterPopoverOpen ? (
                        <div data-testid="tag-filter-popover" className="options-filter-popover options-theme-elevated">
                          <div className="space-y-1.5 pb-3">
                            <h4 className="text-sm font-medium leading-none text-[var(--text-primary)]">{copy.filterConditions}</h4>
                            <p className="text-xs text-[var(--text-secondary)]">{copy.filterDescription}</p>
                          </div>
                          {(
                            [
                              ["all", copy.tagFilterAll],
                              ["orphan", copy.tagFilterOrphan],
                              ["pending", copy.tagFilterPending]
                            ] as Array<[TagLibraryFilter, string]>
                          ).map(([value, label]) => (
                            <label key={value} data-testid={`tag-filter-option-${value}`} className="options-filter-row">
                              <input
                                type="radio"
                                name="tag-library-filter"
                                checked={filter === value}
                                onChange={() => onFilterChange(value)}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <label className="options-tag-sort-field" htmlFor={sortId}>
                      <AppIcon name="sort" size={14} />
                      <span className="sr-only">{copy.sortBy}</span>
                      <select
                        id={sortId}
                        data-testid="tag-sort-select"
                        value={sortOrder}
                        aria-label={copy.sortBy}
                        className="options-tag-sort-select"
                        onChange={(event) => onSortOrderChange(event.currentTarget.value as TagLibrarySortOrder)}>
                        <option value="count-desc">{copy.tagSortMostBookmarks}</option>
                        <option value="count-asc">{copy.tagSortFewestBookmarks}</option>
                        <option value="name-asc">{copy.tagSortName}</option>
                        <option value="recent">{copy.tagSortRecent}</option>
                      </select>
                    </label>

                    <span className="options-toolbar-divider" aria-hidden="true" />

                    <div className="options-view-toggle-group">
                      <button
                        type="button"
                        data-testid="tag-view-toggle-grid"
                        className={cn("options-view-toggle", viewMode === "grid" && "is-active")}
                        aria-pressed={viewMode === "grid"}
                        aria-label={copy.tagViewGrid}
                        onClick={() => onViewModeChange("grid")}>
                        <AppIcon name="grid" size={16} />
                      </button>
                      <button
                        type="button"
                        data-testid="tag-view-toggle-table"
                        className={cn("options-view-toggle", viewMode === "table" && "is-active")}
                        aria-pressed={viewMode === "table"}
                        aria-label={copy.tagViewTable}
                        onClick={() => onViewModeChange("table")}>
                        <AppIcon name="table" size={16} />
                      </button>
                      <button
                        type="button"
                        disabled
                        data-testid="tag-view-toggle-graph"
                        className="options-view-toggle"
                        aria-label={copy.tagGraphSoon}
                        title={copy.tagGraphSoon}>
                        <AppIcon name="graph" size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="options-toolbar-summary-row options-toolbar-context-row">
                  <div className="options-active-filters">
                    <span className="options-active-filters-label">{copy.activeFilters}</span>
                    {filter === "all" ? (
                      <span className="options-active-filters-empty" aria-hidden="true" />
                    ) : (
                      <button
                        type="button"
                        data-testid="tag-filter-chip"
                        onClick={() => onFilterChange("all")}
                        className="chip-button options-chip options-theme-elevated !px-3 !py-1.5 !text-xs">
                        <span>{filter === "orphan" ? copy.tagFilterOrphan : copy.tagFilterPending}</span>
                        <AppIcon name="close" size={12} />
                      </button>
                    )}
                  </div>
                  <span data-testid="tag-results-summary" className="options-toolbar-results-meta">
                    {visibleTagItems.length} {copy.tagsCountSuffix} · {getTagSortLabel(copy, sortOrder)}
                  </span>
                </div>
              </div>
            </div>

            {reviewStatus !== "idle" ? (
              <div data-testid="tag-review-panel" className="options-tag-review-panel options-theme-panel">
                <div className="options-tag-review-head">
                  <div className="options-tag-review-copy">
                    <div className="options-overline">{copy.reviewVocabularyTitle}</div>
                    <p className="options-meta-copy">{copy.reviewVocabularyDescription}</p>
                  </div>
                  <button
                    type="button"
                    data-testid="tag-review-dismiss"
                    className="options-footer-icon-button"
                    aria-label={copy.reviewDismissLabel}
                    onClick={onDismissReview}>
                    <AppIcon name="close" size={14} />
                  </button>
                </div>

                {reviewStatus === "error" ? (
                  <InlineMessage message={`${copy.reviewVocabularyFailedPrefix}: ${reviewError ?? ""}`} tone="error" />
                ) : null}

                {reviewStatus === "ready" && !reviewProposalCount ? (
                  <p data-testid="tag-review-empty" className="options-meta-copy">
                    {copy.reviewVocabularyEmpty}
                  </p>
                ) : null}

                {reviewProposalCount ? (
                  <>
                    <ul data-testid="tag-review-list" className="options-tag-review-list">
                      {reviewMerges.map((plan) => {
                        const key = mergePlanKey(plan)
                        return (
                          <li key={key} data-review-key={key} className="options-tag-review-row">
                            <label className="options-tag-review-check">
                              <input
                                type="checkbox"
                                checked={selectedReviewKeys.has(key)}
                                onChange={() => onToggleReviewSelection(key)}
                              />
                              <span className="options-tag-review-kind">{copy.reviewMergeLabel}</span>
                              <span className="options-tag-review-body">
                                {plan.sourceNames.join(", ")} → {plan.targetName}
                              </span>
                            </label>
                            {plan.reason ? <span className="options-meta-copy">{plan.reason}</span> : null}
                          </li>
                        )
                      })}
                      {reviewRenames.map((plan) => {
                        const key = renamePlanKey(plan)
                        return (
                          <li key={key} data-review-key={key} className="options-tag-review-row">
                            <label className="options-tag-review-check">
                              <input
                                type="checkbox"
                                checked={selectedReviewKeys.has(key)}
                                onChange={() => onToggleReviewSelection(key)}
                              />
                              <span className="options-tag-review-kind">{copy.reviewRenameLabel}</span>
                              <span className="options-tag-review-body">
                                {plan.from} → {plan.to}
                              </span>
                            </label>
                            {plan.reason ? <span className="options-meta-copy">{plan.reason}</span> : null}
                          </li>
                        )
                      })}
                    </ul>
                    <div className="options-tag-review-actions">
                      <button
                        type="button"
                        data-testid="tag-review-apply"
                        className="options-secondary-button"
                        disabled={!selectedReviewKeys.size || isSavingTags}
                        onClick={onApplyReview}>
                        <AppIcon name="check" size={14} />
                        {copy.reviewApplyLabel}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {selectedCount ? (
              <div data-testid="tag-bulk-actions-bar" className="options-bulk-actions-bar options-theme-panel">
                <div className="options-bulk-actions-meta">
                  <AppIcon name="check" size={14} />
                  <span>
                    {selectedCount} {copy.selected}
                  </span>
                </div>
                <div className="options-bulk-actions-controls">
                  <button
                    type="button"
                    data-testid="tag-bulk-select-listed"
                    className="options-secondary-button"
                    onClick={onSelectListedTags}>
                    {copy.selectAllTags}
                  </button>
                  <select
                    data-testid="tag-merge-target-select"
                    value={mergeTargetTagId}
                    aria-label={copy.mergeTargetLabel}
                    className="field-shell options-bulk-tag-select"
                    onChange={(event) => onMergeTargetChange(event.currentTarget.value)}>
                    <option value="">{copy.mergeTargetLabel}</option>
                    {tagItems.map((item) => (
                      <option key={item.tagId} value={item.tagId}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="tag-bulk-merge"
                    className="options-secondary-button"
                    disabled={!mergeTargetTagId || isSavingTags}
                    onClick={onMergeSelectedTags}>
                    <AppIcon name="merge" size={14} />
                    {copy.mergeTagsLabel}
                  </button>
                  <button
                    type="button"
                    data-testid="tag-bulk-delete"
                    className="options-secondary-button"
                    disabled={isSavingTags}
                    onClick={onDeleteSelectedTags}>
                    <AppIcon name="trash" size={14} />
                    {copy.deleteTagsLabel}
                  </button>
                  <button
                    type="button"
                    data-testid="tag-bulk-clear"
                    className="options-footer-icon-button"
                    aria-label={copy.clearSelection}
                    onClick={onClearTagSelection}>
                    <AppIcon name="close" size={14} />
                  </button>
                </div>
              </div>
            ) : null}

            {!selectedCount && visibleTagItems.length ? (
              <div data-testid="tag-selection-hint" className="options-bulk-actions-bar options-theme-panel">
                <div className="options-bulk-actions-meta">
                  <AppIcon name="tag" size={14} />
                  <span>{copy.mergeTagsLabel}</span>
                </div>
                <div className="options-bulk-actions-controls">
                  <button
                    type="button"
                    data-testid="tag-bulk-select-listed-empty"
                    className="options-secondary-button"
                    onClick={onSelectListedTags}>
                    {copy.selectAllTags}
                  </button>
                </div>
              </div>
            ) : null}

            {visibleTagItems.length ? (
              viewMode === "grid" ? (
                <div data-testid="tag-results-grid" className="options-tag-grid">
                  {visibleTagItems.map((item) => {
                    const isSelected = selectedTagIds.has(item.tagId)
                    const isRenaming = renamingTagId === item.tagId

                    return (
                      <article
                        key={item.tagId}
                        data-tag-card={item.tagId}
                        className={cn("options-tag-card options-theme-panel", isSelected && "is-selected")}>
                        <div className="options-tag-card-head">
                          <label className="options-tag-card-check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label={`${copy.selectBookmark} ${item.name}`}
                              onChange={() => onToggleTagSelection(item.tagId)}
                            />
                          </label>
                          <AppIcon name="hash" size={14} className="options-tag-card-icon" />
                          {isRenaming ? (
                            renderRenameInput(item)
                          ) : (
                            <button
                              type="button"
                              className="options-tag-card-name"
                              onClick={() => onViewTagBookmarks(item.tagId)}>
                              {item.name}
                            </button>
                          )}
                        </div>

                        <div className="options-tag-card-meta">
                          <span className="options-nav-count">
                            {item.bookmarkCount} {copy.tagTableBookmarks}
                          </span>
                          {item.pendingSuggestionCount ? (
                            <span className="options-nav-count">
                              {item.pendingSuggestionCount} {copy.tagTablePending}
                            </span>
                          ) : null}
                        </div>

                        {item.aliases.length ? (
                          <div className="options-tag-card-aliases options-meta-copy">
                            {copy.tagAliasesLabel}: {item.aliases.join(", ")}
                          </div>
                        ) : null}

                        <div className="options-tag-card-footer">
                          <span className="options-meta-copy">{formatTimestamp(item.updatedAt, locale)}</span>
                          {renderRowActions(item)}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div data-testid="tag-results-table" className="options-tag-table-shell options-theme-panel">
                  <table className="options-tag-table">
                    <thead>
                      <tr>
                        <th scope="col" className="options-tag-table-select" />
                        <th scope="col">{copy.tagTableName}</th>
                        <th scope="col">{copy.tagTableBookmarks}</th>
                        <th scope="col">{copy.tagTablePending}</th>
                        <th scope="col">{copy.tagTableUpdated}</th>
                        <th scope="col">{copy.tagTableActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTagItems.map((item) => {
                        const isSelected = selectedTagIds.has(item.tagId)
                        const isRenaming = renamingTagId === item.tagId

                        return (
                          <tr key={item.tagId} data-tag-row={item.tagId} className={cn(isSelected && "is-selected")}>
                            <td className="options-tag-table-select">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                aria-label={`${copy.selectBookmark} ${item.name}`}
                                onChange={() => onToggleTagSelection(item.tagId)}
                              />
                            </td>
                            <td>
                              {isRenaming ? (
                                renderRenameInput(item)
                              ) : (
                                <button
                                  type="button"
                                  className="options-tag-card-name"
                                  onClick={() => onViewTagBookmarks(item.tagId)}>
                                  {item.name}
                                </button>
                              )}
                              {item.aliases.length ? (
                                <div className="options-meta-copy">{item.aliases.join(", ")}</div>
                              ) : null}
                            </td>
                            <td>{item.bookmarkCount}</td>
                            <td>{item.pendingSuggestionCount}</td>
                            <td>{formatTimestamp(item.updatedAt, locale)}</td>
                            <td>{renderRowActions(item)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <FeedStatusCard
                testId="tag-empty-state"
                icon={<AppIcon name="tag" size={24} />}
                overline={copy.infoLabel}
                title={tagItems.length ? copy.noTagsMatchTitle : copy.noTagsCreated}
                description={copy.noTagsMatchDescription}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
