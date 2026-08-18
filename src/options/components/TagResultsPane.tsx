import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Locale } from "../../lib/types.ts"
import {
  mergePlanKey,
  renamePlanKey,
  type TagMergePlan,
  type TagRenamePlan
} from "../../lib/autotag/vocabularyReview.ts"
import { AppIcon } from "../../ui/icons.tsx"
import type { GraphViewModel } from "../graph/graphModel.ts"
import type { OptionsCopy } from "../i18n/copy.ts"
import {
  countOrphanTags,
  countLongTailTags,
  countUnparentedTags,
  getRemovableOrphanTagIds,
  getRootTagCandidates,
  hasParentCandidates,
  HEALTHY_TAG_COUNT_MAX,
  type TagLibraryFilter,
  type TagLibraryItem,
  type TagLibrarySortOrder
} from "../tagLibrary.ts"
import {
  cn,
  createFieldId,
  formatTimestamp,
  getSectionOverline,
  INITIAL_RESULTS_RENDER_LIMIT,
  RESULTS_RENDER_INCREMENT
} from "../utils.ts"
import { FeedStatusCard, InlineMessage, TextInputField } from "./common.tsx"
import { TagGraphView } from "./TagGraphView.tsx"

export type TagViewMode = "grid" | "table" | "graph"

// Below this many root tags every parent dropdown can render its full option
// list cheaply. Above it we only fill the dropdown the user is interacting with,
// otherwise a large library would mount tags x tags option nodes.
const PARENT_OPTIONS_PRELOAD_LIMIT = 50

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

// Everything a rendered tag row needs that does not vary per row. Bundled into
// one memoised object so toggling a single checkbox only re-renders the rows
// whose own props changed instead of the whole page of cards.
interface TagRowContext {
  locale: Locale
  copy: OptionsCopy
  isSavingTags: boolean
  rootCandidates: TagLibraryItem[]
  preloadParentOptions: boolean
  toggleSelection: (tagId: string) => void
  viewBookmarks: (tagId: string) => void
  deleteTag: (tagId: string, tagName: string) => void
  setParent: (tagId: string, parentId?: string) => void
  openParentSelect: (tagId: string) => void
  startRename: (item: TagLibraryItem) => void
  startAliasEdit: (item: TagLibraryItem) => void
}

interface TagRowProps {
  item: TagLibraryItem
  context: TagRowContext
  isSelected: boolean
  isParentSelectOpen: boolean
  renameNode: React.ReactNode
  aliasNode: React.ReactNode
}

function TagParentControl({
  item,
  context,
  isParentSelectOpen
}: {
  item: TagLibraryItem
  context: TagRowContext
  isParentSelectOpen: boolean
}) {
  const { copy, rootCandidates } = context

  if (!hasParentCandidates(rootCandidates, item)) {
    return (
      <span
        data-testid="tag-parent-locked"
        className="options-meta-copy options-tag-parent-locked"
        title={item.childCount ? copy.tagParentUnavailable : undefined}>
        {item.childCount ? `${item.childCount} ${copy.tagChildCountSuffix}` : copy.tagParentNone}
      </span>
    )
  }

  // Large libraries only fill the dropdown the user opened; the selected parent
  // stays present so the closed control still shows the right label.
  const showAllOptions = context.preloadParentOptions || isParentSelectOpen
  const options = showAllOptions
    ? rootCandidates
    : rootCandidates.filter((candidate) => candidate.tagId === item.parentId)

  return (
    <select
      data-testid="tag-parent-select"
      data-tag-parent-select={item.tagId}
      value={item.parentId ?? ""}
      aria-label={`${copy.tagParentLabel} ${item.name}`}
      disabled={context.isSavingTags}
      className="field-shell options-tag-parent-select"
      onPointerDown={() => context.openParentSelect(item.tagId)}
      onFocus={() => context.openParentSelect(item.tagId)}
      onChange={(event) => {
        const nextParentId = event.currentTarget.value
        context.setParent(item.tagId, nextParentId || undefined)
      }}>
      <option value="">{copy.tagParentNone}</option>
      {options.map((candidate) =>
        candidate.tagId === item.tagId ? null : (
          <option key={candidate.tagId} value={candidate.tagId}>
            {candidate.name}
          </option>
        )
      )}
    </select>
  )
}

