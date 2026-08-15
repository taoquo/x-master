import React, { useEffect, useRef, useState } from "react"
import type { Locale, SavedViewRecord, TagRecord } from "../../lib/types.ts"
import {
  formatAuthorLabel,
  getVisibleAuthorSidebarItems,
  type AuthorSidebarItem
} from "../authorSidebar.ts"
import type { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { formatSyncProgressLabel } from "../../lib/runtime/syncProgress.ts"
import { StatusBadge } from "../../ui/components.tsx"
import { BrandLogo } from "../../ui/branding.tsx"
import { AppIcon } from "../../ui/icons.tsx"
import type { OptionsCopy } from "../i18n/copy.ts"
import {
  cn,
  createFieldId,
  ENABLE_SAVED_VIEWS_UI,
  formatSyncErrorSummary,
  getNextThemePreference,
  getSectionOverline
} from "../utils.ts"
import { FieldBlock, InlineMessage, TextInputField } from "./common.tsx"
import { DataSafetyPanel } from "./DataSafetyPanel.tsx"

export function SavedViewsPanel({
  savedViews,
  copy,
  currentViewName,
  onCurrentViewNameChange,
  onSaveCurrentView,
  onApplySavedView,
  onDeleteSavedView
}: {
  savedViews: SavedViewRecord[]
  copy: OptionsCopy
  currentViewName: string
  onCurrentViewNameChange: (value: string) => void
  onSaveCurrentView: () => void
  onApplySavedView: (savedView: SavedViewRecord) => void
  onDeleteSavedView: (savedViewId: string) => void
}) {
  return (
    <section data-testid="saved-views-section" className="options-sidebar-group options-sidebar-group-saved-views">
      <div className="options-sidebar-section-head">
        <div className="options-sidebar-title-group">
          <span className="options-overline">{copy.savedViewsTitle}</span>
        </div>
      </div>

      <div className="options-saved-view-create">
        <input
          data-testid="saved-view-name-input"
          value={currentViewName}
          placeholder={copy.savedViewNamePlaceholder}
          aria-label={copy.savedViewNamePlaceholder}
          className="options-nav-row-input options-saved-view-input"
          onInput={(event) => onCurrentViewNameChange(event.currentTarget.value)}
          onChange={(event) => onCurrentViewNameChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onSaveCurrentView()
            }
          }}
        />
        <button
          type="button"
          data-testid="save-current-view"
          aria-label={copy.saveCurrentView}
          className="options-footer-icon-button"
          onClick={onSaveCurrentView}>
          <AppIcon name="bookmark" size={14} />
        </button>
      </div>

      {savedViews.length ? (
        <div className="options-sidebar-rows">
          {savedViews.map((savedView) => (
            <div key={savedView.id} className="options-nav-row options-saved-view-row">
              <button
                type="button"
                data-testid="saved-view-apply"
                className="options-saved-view-apply"
                onClick={() => onApplySavedView(savedView)}>
                <AppIcon name="bookmark" size={14} className="options-nav-row-icon" />
                <span className="truncate">{savedView.name}</span>
              </button>
              <button
                type="button"
                data-testid="saved-view-delete"
                aria-label={`${copy.deleteSavedView} ${savedView.name}`}
                className="options-nav-row-delete"
                onClick={() => onDeleteSavedView(savedView.id)}>
                <AppIcon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="options-meta-copy options-saved-view-empty">{copy.noSavedViews}</div>
      )}
    </section>
  )
}

export function WorkspaceSidebar({
  workspace,
  locale,
  themePreference,
  resolvedTheme,
  copy,
  lastSyncLabel,
  activeTagIds,
  activeAuthorHandles,
  showPendingSuggestionsOnly,
  onTogglePendingSuggestions,
  authorItems,
  authorSearchQuery,
  authorsExpanded,
  isTagsCollapsed,
  isAuthorsCollapsed,
  onTagToggle,
  onAuthorToggle,
  onAuthorSearchQueryChange,
  onToggleTagsCollapsed,
  onToggleAuthorsCollapsed,
  onExpandAuthors,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  savedViews,
  currentViewName,
  onCurrentViewNameChange,
  onSaveCurrentView,
  onApplySavedView,
  onDeleteSavedView,
  setLocale,
  setThemePreference,
  onOpenSettings
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  themePreference: "system" | "light" | "dark"
  resolvedTheme: "light" | "dark"
  copy: OptionsCopy
  lastSyncLabel: string
  activeTagIds: string[]
  activeAuthorHandles: string[]
  showPendingSuggestionsOnly: boolean
  onTogglePendingSuggestions: () => void
  authorItems: AuthorSidebarItem[]
  authorSearchQuery: string
  authorsExpanded: boolean
  isTagsCollapsed: boolean
  isAuthorsCollapsed: boolean
  onTagToggle: (tagId: string) => void
  onAuthorToggle: (authorHandle: string) => void
  onAuthorSearchQueryChange: (value: string) => void
  onToggleTagsCollapsed: () => void
  onToggleAuthorsCollapsed: () => void
  onExpandAuthors: () => void
  onCreateTag: (name: string) => Promise<unknown>
  onRenameTag: (tagId: string, name: string) => Promise<unknown>
  onDeleteTag: (tagId: string) => Promise<unknown>
  savedViews: SavedViewRecord[]
  currentViewName: string
  onCurrentViewNameChange: (value: string) => void
  onSaveCurrentView: () => void
  onApplySavedView: (savedView: SavedViewRecord) => void
  onDeleteSavedView: (savedViewId: string) => void
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
  onOpenSettings: () => void
}) {
  const tagCountById = workspace.bookmarkTags.reduce((map, bookmarkTag) => {
    map.set(bookmarkTag.tagId, (map.get(bookmarkTag.tagId) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  const [isCreatingTagInline, setIsCreatingTagInline] = useState(false)
  const [draftTagName, setDraftTagName] = useState("")
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)
  const [renamingTagName, setRenamingTagName] = useState("")
  const [isSubmittingRenameTag, setIsSubmittingRenameTag] = useState(false)
  const [isSubmittingDraftTag, setIsSubmittingDraftTag] = useState(false)
  const draftTagInputRef = useRef<HTMLInputElement | null>(null)
  const renameTagInputRef = useRef<HTMLInputElement | null>(null)
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const draftTagBlurIntentRef = useRef<"idle" | "submit" | "cancel">("idle")
  const renameTagBlurIntentRef = useRef<"idle" | "submit" | "cancel">("idle")
  const { items: visibleAuthorItems, shouldShowToggle: shouldShowAuthorToggle } = getVisibleAuthorSidebarItems({
    authorItems,
    searchQuery: authorSearchQuery,
    expanded: authorsExpanded
  })
  const isAllBookmarksSelected = activeTagIds.includes("all") && activeAuthorHandles.length === 0
  const authorSearchId = createFieldId("authors", "search")
  const tagSelectionCount = activeTagIds.includes("all") ? 0 : activeTagIds.length
  const authorSelectionCount = activeAuthorHandles.length

  useEffect(() => {
    if (!isCreatingTagInline || !draftTagInputRef.current) {
      return
    }

    draftTagInputRef.current.focus()
    draftTagInputRef.current.select()
  }, [isCreatingTagInline])

  useEffect(() => {
    if (!renamingTagId || !renameTagInputRef.current) {
      return
    }

    renameTagInputRef.current.focus()
    renameTagInputRef.current.select()
  }, [renamingTagId])

  function resetInlineTagDraft() {
    draftTagBlurIntentRef.current = "idle"
    setDraftTagName("")
    setIsSubmittingDraftTag(false)
    setIsCreatingTagInline(false)
  }

  function resetInlineTagRename() {
    renameTagBlurIntentRef.current = "idle"
    setRenamingTagId(null)
    setRenamingTagName("")
    setIsSubmittingRenameTag(false)
  }

  function resetFileInput(input: HTMLInputElement | null) {
    if (input) {
      input.value = ""
    }
  }

  function reloadOptionsPage() {
    if (typeof location !== "undefined" && typeof location.reload === "function") {
      location.reload()
      return
    }

    if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
      window.location.reload()
    }
  }

  async function handleRestoreFile(file: File | undefined, input: HTMLInputElement | null) {
    if (!file) {
      return
    }

    try {
      await workspace.handleValidateBackupFile(file)
      const shouldRestore = typeof window.confirm === "function" ? window.confirm(copy.restoreBackupConfirm) : true
      if (shouldRestore) {
        await workspace.handleRestoreBackupFile(file)
        reloadOptionsPage()
      }
    } catch {
      // The shared command error area renders the failure.
    } finally {
      resetFileInput(input)
    }
  }

  async function handleResetLocalData() {
    const shouldReset = typeof window.confirm === "function" ? window.confirm(copy.resetLocalDataConfirm) : true
    if (!shouldReset) {
      return
    }

    try {
      await workspace.handleResetLocalData()
      reloadOptionsPage()
    } catch {
      // The shared command error area renders the failure.
    }
  }

  async function submitInlineTagDraft(nextName?: string) {
    if (isSubmittingDraftTag) {
      return
    }

    const trimmedName = (nextName ?? draftTagInputRef.current?.value ?? draftTagName).trim()
    if (!trimmedName) {
      resetInlineTagDraft()
      return
    }

    setIsSubmittingDraftTag(true)

    try {
      await onCreateTag(trimmedName)
      resetInlineTagDraft()
    } catch {
      setIsSubmittingDraftTag(false)
    }
  }

  function handleCreateTagClick() {
    if (isCreatingTagInline) {
      draftTagInputRef.current?.focus()
      return
    }

    setDraftTagName("")
    setIsCreatingTagInline(true)
  }

  function handleRenameTagClick(tag: TagRecord) {
    setRenamingTagId(tag.id)
    setRenamingTagName(tag.name)
  }

  async function submitInlineTagRename(tagId: string, nextName?: string) {
    if (isSubmittingRenameTag) {
      return
    }

    const trimmedName = (nextName ?? renameTagInputRef.current?.value ?? renamingTagName).trim()
    if (!trimmedName) {
      resetInlineTagRename()
      return
    }

    setIsSubmittingRenameTag(true)

    try {
      await onRenameTag(tagId, trimmedName)
      resetInlineTagRename()
    } catch {
      setIsSubmittingRenameTag(false)
    }
  }

  function handleDeleteTagClick(tagId: string, tagName: string) {
    const shouldDelete = typeof window.confirm === "function"
      ? window.confirm(`${copy.deleteTagConfirmPrefix} “${tagName}”?`)
      : true

    if (!shouldDelete) {
      return
    }

    void onDeleteTag(tagId)
  }

  return (
    <aside
      data-testid="lists-sidebar"
      className="options-demo-sidebar options-sidebar-shell folio-index-panel options-theme-panel flex min-h-[420px] min-w-0 flex-col overflow-hidden">
      <section data-testid="sidebar-status-section" className="options-sidebar-hero">
        <div className="options-sidebar-hero-head">
          <div className="options-sidebar-hero-meta">
            <div className="options-overline">{getSectionOverline(locale, "工作区", "Workspace")}</div>
            <StatusBadge status={workspace.summary.status} />
          </div>
        </div>

        <div className="options-sidebar-brand-row">
          <BrandLogo
            size={38}
            testId="options-brand-logo"
            className="options-sidebar-brand-mark rounded-[12px]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="options-display-title options-sidebar-title truncate">
              {copy.pageTitle}
            </h1>
          </div>
        </div>

        <div data-testid="workspace-sidebar-sync" className="options-sidebar-sync">
          <div className="options-sidebar-sync-label">
            {copy.lastSync} {lastSyncLabel}
          </div>

          <button
            type="button"
            onClick={() => void workspace.handleSync()}
            disabled={workspace.isSyncing}
            className="workspace-sync-primary folio-secondary-action">
            <AppIcon name="sync" size={16} className={workspace.isSyncing ? "animate-spin" : undefined} />
            <span>
              {workspace.isSyncing
                ? workspace.syncProgress
                  ? formatSyncProgressLabel(locale, workspace.syncProgress)
                  : copy.syncing
                : copy.syncNow}
            </span>
          </button>

          <InlineMessage message={formatSyncErrorSummary(workspace.summary, locale) ?? workspace.commandError} />
        </div>
      </section>

      <section data-testid="sidebar-lists-section" className="options-sidebar-lists">
        <div data-testid="sidebar-lists-scroll" className="options-sidebar-lists-scroll scroll-shell min-h-0 flex-1 overflow-y-auto">
          <section data-testid="sidebar-tags-section" className="options-sidebar-group">
            <div className="options-sidebar-section-head">
              <div data-testid="sidebar-tags-title" className="options-sidebar-title-group">
                <span className="options-overline">{getSectionOverline(locale, "标签", "Tags")}</span>
                <button
                  type="button"
                  data-testid="sidebar-create-tag"
                  aria-label={copy.createTagLabel}
                  onClick={handleCreateTagClick}
                  className="options-create-tag-button">
                  <span aria-hidden="true">+</span>
                </button>
              </div>
              <button
                type="button"
                data-testid="sidebar-tags-toggle"
                aria-expanded={!isTagsCollapsed}
                className="options-sidebar-section-toggle"
                onClick={onToggleTagsCollapsed}>
                <span className="options-sidebar-section-toggle-trailing">
                  {tagSelectionCount ? <span className="options-nav-count">{tagSelectionCount}</span> : null}
                  <AppIcon
                    name="caretDown"
                    size={12}
                    className={cn("options-sidebar-section-caret", isTagsCollapsed && "is-collapsed")}
                  />
                </span>
              </button>
            </div>

            {!isTagsCollapsed ? (
              <div data-testid="sidebar-tags-content" className="options-sidebar-group-content options-sidebar-group-content-tags">
              <div data-testid="sidebar-list-tree" className="options-sidebar-rows">
                <div
                  role="button"
                  tabIndex={0}
                  data-list-button="all"
                  onClick={() => onTagToggle("all")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onTagToggle("all")
                    }
                  }}
                  className={cn(
                    "options-nav-row options-nav-row-all w-full text-left",
                    isAllBookmarksSelected && "options-nav-row-active"
                  )}>
                  <span className="options-nav-row-main">
                    <AppIcon name="globe" size={14} className="options-nav-row-icon" />
                    <span>{copy.allBookmarks}</span>
                  </span>
                  <span className="options-nav-count">{workspace.stats.totalBookmarks}</span>
                </div>

                {workspace.stats.pendingSuggestionCount ? (
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid="sidebar-pending-suggestions"
                    onClick={onTogglePendingSuggestions}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onTogglePendingSuggestions()
                      }
                    }}
                    className={cn(
                      "options-nav-row options-nav-row-suggestions w-full text-left",
                      showPendingSuggestionsOnly && "options-nav-row-active"
                    )}>
                    <span className="options-nav-row-main">
                      <AppIcon name="tag" size={14} className="options-nav-row-icon" />
                      <span>{copy.pendingSuggestionsTitle}</span>
                    </span>
                    <span className="options-nav-count">{workspace.stats.pendingSuggestionCount}</span>
                  </div>
                ) : null}

                {isCreatingTagInline ? (
                  <div data-testid="sidebar-create-tag-row" className="options-nav-row options-nav-row-draft">
                    <span className="options-nav-row-main">
                      <AppIcon name="hash" size={14} className="options-nav-row-icon" />
                      <input
                        ref={draftTagInputRef}
                        type="text"
                        value={draftTagName}
                        data-testid="sidebar-create-tag-input"
                        aria-label={copy.createTagLabel}
                        placeholder={copy.createTagPrompt}
                        disabled={isSubmittingDraftTag}
                        className="options-nav-row-input"
                        onChange={(event) => setDraftTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            draftTagBlurIntentRef.current = "submit"
                            void submitInlineTagDraft(event.currentTarget.value)
                            return
                          }

                          if (event.key === "Escape") {
                            event.preventDefault()
                            draftTagBlurIntentRef.current = "cancel"
                            resetInlineTagDraft()
                          }
                        }}
                        onBlur={(event) => {
                          if (draftTagBlurIntentRef.current === "submit" || draftTagBlurIntentRef.current === "cancel") {
                            draftTagBlurIntentRef.current = "idle"
                            return
                          }

                          void submitInlineTagDraft(event.currentTarget.value)
                        }}
                      />
                    </span>
                  </div>
                ) : null}

                {workspace.tags.map((tag) => {
                  const isSelected = activeTagIds.includes(tag.id)
                  const isRenaming = renamingTagId === tag.id
                  return (
                    <div
                      key={tag.id}
                      role="button"
                      tabIndex={0}
                      data-list-button={tag.id}
                      onClick={() => {
                        if (!isRenaming) {
                          onTagToggle(tag.id)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (isRenaming) {
                          return
                        }

                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onTagToggle(tag.id)
                        }
                      }}
                      className={cn(
                        "options-nav-row options-nav-row-tag w-full text-left",
                        isSelected && "options-nav-row-active"
                      )}>
                      <span className="options-nav-row-main">
                        <AppIcon name="hash" size={14} className="options-nav-row-icon" />
                        {isRenaming ? (
                          <input
                            ref={renameTagInputRef}
                            type="text"
                            value={renamingTagName}
                            data-testid="sidebar-rename-tag-input"
                            aria-label={`${copy.createTagLabel} ${tag.name}`}
                            disabled={isSubmittingRenameTag}
                            className="options-nav-row-input"
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setRenamingTagName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                event.stopPropagation()
                                renameTagBlurIntentRef.current = "submit"
                                void submitInlineTagRename(tag.id, event.currentTarget.value)
                                return
                              }

                              if (event.key === "Escape") {
                                event.preventDefault()
                                event.stopPropagation()
                                renameTagBlurIntentRef.current = "cancel"
                                resetInlineTagRename()
                              }
                            }}
                            onBlur={(event) => {
                              if (renameTagBlurIntentRef.current === "submit" || renameTagBlurIntentRef.current === "cancel") {
                                renameTagBlurIntentRef.current = "idle"
                                return
                              }

                              void submitInlineTagRename(tag.id, event.currentTarget.value)
                            }}
                          />
                        ) : (
                          <span className="truncate">{tag.name}</span>
                        )}
                      </span>
                      <span className="options-nav-row-trailing">
                        <span className="options-nav-count">{tagCountById.get(tag.id) ?? 0}</span>
                        {isRenaming ? null : isSelected ? (
                          <span className="options-nav-row-check" aria-hidden="true">
                            <AppIcon name="check" size={12} />
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              data-testid="sidebar-rename-tag"
                              className="options-nav-row-delete"
                              aria-label={`${copy.renameTagLabel} ${tag.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleRenameTagClick(tag)
                              }}>
                              <AppIcon name="edit" size={12} />
                            </button>
                            <button
                              type="button"
                              data-testid="sidebar-delete-tag"
                              className="options-nav-row-delete"
                              aria-label={`${copy.deleteLabel} ${tag.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeleteTagClick(tag.id, tag.name)
                              }}
                            >
                              <AppIcon name="trash" size={12} />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              </div>
            ) : null}
          </section>

          {ENABLE_SAVED_VIEWS_UI ? (
            <SavedViewsPanel
              savedViews={savedViews}
              copy={copy}
              currentViewName={currentViewName}
              onCurrentViewNameChange={onCurrentViewNameChange}
              onSaveCurrentView={onSaveCurrentView}
              onApplySavedView={onApplySavedView}
              onDeleteSavedView={onDeleteSavedView}
            />
          ) : null}

          <section data-testid="sidebar-authors-section" className="options-sidebar-group options-sidebar-group-authors">
            <div className="options-sidebar-section-head">
              <div data-testid="sidebar-authors-title" className="options-sidebar-title-group">
                <span className="options-overline">{copy.authorsTitle}</span>
              </div>
              <button
                type="button"
                data-testid="sidebar-authors-toggle-header"
                aria-expanded={!isAuthorsCollapsed}
                className="options-sidebar-section-toggle"
                onClick={onToggleAuthorsCollapsed}>
                <span className="options-sidebar-section-toggle-trailing">
                  {authorSelectionCount ? <span className="options-nav-count">{authorSelectionCount}</span> : null}
                  <AppIcon
                    name="caretDown"
                    size={12}
                    className={cn("options-sidebar-section-caret", isAuthorsCollapsed && "is-collapsed")}
                  />
                </span>
              </button>
            </div>

            {!isAuthorsCollapsed ? (
              <div data-testid="sidebar-authors-content" className="options-sidebar-group-content options-sidebar-group-content-authors">
                <FieldBlock label={copy.searchAuthors} htmlFor={authorSearchId} labelClassName="sr-only">
                  <TextInputField
                    id={authorSearchId}
                    type="search"
                    value={authorSearchQuery}
                    onChange={onAuthorSearchQueryChange}
                    placeholder={copy.searchAuthorsPlaceholder}
                    dataTestId="sidebar-authors-search"
                    ariaLabel={copy.searchAuthors}
                    className="options-sidebar-search-input w-full"
                  />
                </FieldBlock>

                <div className="options-sidebar-rows">
                  {visibleAuthorItems.map((author) => {
                    const isSelected = activeAuthorHandles.includes(author.authorHandle)

                    return (
                      <div
                        key={author.authorHandle}
                        role="button"
                        tabIndex={0}
                        data-author-button={author.authorHandle}
                        onClick={() => onAuthorToggle(author.authorHandle)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            onAuthorToggle(author.authorHandle)
                          }
                        }}
                        className={cn("options-nav-row options-author-nav-row w-full text-left", isSelected && "options-nav-row-active")}>
                        <span className="options-nav-row-main min-w-0">
                          <span className="options-author-avatar options-nav-row-icon" aria-hidden="true">
                            {author.authorAvatarUrl ? (
                              <img src={author.authorAvatarUrl} alt="" />
                            ) : (
                              <span className="options-author-avatar-fallback">@</span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{author.authorName || formatAuthorLabel(author)}</span>
                            <span className="options-meta-copy block truncate">{formatAuthorLabel(author)}</span>
                          </span>
                        </span>
                        <span className="options-nav-row-trailing">
                          <span className="options-nav-count">{author.count}</span>
                          {isSelected ? (
                            <span className="options-nav-row-check" aria-hidden="true">
                              <AppIcon name="check" size={12} />
                            </span>
                          ) : null}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {!authorsExpanded && shouldShowAuthorToggle ? (
                  <button
                    type="button"
                    data-testid="sidebar-authors-show-more"
                    onClick={onExpandAuthors}
                    className="options-footer-chip">
                    {copy.showMore}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section data-testid="sidebar-footer-section" className="options-sidebar-config">
        <div className="py-4">
          <span className="sr-only">{copy.preferencesLabel}</span>
          <DataSafetyPanel workspace={workspace} locale={locale} copy={copy} />
          <div className="options-sidebar-footer-row">
            <div className="options-sidebar-footer-controls">
              <button
                type="button"
                data-testid="footer-locale-toggle"
                aria-label={copy.languageLabel}
                onClick={() => void setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
                className="options-footer-chip">
                {locale === "zh-CN" ? "中" : "EN"}
              </button>
              <button
                type="button"
                data-testid="footer-theme-toggle"
                onClick={() => void setThemePreference(getNextThemePreference(themePreference, resolvedTheme))}
                className="options-footer-icon-button"
                aria-label={copy.themeLabel}>
                <AppIcon name={resolvedTheme === "dark" ? "moon" : "sun"} size={14} />
              </button>
              <button
                type="button"
                data-testid="footer-settings-toggle"
                onClick={onOpenSettings}
                className="options-footer-icon-button"
                aria-label={copy.openSettings}>
                <AppIcon name="settings" size={14} />
              </button>
              <span
                data-testid="footer-data-actions-divider"
                className="options-footer-divider"
                aria-hidden="true"
              />
              <button
                type="button"
                data-testid="footer-export-toggle"
                onClick={() => void workspace.handleExportWorkspace()}
                disabled={workspace.isExporting}
                className="options-footer-icon-button"
                aria-label={copy.exportData}>
                <AppIcon name="export" size={14} />
              </button>
              <button
                type="button"
                data-testid="data-safety-restore-backup"
                onClick={() => restoreInputRef.current?.click()}
                disabled={workspace.isValidatingBackup || workspace.isRestoringBackup}
                className="options-footer-icon-button"
                aria-label={copy.restoreBackup}>
                <AppIcon name="import" size={14} />
              </button>
              <button
                type="button"
                data-testid="data-safety-reset-local"
                onClick={() => void handleResetLocalData()}
                disabled={workspace.isResettingData}
                className="options-footer-icon-button options-footer-icon-button-danger"
                aria-label={workspace.isResettingData ? copy.resettingData : copy.resetLocalData}>
                <AppIcon name="trash" size={14} />
              </button>
            </div>
          </div>
          <input
            ref={restoreInputRef}
            data-testid="data-safety-restore-input"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void handleRestoreFile(event.currentTarget.files?.[0], event.currentTarget)}
          />
        </div>
      </section>
    </aside>
  )
}
