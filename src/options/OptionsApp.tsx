import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import type { SavedViewRecord, TagSuggestionRecord } from "../lib/types.ts"
import {
  filterBookmarks,
  filterBookmarksByAuthors,
  filterBookmarksByFlags,
  sortBookmarks,
  type BookmarkSortOrder,
} from "../lib/search/searchBookmarks.ts"
import { buildAuthorSidebarItems, formatAuthorLabel } from "./authorSidebar.ts"
import { BookmarkInspector } from "./components/BookmarkInspector.tsx"
import { useWorkspaceData } from "./hooks/useWorkspaceData.ts"
import { getSettings, saveSettings } from "../lib/storage/settings.ts"
import { ExtensionUiProvider, useExtensionUi } from "../ui/provider.tsx"
import { getOptionsCopy } from "./i18n/copy.ts"
import {
  createFieldId,
  DEFAULT_SAVED_VIEW_NAME,
  formatTimestamp,
  getTagNamesForBookmark,
  haveSameItems,
  INITIAL_RESULTS_RENDER_LIMIT,
  RESULTS_RENDER_INCREMENT,
  type ViewStateSnapshot
} from "./utils.ts"
import { BackgroundScene } from "./components/common.tsx"
import { WorkspaceSidebar } from "./components/WorkspaceSidebar.tsx"
import { BookmarkResultsPane } from "./components/BookmarkResultsPane.tsx"
import { SettingsPanel } from "./settings/SettingsPanel.tsx"