function TagRowActions({ item, context }: { item: TagLibraryItem; context: TagRowContext }) {
  const { copy } = context

  return (
    <span className="options-tag-card-actions">
      <button
        type="button"
        data-testid="tag-view-bookmarks"
        className="options-nav-row-delete"
        aria-label={`${copy.viewTagBookmarks} ${item.name}`}
        onClick={() => context.viewBookmarks(item.tagId)}>
        <AppIcon name="search" size={12} />
      </button>
      <button
        type="button"
        data-testid="tag-rename"
        className="options-nav-row-delete"
        aria-label={`${copy.renameTagLabel} ${item.name}`}
        onClick={() => context.startRename(item)}>
        <AppIcon name="edit" size={12} />
      </button>
      <button
        type="button"
        data-testid="tag-edit-aliases"
        className="options-nav-row-delete"
        aria-label={`${copy.editTagAliasesLabel} ${item.name}`}
        onClick={() => context.startAliasEdit(item)}>
        <AppIcon name="tag" size={12} />
      </button>
      <button
        type="button"
        data-testid="tag-delete"
        className="options-nav-row-delete"
        aria-label={`${copy.deleteLabel} ${item.name}`}
        onClick={() => context.deleteTag(item.tagId, item.name)}>
        <AppIcon name="trash" size={12} />
      </button>
    </span>
  )
}