function OptionsScreen() {
  const workspace = useWorkspaceData()
  const { locale, themePreference, resolvedTheme, setLocale, setThemePreference } = useExtensionUi()
  const copy = getOptionsCopy(locale)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280)
  const [_rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [activeTagIds, setActiveTagIds] = useState<string[]>(["all"])
  const [activeAuthorHandles, setActiveAuthorHandles] = useState<string[]>([])
  const [authorSearchQuery, setAuthorSearchQuery] = useState("")
  const [authorsExpanded, setAuthorsExpanded] = useState(false)
  const [isTagsCollapsed, setIsTagsCollapsed] = useState(false)
  const [isAuthorsCollapsed, setIsAuthorsCollapsed] = useState(true)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("timeline")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [selectedBulkBookmarkIds, setSelectedBulkBookmarkIds] = useState<Set<string>>(() => new Set())
  const [bulkTagId, setBulkTagId] = useState("")
  const [showPendingSuggestionsOnly, setShowPendingSuggestionsOnly] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [currentViewName, setCurrentViewName] = useState("")
  const [renderLimit, setRenderLimit] = useState(INITIAL_RESULTS_RENDER_LIMIT)
  const resizeStateRef = useRef<null | { side: "left" | "right"; startX: number; startWidth: number }>(null)
  const paneWidthsRef = useRef({ left: 280, right: 360 })

  useEffect(() => {
    void getSettings()
      .then((settings) => {
        const nextLeft = settings.leftSidebarWidth ?? 280
        const nextRight = settings.rightSidebarWidth ?? 360
        paneWidthsRef.current = { left: nextLeft, right: nextRight }
        setLeftSidebarWidth(nextLeft)
        setRightSidebarWidth(nextRight)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const stopResizeMode = () => {
      document.documentElement.classList.remove("is-pane-resizing")
    }

    const handlePointerMove = (event: PointerEvent | MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) {
        return
      }
      event.preventDefault()

      if (state.side === "left") {
        const nextWidth = Math.min(420, Math.max(260, state.startWidth + (event.clientX - state.startX)))
        paneWidthsRef.current.left = nextWidth
        setLeftSidebarWidth(nextWidth)
        return
      }

      const nextWidth = Math.min(520, Math.max(320, state.startWidth - (event.clientX - state.startX)))
      paneWidthsRef.current.right = nextWidth
      setRightSidebarWidth(nextWidth)
    }

    const handlePointerUp = () => {
      if (!resizeStateRef.current) {
        return
      }

      resizeStateRef.current = null
      stopResizeMode()
      void getSettings().then((settings) =>
        saveSettings({
          ...settings,
          leftSidebarWidth: paneWidthsRef.current.left,
          rightSidebarWidth: paneWidthsRef.current.right
        })
      )
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("mousemove", handlePointerMove)
    window.addEventListener("mouseup", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("mousemove", handlePointerMove)
      window.removeEventListener("mouseup", handlePointerUp)
      stopResizeMode()
    }
    // Handlers only read refs, so the listeners never need re-binding.
  }, [])

  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const authorItems = useMemo(() => buildAuthorSidebarItems(workspace.bookmarks), [workspace.bookmarks])
  const pendingSuggestionsByBookmarkId = useMemo(() => {
    const map = new Map<string, TagSuggestionRecord[]>()

    for (const suggestion of workspace.tagSuggestions) {
      if (suggestion.status !== "pending") {
        continue
      }

      const suggestions = map.get(suggestion.bookmarkId) ?? []
      suggestions.push(suggestion)
      map.set(suggestion.bookmarkId, suggestions)
    }

    return map
  }, [workspace.tagSuggestions])
  const bookmarkTagIdsByBookmarkId = useMemo(() => {
    const map = new Map<string, Set<string>>()

    for (const bookmarkTag of workspace.bookmarkTags) {
      const tagIds = map.get(bookmarkTag.bookmarkId) ?? new Set<string>()
      tagIds.add(bookmarkTag.tagId)
      map.set(bookmarkTag.bookmarkId, tagIds)
    }

    return map
  }, [workspace.bookmarkTags])
  const visibleBookmarks = useMemo(
    () => {
      const scopedBookmarks = activeTagIds.includes("all")
        ? workspace.bookmarks
        : workspace.bookmarks.filter((bookmark) =>
            activeTagIds.every((tagId) => bookmarkTagIdsByBookmarkId.get(bookmark.tweetId)?.has(tagId))
          )
      const suggestionScopedBookmarks = showPendingSuggestionsOnly
        ? scopedBookmarks.filter((bookmark) => pendingSuggestionsByBookmarkId.has(bookmark.tweetId))
        : scopedBookmarks

      return sortBookmarks(
        filterBookmarksByFlags(
          filterBookmarks(filterBookmarksByAuthors(suggestionScopedBookmarks, activeAuthorHandles), deferredQuery),
          {
            onlyWithMedia,
            onlyLongform
          }
        ),
        sortOrder
      )
    },
    [
      onlyLongform,
      onlyWithMedia,
      deferredQuery,
      sortOrder,
      activeAuthorHandles,
      activeTagIds,
      bookmarkTagIdsByBookmarkId,
      pendingSuggestionsByBookmarkId,
      showPendingSuggestionsOnly,
      workspace.bookmarks
    ]
  )
  const renderedBookmarks = useMemo(
    () => visibleBookmarks.slice(0, Math.min(renderLimit, visibleBookmarks.length)),
    [renderLimit, visibleBookmarks]
  )

  useEffect(() => {
    const visibleBookmarkIds = new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId))

    if (!visibleBookmarks.length) {
      setSelectedBookmarkId(undefined)
      return
    }

    if (selectedBookmarkId && !visibleBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(undefined)
    }
  }, [selectedBookmarkId, visibleBookmarks])

  useEffect(() => {
    const visibleBookmarkIds = new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId))
    setSelectedBulkBookmarkIds((current) => {
      const next = new Set([...current].filter((bookmarkId) => visibleBookmarkIds.has(bookmarkId)))
      return next.size === current.size ? current : next
    })
  }, [visibleBookmarks])

  useEffect(() => {
    setRenderLimit(Math.min(INITIAL_RESULTS_RENDER_LIMIT, visibleBookmarks.length || INITIAL_RESULTS_RENDER_LIMIT))
  }, [visibleBookmarks])

  useEffect(() => {
    setActiveTagIds((current) => {
      if (current.includes("all")) {
        return current.length === 1 ? current : ["all"]
      }

      const validTagIds = current.filter((tagId) => workspace.tags.some((tag) => tag.id === tagId))
      const next = validTagIds.length ? validTagIds : ["all"]

      return haveSameItems(current, next) ? current : next
    })
  }, [workspace.tags])

  useEffect(() => {
    setActiveAuthorHandles((current) => {
      const validAuthorHandles = current.filter((authorHandle) =>
        authorItems.some((author) => author.authorHandle === authorHandle)
      )

      return haveSameItems(current, validAuthorHandles) ? current : validAuthorHandles
    })
  }, [authorItems])

  const selectedBookmark =
    visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ??
    workspace.bookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ??
    null

  const tagNamesByBookmarkId = useMemo(() => {
    const map = new Map<string, string[]>()

    for (const bookmark of workspace.bookmarks) {
      const tags = getTagNamesForBookmark(bookmark.tweetId, workspace.bookmarkTags, tagsById).map((tag) => tag.name)
      map.set(bookmark.tweetId, tags)
    }

    return map
  }, [tagsById, workspace.bookmarkTags, workspace.bookmarks])

  const searchId = createFieldId("filters", "search")
  const lastSyncLabel = formatTimestamp(workspace.summary.lastSyncedAt, locale)
  const selectedAuthor = activeAuthorHandles[0]
    ? authorItems.find((author) => author.authorHandle === activeAuthorHandles[0]) ?? null
    : null
  const activeTagNames = activeTagIds.includes("all")
    ? []
    : activeTagIds.map((tagId) => workspace.tags.find((tag) => tag.id === tagId)?.name ?? tagId)
  const currentScopeLabel = (() => {
    const scopeParts: string[] = []

    if (selectedAuthor) {
      scopeParts.push(`${copy.authorPrefix} · ${formatAuthorLabel(selectedAuthor)}`)
    }

    if (activeTagNames.length) {
      scopeParts.push(`${activeTagNames.length > 1 ? copy.tagsTitle : copy.tagPrefix} · ${activeTagNames.join(" + ")}`)
    }

    return scopeParts.length ? scopeParts.join(" + ") : copy.allBookmarks
  })()
  const activeRefinementChips = [
    onlyWithMedia ? { key: "media", label: copy.hasMedia } : null,
    onlyLongform ? { key: "longform", label: copy.longform } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>
  const coldStartLoading = workspace.isLoading && !workspace.bookmarks.length

  useEffect(() => {
    if (!selectedBookmark || typeof document === "undefined") {
      return
    }

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = "hidden"
    body.classList.add("options-detail-scroll-locked")

    return () => {
      body.style.overflow = previousOverflow
      body.classList.remove("options-detail-scroll-locked")
    }
  }, [selectedBookmark])

  function clearRefinement(key: string) {
    if (key === "query") {
      setQuery("")
      return
    }

    if (key === "media") {
      setOnlyWithMedia(false)
      return
    }

    if (key === "longform") {
      setOnlyLongform(false)
    }
  }

  function handleTagToggle(tagId: string) {
    if (tagId === "all") {
      setActiveTagIds(["all"])
      setActiveAuthorHandles([])
      setShowPendingSuggestionsOnly(false)
      return
    }

    setActiveTagIds((current) => {
      if (current.includes("all")) {
        return [tagId]
      }

      const next = current.includes(tagId)
        ? current.filter((currentTagId) => currentTagId !== tagId)
        : [...current, tagId]

      return next.length ? next : ["all"]
    })
  }

  function handleAuthorToggle(authorHandle: string) {
    if (activeAuthorHandles[0] === authorHandle) {
      startTransition(() => {
        setActiveAuthorHandles([])
      })
      return
    }

    setActiveAuthorHandles([authorHandle])
  }

  function handleBulkToggleBookmark(bookmarkId: string) {
    setSelectedBulkBookmarkIds((current) => {
      const next = new Set(current)
      if (next.has(bookmarkId)) {
        next.delete(bookmarkId)
      } else {
        next.add(bookmarkId)
      }
      return next
    })
  }

  function handleSelectFilteredBookmarks() {
    setSelectedBulkBookmarkIds(new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId)))
  }

  function handleSelectRenderedBookmarks() {
    setSelectedBulkBookmarkIds(new Set(renderedBookmarks.map((bookmark) => bookmark.tweetId)))
  }

  function handleClearBulkSelection() {
    setSelectedBulkBookmarkIds(new Set())
    setBulkTagId("")
  }

  async function handleApplyBulkTag() {
    if (!bulkTagId || !selectedBulkBookmarkIds.size) {
      return
    }

    await workspace.handleBulkAttachTag([...selectedBulkBookmarkIds], bulkTagId)
    handleClearBulkSelection()
  }

  const visiblePendingSuggestionIds = useMemo(() => {
    const ids: string[] = []

    for (const bookmark of visibleBookmarks) {
      const suggestions = pendingSuggestionsByBookmarkId.get(bookmark.tweetId)
      if (!suggestions) {
        continue
      }

      for (const suggestion of suggestions) {
        ids.push(suggestion.id)
      }
    }

    return ids
  }, [pendingSuggestionsByBookmarkId, visibleBookmarks])

  async function handleAcceptVisibleSuggestions() {
    if (!visiblePendingSuggestionIds.length) {
      return
    }

    await workspace.handleAcceptSuggestionsBulk(visiblePendingSuggestionIds)
  }

  function getCurrentViewSnapshot(): ViewStateSnapshot {
    return {
      query,
      activeTagIds,
      activeAuthorHandles,
      onlyWithMedia,
      onlyLongform,
      sortOrder,
      viewMode
    }
  }

  async function handleSaveCurrentView() {
    const name = currentViewName.trim() || DEFAULT_SAVED_VIEW_NAME
    const now = new Date().toISOString()
    const savedView: SavedViewRecord = {
      id: `view-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      createdAt: now,
      updatedAt: now,
      ...getCurrentViewSnapshot()
    }

    await workspace.handleSaveViews([savedView, ...workspace.savedViews])
    setCurrentViewName("")
  }

  function handleApplySavedView(savedView: SavedViewRecord) {
    setQuery(savedView.query)
    setActiveTagIds(savedView.activeTagIds.length ? savedView.activeTagIds : ["all"])
    setActiveAuthorHandles(savedView.activeAuthorHandles)
    setOnlyWithMedia(savedView.onlyWithMedia)
    setOnlyLongform(savedView.onlyLongform)
    setSortOrder(savedView.sortOrder)
    setViewMode(savedView.viewMode)
    setFilterPopoverOpen(false)
    handleClearBulkSelection()
  }

  async function handleDeleteSavedView(savedViewId: string) {
    await workspace.handleSaveViews(workspace.savedViews.filter((savedView) => savedView.id !== savedViewId))
  }

  function handleResultsScroll(event: React.UIEvent<HTMLDivElement>) {
    if (renderLimit >= visibleBookmarks.length) {
      return
    }

    const target = event.currentTarget
    const remainingScroll = target.scrollHeight - target.scrollTop - target.clientHeight

    if (remainingScroll > 320) {
      return
    }

    setRenderLimit((current) => Math.min(current + RESULTS_RENDER_INCREMENT, visibleBookmarks.length))
  }

  return (
    <>
      <BackgroundScene />
      <main className="min-h-[100dvh]">
        <div data-testid="workspace-shell" className="w-full">
          <div
            data-testid="workspace-overview"
            style={
              typeof window !== "undefined" && window.innerWidth >= 768
                ? {
                    gridTemplateColumns: `${leftSidebarWidth}px 12px minmax(0, 1fr)`
                  }
                : undefined
            }
            className="relative grid gap-0 xl:min-h-0 xl:h-[100dvh] xl:grid-cols-[256px_minmax(0,1fr)] xl:items-stretch">
            <>
              <WorkspaceSidebar
                workspace={workspace}
                locale={locale}
                themePreference={themePreference}
                resolvedTheme={resolvedTheme}
                copy={copy}
                lastSyncLabel={lastSyncLabel}
                activeTagIds={activeTagIds}
                activeAuthorHandles={activeAuthorHandles}
                showPendingSuggestionsOnly={showPendingSuggestionsOnly}
                onTogglePendingSuggestions={() => setShowPendingSuggestionsOnly((current) => !current)}
                authorItems={authorItems}
                authorSearchQuery={authorSearchQuery}
                authorsExpanded={authorsExpanded}
                isTagsCollapsed={isTagsCollapsed}
                isAuthorsCollapsed={isAuthorsCollapsed}
                onTagToggle={handleTagToggle}
                onAuthorToggle={handleAuthorToggle}
                onAuthorSearchQueryChange={setAuthorSearchQuery}
                onToggleTagsCollapsed={() => setIsTagsCollapsed((current) => !current)}
                onToggleAuthorsCollapsed={() => setIsAuthorsCollapsed((current) => !current)}
                onExpandAuthors={() => setAuthorsExpanded(true)}
                onCreateTag={workspace.handleCreateTag}
                onRenameTag={workspace.handleRenameTag}
                onDeleteTag={workspace.handleDeleteTag}
                savedViews={workspace.savedViews}
                currentViewName={currentViewName}
                onCurrentViewNameChange={setCurrentViewName}
                onSaveCurrentView={() => void handleSaveCurrentView()}
                onApplySavedView={handleApplySavedView}
                onDeleteSavedView={(savedViewId) => void handleDeleteSavedView(savedViewId)}
                setLocale={setLocale}
                setThemePreference={setThemePreference}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />

              <div
                role="separator"
                aria-orientation="vertical"
                data-testid="split-handle-left"
                className="workspace-split-handle hidden md:block"
                onPointerDown={(event) => {
                  event.preventDefault()
                  resizeStateRef.current = {
                    side: "left",
                    startX: event.clientX,
                    startWidth: leftSidebarWidth
                  }
                  document.documentElement.classList.add("is-pane-resizing")
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  resizeStateRef.current = {
                    side: "left",
                    startX: event.clientX,
                    startWidth: leftSidebarWidth
                  }
                  document.documentElement.classList.add("is-pane-resizing")
                }}
              />

              <BookmarkResultsPane
                workspace={workspace}
                isLoading={coldStartLoading}
                locale={locale}
                copy={copy}
                currentScopeLabel={currentScopeLabel}
                searchId={searchId}
                query={query}
                setQuery={setQuery}
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
                selectedBookmarkId={selectedBookmarkId}
                setSelectedBookmarkId={setSelectedBookmarkId}
                visibleBookmarks={visibleBookmarks}
                renderedBookmarks={renderedBookmarks}
                activeRefinementChips={activeRefinementChips}
                tagNamesByBookmarkId={tagNamesByBookmarkId}
                pendingSuggestionsByBookmarkId={pendingSuggestionsByBookmarkId}
                visiblePendingSuggestionCount={visiblePendingSuggestionIds.length}
                onAcceptSuggestion={(suggestionId) => void workspace.handleAcceptSuggestion(suggestionId)}
                onRejectSuggestion={(suggestionId) => void workspace.handleRejectSuggestion(suggestionId)}
                onAcceptVisibleSuggestions={() => void handleAcceptVisibleSuggestions()}
                selectedBulkBookmarkIds={selectedBulkBookmarkIds}
                bulkTagId={bulkTagId}
                onBulkTagIdChange={setBulkTagId}
                onBulkToggleBookmark={handleBulkToggleBookmark}
                onSelectFilteredBookmarks={handleSelectFilteredBookmarks}
                onSelectRenderedBookmarks={handleSelectRenderedBookmarks}
                onClearBulkSelection={handleClearBulkSelection}
                onApplyBulkTag={() => void handleApplyBulkTag()}
                clearRefinement={clearRefinement}
                onResultsScroll={handleResultsScroll}
              />

              {coldStartLoading ? null : selectedBookmark ? (
                <section
                  data-testid="workspace-detail-modal"
                  role="presentation"
                  className="options-detail-modal">
                  <button
                    type="button"
                    data-testid="workspace-detail-backdrop"
                    aria-label={copy.detailsTitle}
                    className="options-detail-backdrop"
                    onClick={() => setSelectedBookmarkId(undefined)}
                  />
                  <div data-testid="workspace-detail-card" className="options-detail-focus-card">
                    <BookmarkInspector
                      bookmark={selectedBookmark}
                      tags={workspace.tags}
                      bookmarkTags={workspace.bookmarkTags}
                      locale={locale}
                      copy={copy}
                      onAttachTag={async (tagId) => {
                        if (!selectedBookmark) {
                          return
                        }

                        await workspace.handleAttachTag(selectedBookmark.tweetId, tagId)
                      }}
                      onDetachTag={async (tagId) => {
                        if (!selectedBookmark) {
                          return
                        }

                        await workspace.handleDetachTag(selectedBookmark.tweetId, tagId)
                      }}
                      onCreateTag={workspace.handleCreateTag}
                      onClose={() => setSelectedBookmarkId(undefined)}
                    />
                  </div>
                </section>
              ) : null}

              {isSettingsOpen ? (
                <SettingsPanel
                  workspace={workspace}
                  copy={copy}
                  locale={locale}
                  themePreference={themePreference}
                  setLocale={setLocale}
                  setThemePreference={setThemePreference}
                  onClose={() => setIsSettingsOpen(false)}
                />
              ) : null}
            </>
          </div>
        </div>
      </main>
    </>
  )
}

export function OptionsApp() {
  return (
    <ExtensionUiProvider>
      <OptionsScreen />
    </ExtensionUiProvider>
  )
}