const TagLibraryCard = React.memo(function TagLibraryCard({
  item,
  context,
  isSelected,
  isParentSelectOpen,
  renameNode,
  aliasNode
}: TagRowProps) {
  const { copy, locale } = context

  return (
    <article
      data-tag-card={item.tagId}
      className={cn("options-tag-card options-theme-panel", isSelected && "is-selected")}>
      <div className="options-tag-card-head">
        <label className="options-tag-card-check">
          <input
            type="checkbox"
            checked={isSelected}
            aria-label={`${copy.selectBookmark} ${item.name}`}
            onChange={() => context.toggleSelection(item.tagId)}
          />
        </label>
        <AppIcon name="hash" size={14} className="options-tag-card-icon" />
        {renameNode ?? (
          <button
            type="button"
            className="options-tag-card-name"
            onClick={() => context.viewBookmarks(item.tagId)}>
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
        {item.childCount ? (
          <span className="options-nav-count">
            {item.childCount} {copy.tagChildCountSuffix}
          </span>
        ) : null}
      </div>

      <div className="options-tag-card-parent">
        <span className="options-meta-copy">{copy.tagParentLabel}</span>
        <TagParentControl item={item} context={context} isParentSelectOpen={isParentSelectOpen} />
      </div>

      {aliasNode ??
        (item.aliases.length ? (
          <div className="options-tag-card-aliases options-meta-copy">
            {copy.tagAliasesLabel}: {item.aliases.join(", ")}
          </div>
        ) : null)}

      <div className="options-tag-card-footer">
        <span className="options-meta-copy">{formatTimestamp(item.updatedAt, locale)}</span>
        <TagRowActions item={item} context={context} />
      </div>
    </article>
  )
})

const TagLibraryRow = React.memo(function TagLibraryRow({
  item,
  context,
  isSelected,
  isParentSelectOpen,
  renameNode,
  aliasNode
}: TagRowProps) {
  const { copy, locale } = context

  return (
    <tr data-tag-row={item.tagId} className={cn(isSelected && "is-selected")}>
      <td className="options-tag-table-select">
        <input
          type="checkbox"
          checked={isSelected}
          aria-label={`${copy.selectBookmark} ${item.name}`}
          onChange={() => context.toggleSelection(item.tagId)}
        />
      </td>
      <td>
        {renameNode ?? (
          <button
            type="button"
            className="options-tag-card-name"
            onClick={() => context.viewBookmarks(item.tagId)}>
            {item.name}
          </button>
        )}
        {aliasNode ?? (item.aliases.length ? <div className="options-meta-copy">{item.aliases.join(", ")}</div> : null)}
      </td>
      <td>
        <TagParentControl item={item} context={context} isParentSelectOpen={isParentSelectOpen} />
      </td>
      <td>{item.bookmarkCount}</td>
      <td>{item.pendingSuggestionCount}</td>
      <td>{formatTimestamp(item.updatedAt, locale)}</td>
      <td>
        <TagRowActions item={item} context={context} />
      </td>
    </tr>
  )
})

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
  viewMode: TagViewMode
  onViewModeChange: (viewMode: TagViewMode) => void
  graphModel: GraphViewModel
  focusedGraphTagId: string | null
  onFocusGraphTag: (tagId: string | null) => void
  graphShowAuthors: boolean
  onToggleGraphAuthors: () => void
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
  onSetTagParent: (tagId: string, parentId?: string) => Promise<unknown>
  onUpdateTagAliases: (tagId: string, aliases: string[]) => Promise<unknown>
  onDeleteTag: (tagId: string, tagName: string) => void
  onViewTagBookmarks: (tagId: string) => void
  onExitTagManagement: () => void
  reviewStatus: "idle" | "running" | "ready" | "error"
  reviewError?: string
  reviewMerges: TagMergePlan[]
  reviewRenames: TagRenamePlan[]
  selectedReviewKeys: Set<string>
  onReviewVocabulary: () => void
  onCleanupOrphanTags: () => void
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
  graphModel,
  focusedGraphTagId,
  onFocusGraphTag,
  graphShowAuthors,
  onToggleGraphAuthors,
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
  onSetTagParent,
  onUpdateTagAliases,
  onDeleteTag,
  onViewTagBookmarks,
  onExitTagManagement,
  reviewStatus,
  reviewError,
  reviewMerges,
  reviewRenames,
  selectedReviewKeys,
  onReviewVocabulary,
  onCleanupOrphanTags,
  onToggleReviewSelection,
  onApplyReview,
  onDismissReview
}: TagResultsPaneProps) {
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)
  const [renamingTagName, setRenamingTagName] = useState("")
  const [isSubmittingRename, setIsSubmittingRename] = useState(false)
  const [editingAliasTagId, setEditingAliasTagId] = useState<string | null>(null)
  const [editingAliasValue, setEditingAliasValue] = useState("")
  const [isSubmittingAliases, setIsSubmittingAliases] = useState(false)
  const [openParentSelectTagId, setOpenParentSelectTagId] = useState<string | null>(null)
  const [isMergeTargetOpen, setIsMergeTargetOpen] = useState(false)
  const [renderLimit, setRenderLimit] = useState(INITIAL_RESULTS_RENDER_LIMIT)
  const searchId = createFieldId("tags", "search")
  const sortId = createFieldId("tags", "sort")
  const orphanCount = countOrphanTags(tagItems)
  const unparentedCount = countUnparentedTags(tagItems)
  const longTailCount = countLongTailTags(tagItems)
  const isLibraryOversized = tagItems.length > HEALTHY_TAG_COUNT_MAX
  // Every row offers the same root tags as parents, so build the list once
  // instead of sorting the whole library again for each rendered tag.
  const rootCandidates = useMemo(() => getRootTagCandidates(tagItems), [tagItems])
  // The cleanup action can only remove empty tags that are not themes, so the
  // badge counts exactly what the click would delete.
  const removableOrphanCount = useMemo(() => getRemovableOrphanTagIds(tagItems).length, [tagItems])
  // Same idea for the merge dropdown: a huge library only materialises its
  // options once the control is actually touched.
  const mergeTargetOptions = useMemo(() => {
    if (tagItems.length <= PARENT_OPTIONS_PRELOAD_LIMIT || isMergeTargetOpen) {
      return tagItems
    }

    return tagItems.filter((item) => item.tagId === mergeTargetTagId)
  }, [tagItems, isMergeTargetOpen, mergeTargetTagId])
  const selectedCount = selectedTagIds.size
  const activeFilterCount = filter === "all" ? 0 : 1
  const reviewProposalCount = reviewMerges.length + reviewRenames.length
  // Render the library in pages so a few hundred tags do not mount hundreds of
  // cards (and their selects) on every keystroke or save.
  const renderedTagItems = useMemo(
    () => (visibleTagItems.length > renderLimit ? visibleTagItems.slice(0, renderLimit) : visibleTagItems),
    [visibleTagItems, renderLimit]
  )

  useEffect(() => {
    setRenderLimit(INITIAL_RESULTS_RENDER_LIMIT)
  }, [searchQuery, filter, sortOrder, viewMode])

  function handleTagScroll(event: React.UIEvent<HTMLDivElement>) {
    if (renderLimit >= visibleTagItems.length) {
      return
    }

    const target = event.currentTarget
    const remainingScroll = target.scrollHeight - target.scrollTop - target.clientHeight

    if (remainingScroll > 320) {
      return
    }

    setRenderLimit((current) => Math.min(current + RESULTS_RENDER_INCREMENT, visibleTagItems.length))
  }

  // Row callbacks are read through a ref so they keep a stable identity: the
  // memoised cards would otherwise re-render on every parent render.
  const handlersRef = useRef({ onToggleTagSelection, onViewTagBookmarks, onDeleteTag, onSetTagParent })
  handlersRef.current = { onToggleTagSelection, onViewTagBookmarks, onDeleteTag, onSetTagParent }

  const startRename = useCallback((item: TagLibraryItem) => {
    setRenamingTagId(item.tagId)
    setRenamingTagName(item.name)
  }, [])

  const startAliasEdit = useCallback((item: TagLibraryItem) => {
    setEditingAliasTagId(item.tagId)
    setEditingAliasValue(item.aliases.join(", "))
  }, [])

  const rowContext = useMemo<TagRowContext>(
    () => ({
      locale,
      copy,
      isSavingTags,
      rootCandidates,
      preloadParentOptions: rootCandidates.length <= PARENT_OPTIONS_PRELOAD_LIMIT,
      toggleSelection: (tagId) => handlersRef.current.onToggleTagSelection(tagId),
      viewBookmarks: (tagId) => handlersRef.current.onViewTagBookmarks(tagId),
      deleteTag: (tagId, tagName) => handlersRef.current.onDeleteTag(tagId, tagName),
      setParent: (tagId, parentId) => {
        void handlersRef.current.onSetTagParent(tagId, parentId)
      },
      openParentSelect: setOpenParentSelectTagId,
      startRename,
      startAliasEdit
    }),
    [locale, copy, isSavingTags, rootCandidates, startRename, startAliasEdit]
  )

  function cancelRename() {
    setRenamingTagId(null)
    setRenamingTagName("")
  }

  function cancelAliasEdit() {
    setEditingAliasTagId(null)
    setEditingAliasValue("")
  }

  async function submitAliases(tagId: string, rawValue: string) {
    setIsSubmittingAliases(true)
    try {
      await onUpdateTagAliases(
        tagId,
        rawValue
          .split(",")
          .map((alias) => alias.trim())
          .filter(Boolean)
      )
    } finally {
      setIsSubmittingAliases(false)
      cancelAliasEdit()
    }
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
        onInput={(event) => setRenamingTagName(event.currentTarget.value)}
        onChange={(event) => setRenamingTagName(event.currentTarget.value)}
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


  function renderAliasEditor(item: TagLibraryItem) {
    return (
      <div className="options-tag-alias-editor">
        <input
          autoFocus
          type="text"
          value={editingAliasValue}
          data-testid="tag-alias-input"
          aria-label={`${copy.editTagAliasesLabel} ${item.name}`}
          placeholder={copy.tagAliasesPlaceholder}
          disabled={isSubmittingAliases}
          className="options-nav-row-input options-tag-alias-input"
          onInput={(event) => setEditingAliasValue(event.currentTarget.value)}
          onChange={(event) => setEditingAliasValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void submitAliases(item.tagId, event.currentTarget.value)
              return
            }

            if (event.key === "Escape") {
              event.preventDefault()
              cancelAliasEdit()
            }
          }}
        />
        <button
          type="button"
          data-testid="tag-alias-save"
          className="options-secondary-button options-tag-alias-save"
          disabled={isSubmittingAliases}
          onClick={() => void submitAliases(item.tagId, editingAliasValue)}>
          {copy.saveLabel}
        </button>
        <button
          type="button"
          data-testid="tag-alias-cancel"
          className="options-footer-icon-button"
          aria-label={copy.cancelLabel}
          onClick={cancelAliasEdit}>
          <AppIcon name="close" size={12} />
        </button>
      </div>
    )
  }

  return (
    <section
      data-testid="tag-library-workspace"
      className="options-main-shell min-h-[420px] min-w-0 overflow-hidden p-0 xl:h-[100dvh]">
      <div className="flex h-full min-h-0 flex-col">
        <div
          data-testid="tag-library-scroll"
          className="scroll-shell min-h-0 flex-1 overflow-y-auto"
          onScroll={handleTagScroll}>
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
                      {tagItems.length} {copy.tagsCountSuffix} · {orphanCount} {copy.orphanTagsSuffix} · {unparentedCount}{" "}
                      {copy.unparentedTagsSuffix}
                    </div>
                    <div data-testid="tag-health-meta" className="options-meta-copy options-tag-header-meta">
                      {longTailCount} {copy.longTailTagsSuffix} ·{" "}
                      {isLibraryOversized ? copy.tagHealthTooMany : copy.tagHealthOk}
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

                    <button
                      type="button"
                      data-testid="tag-cleanup-orphans"
                      className="options-toolbar-action"
                      disabled={isSavingTags || !removableOrphanCount}
                      onClick={onCleanupOrphanTags}>
                      <AppIcon name="trash" size={14} />
                      <span>{copy.cleanupOrphanTagsLabel}</span>
                      {removableOrphanCount ? (
                        <span className="options-toolbar-badge">{removableOrphanCount}</span>
                      ) : null}
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
                              ["long-tail", copy.tagFilterLongTail],
                              ["pending", copy.tagFilterPending],
                              ["unparented", copy.tagFilterUnparented]
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
                        data-testid="tag-view-toggle-graph"
                        className={cn("options-view-toggle", viewMode === "graph" && "is-active")}
                        aria-pressed={viewMode === "graph"}
                        aria-label={copy.tagViewGraph}
                        title={copy.tagViewGraph}
                        onClick={() => onViewModeChange("graph")}>
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
                        <span>
                          {filter === "orphan"
                            ? copy.tagFilterOrphan
                            : filter === "long-tail"
                              ? copy.tagFilterLongTail
                              : filter === "pending"
                                ? copy.tagFilterPending
                                : copy.tagFilterUnparented}
                        </span>
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

            {viewMode !== "graph" && selectedCount ? (
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
                    onPointerDown={() => setIsMergeTargetOpen(true)}
                    onFocus={() => setIsMergeTargetOpen(true)}
                    onChange={(event) => onMergeTargetChange(event.currentTarget.value)}>
                    <option value="">{copy.mergeTargetLabel}</option>
                    {mergeTargetOptions.map((item) => (
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

            {viewMode !== "graph" && !selectedCount && visibleTagItems.length ? (
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

            {viewMode === "graph" ? (
              graphModel.nodes.length ? (
                <TagGraphView
                  copy={copy}
                  model={graphModel}
                  focusedTagId={focusedGraphTagId}
                  showAuthors={graphShowAuthors}
                  onToggleAuthors={onToggleGraphAuthors}
                  onFocusTag={onFocusGraphTag}
                  onViewTagBookmarks={onViewTagBookmarks}
                />
              ) : (
                <FeedStatusCard
                  testId="tag-graph-empty-state"
                  icon={<AppIcon name="graph" size={24} />}
                  overline={copy.infoLabel}
                  title={copy.graphEmptyTitle}
                  description={copy.graphEmptyDescription}
                />
              )
            ) : visibleTagItems.length ? (
              viewMode === "grid" ? (
                <div data-testid="tag-results-grid" className="options-tag-grid">
                  {renderedTagItems.map((item) => (
                    <TagLibraryCard
                      key={item.tagId}
                      item={item}
                      context={rowContext}
                      isSelected={selectedTagIds.has(item.tagId)}
                      isParentSelectOpen={openParentSelectTagId === item.tagId}
                      renameNode={renamingTagId === item.tagId ? renderRenameInput(item) : null}
                      aliasNode={editingAliasTagId === item.tagId ? renderAliasEditor(item) : null}
                    />
                  ))}
                </div>
              ) : (
                <div data-testid="tag-results-table" className="options-tag-table-shell options-theme-panel">
                  <table className="options-tag-table">
                    <thead>
                      <tr>
                        <th scope="col" className="options-tag-table-select" />
                        <th scope="col">{copy.tagTableName}</th>
                        <th scope="col">{copy.tagTableParent}</th>
                        <th scope="col">{copy.tagTableBookmarks}</th>
                        <th scope="col">{copy.tagTablePending}</th>
                        <th scope="col">{copy.tagTableUpdated}</th>
                        <th scope="col">{copy.tagTableActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderedTagItems.map((item) => (
                        <TagLibraryRow
                          key={item.tagId}
                          item={item}
                          context={rowContext}
                          isSelected={selectedTagIds.has(item.tagId)}
                          isParentSelectOpen={openParentSelectTagId === item.tagId}
                          renameNode={renamingTagId === item.tagId ? renderRenameInput(item) : null}
                          aliasNode={editingAliasTagId === item.tagId ? renderAliasEditor(item) : null}
                        />
                      ))}
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
