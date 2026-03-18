import React, { useEffect, useMemo, useState } from "react"
import {
  applyBookmarkFilters,
  type BookmarkSortOrder,
  type MultiValueMatchMode,
  type SavedTimeRange
} from "../../lib/search/searchBookmarks.ts"
import { INBOX_FOLDER_ID } from "../../lib/storage/foldersStore.ts"
import { BookmarkDetail } from "../../popup/components/BookmarkDetail.tsx"
import { BookmarkList } from "../../popup/components/BookmarkList.tsx"
import { FilterSidebar } from "../../popup/components/FilterSidebar.tsx"
import { SettingsPanel } from "../../popup/components/SettingsPanel.tsx"
import { SyncPanel } from "../../popup/components/SyncPanel.tsx"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import {
  getAuthorOptions,
  getBookmarkTagsForBookmark,
  getCurrentFolderForBookmark,
  getSortLabel
} from "../lib/pageHelpers.ts"

export function InboxPage() {
  const workspace = useWorkspaceData()
  const [query, setQuery] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(INBOX_FOLDER_ID)
  const [selectedAuthorHandles, setSelectedAuthorHandles] = useState<string[]>([])
  const [authorMatchMode, setAuthorMatchMode] = useState<MultiValueMatchMode>("any")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagMatchMode, setTagMatchMode] = useState<MultiValueMatchMode>("all")
  const [timeRange, setTimeRange] = useState<SavedTimeRange>("all")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([])
  const [bulkFolderId, setBulkFolderId] = useState(INBOX_FOLDER_ID)
  const [bulkTagId, setBulkTagId] = useState("")
  const [collapsedSections, setCollapsedSections] = useState({
    folders: false,
    authors: true,
    tags: true,
    time: true,
    content: true,
    sort: true
  })

  function handleClearFilters() {
    setQuery("")
    setSelectedFolderId(INBOX_FOLDER_ID)
    setSelectedAuthorHandles([])
    setAuthorMatchMode("any")
    setSelectedTagIds([])
    setTagMatchMode("all")
    setTimeRange("all")
    setSortOrder("saved-desc")
    setOnlyWithMedia(false)
    setOnlyLongform(false)
    setSelectedBookmarkIds([])
    setBulkFolderId(INBOX_FOLDER_ID)
    setBulkTagId("")
  }

  function handleToggleAuthor(authorHandle: string) {
    setSelectedAuthorHandles((current) =>
      current.includes(authorHandle) ? current.filter((value) => value !== authorHandle) : [...current, authorHandle]
    )
  }

  function handleToggleTag(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId]))
  }

  function handleToggleSection(section: keyof typeof collapsedSections) {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section]
    }))
  }

  function handleToggleBookmarkSelection(bookmarkId: string) {
    setSelectedBookmarkIds((current) =>
      current.includes(bookmarkId) ? current.filter((value) => value !== bookmarkId) : [...current, bookmarkId]
    )
  }

  function handleSelectAllVisible() {
    setSelectedBookmarkIds(visibleBookmarks.map((bookmark) => bookmark.tweetId))
  }

  function handleClearSelection() {
    setSelectedBookmarkIds([])
  }

  const authorOptions = useMemo(() => getAuthorOptions(workspace.bookmarks), [workspace.bookmarks])
  const visibleBookmarks = useMemo(
    () =>
      applyBookmarkFilters(workspace.bookmarks, {
        query,
        folders: workspace.folders,
        bookmarkFolders: workspace.bookmarkFolders,
        selectedFolderId,
        bookmarkTags: workspace.bookmarkTags,
        selectedAuthorHandles,
        authorMatchMode,
        selectedTagIds,
        tagMatchMode,
        timeRange,
        onlyWithMedia,
        onlyLongform,
        sortOrder
      }),
    [
      authorMatchMode,
      onlyLongform,
      onlyWithMedia,
      query,
      selectedAuthorHandles,
      selectedFolderId,
      selectedTagIds,
      sortOrder,
      tagMatchMode,
      timeRange,
      workspace.bookmarkFolders,
      workspace.bookmarkTags,
      workspace.bookmarks,
      workspace.folders
    ]
  )

  const selectedBookmark = useMemo(
    () => visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ?? visibleBookmarks[0] ?? null,
    [selectedBookmarkId, visibleBookmarks]
  )

  useEffect(() => {
    if (!selectedBookmark && visibleBookmarks[0]) {
      setSelectedBookmarkId(visibleBookmarks[0].tweetId)
      return
    }

    if (selectedBookmark && selectedBookmark.tweetId !== selectedBookmarkId) {
      setSelectedBookmarkId(selectedBookmark.tweetId)
    }
  }, [selectedBookmark, selectedBookmarkId, visibleBookmarks])

  const selectedBookmarkTags = useMemo(
    () => getBookmarkTagsForBookmark(selectedBookmark?.tweetId, workspace.bookmarkTags, new Map(workspace.tags.map((tag) => [tag.id, tag]))),
    [selectedBookmark?.tweetId, workspace.bookmarkTags, workspace.tags]
  )
  const currentFolder = useMemo(
    () => getCurrentFolderForBookmark(selectedBookmark?.tweetId, workspace.bookmarkFolders, workspace.foldersById),
    [selectedBookmark?.tweetId, workspace.bookmarkFolders, workspace.foldersById]
  )
  const selectedFolderLabel = selectedFolderId ? workspace.foldersById.get(selectedFolderId)?.name ?? "Inbox" : "All folders"
  const queueIndex = selectedBookmark ? visibleBookmarks.findIndex((bookmark) => bookmark.tweetId === selectedBookmark.tweetId) + 1 : 0

  async function handleBulkMove() {
    if (!selectedBookmarkIds.length || !bulkFolderId) {
      return
    }

    await workspace.handleBulkMoveToFolder(selectedBookmarkIds, bulkFolderId)
    setSelectedBookmarkIds([])
  }

  async function handleBulkTag() {
    if (!selectedBookmarkIds.length || !bulkTagId) {
      return
    }

    await workspace.handleBulkAttachTag(selectedBookmarkIds, bulkTagId)
    setSelectedBookmarkIds([])
  }

  function handleSelectPrevious() {
    if (!visibleBookmarks.length || !selectedBookmark) {
      return
    }

    const currentIndex = visibleBookmarks.findIndex((bookmark) => bookmark.tweetId === selectedBookmark.tweetId)
    const previousIndex = currentIndex <= 0 ? 0 : currentIndex - 1
    setSelectedBookmarkId(visibleBookmarks[previousIndex]?.tweetId)
  }

  function handleSelectNext() {
    if (!visibleBookmarks.length || !selectedBookmark) {
      return
    }

    const currentIndex = visibleBookmarks.findIndex((bookmark) => bookmark.tweetId === selectedBookmark.tweetId)
    const nextIndex = currentIndex >= visibleBookmarks.length - 1 ? visibleBookmarks.length - 1 : currentIndex + 1
    setSelectedBookmarkId(visibleBookmarks[nextIndex]?.tweetId)
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 28 }}>Inbox</h2>
        <p style={{ margin: 0, color: "#52606d" }}>Triage new bookmarks, move them into folders, and enrich them with tags.</p>
      </header>

      <section
        style={{
          display: "grid",
          gap: 14,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <SyncPanel summary={workspace.summary} isSyncing={workspace.isSyncing} onSync={workspace.handleSync} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 16,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Processing queue</h3>
          <p style={{ margin: 0, color: "#52606d" }}>
            {queueIndex > 0 ? `${queueIndex} / ${visibleBookmarks.length}` : `0 / ${visibleBookmarks.length}`} in current queue
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleSelectPrevious} disabled={queueIndex <= 1}>
              Previous
            </button>
            <button type="button" onClick={handleSelectNext} disabled={!visibleBookmarks.length || queueIndex >= visibleBookmarks.length}>
              Next
            </button>
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Batch organize</h3>
          <p style={{ margin: 0, color: "#52606d" }}>{selectedBookmarkIds.length} selected</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleSelectAllVisible} disabled={!visibleBookmarks.length}>
              Select all visible
            </button>
            <button type="button" onClick={handleClearSelection} disabled={!selectedBookmarkIds.length}>
              Clear selection
            </button>
          </div>
          <label>
            Move selected to
            <select value={bulkFolderId} onChange={(event) => setBulkFolderId(event.target.value)}>
              {workspace.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleBulkMove()}
            disabled={!selectedBookmarkIds.length || !bulkFolderId || workspace.isSavingFolder}>
            Move selected
          </button>
          <label>
            Tag selected with
            <select value={bulkTagId} onChange={(event) => setBulkTagId(event.target.value)}>
              <option value="">Select a tag</option>
              {workspace.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleBulkTag()}
            disabled={!selectedBookmarkIds.length || !bulkTagId || workspace.isSavingTag}>
            Apply tag
          </button>
        </section>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 320px) minmax(320px, 420px) minmax(360px, 1fr)",
          gap: 16,
          minHeight: 0
        }}>
        <FilterSidebar
          query={query}
          onQueryChange={setQuery}
          folderTree={workspace.folderTree}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          authorOptions={authorOptions}
          selectedAuthorHandles={selectedAuthorHandles}
          authorMatchMode={authorMatchMode}
          onToggleAuthor={handleToggleAuthor}
          onAuthorMatchModeChange={setAuthorMatchMode}
          tags={workspace.tags}
          selectedTagIds={selectedTagIds}
          tagMatchMode={tagMatchMode}
          onToggleTag={handleToggleTag}
          onTagMatchModeChange={setTagMatchMode}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onlyWithMedia={onlyWithMedia}
          onOnlyWithMediaChange={setOnlyWithMedia}
          onlyLongform={onlyLongform}
          onOnlyLongformChange={setOnlyLongform}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          collapsedSections={collapsedSections}
          onToggleSection={handleToggleSection}
          onClearFilters={handleClearFilters}
        />

        <section
          style={{
            minHeight: 0,
            display: "grid",
            padding: 16,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff"
          }}>
          <BookmarkList
            bookmarks={visibleBookmarks}
            selectedBookmarkId={selectedBookmark?.tweetId}
            resultCount={visibleBookmarks.length}
            sortLabel={getSortLabel(sortOrder)}
            folderLabel={selectedFolderLabel}
            onSelectBookmark={setSelectedBookmarkId}
            selectionEnabled
            selectedBookmarkIds={selectedBookmarkIds}
            onToggleBookmarkSelection={handleToggleBookmarkSelection}
          />
        </section>

        <section
          style={{
            minHeight: 0,
            display: "grid",
            alignContent: "start",
            gap: 16,
            padding: 16,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff",
            overflowY: "auto"
          }}>
          <BookmarkDetail
            bookmark={selectedBookmark}
            currentFolder={currentFolder}
            availableFolders={workspace.folders}
            tags={selectedBookmarkTags}
            availableTags={workspace.tags}
            onCreateFolder={workspace.handleCreateFolder}
            onMoveToFolder={(folderId) => workspace.handleMoveToFolder(selectedBookmark?.tweetId ?? "", folderId)}
            onCreateTag={workspace.handleCreateTag}
            onAttachTag={(tagId) => workspace.handleAttachTag(selectedBookmark?.tweetId ?? "", tagId)}
            onDetachTag={(tagId) => workspace.handleDetachTag(selectedBookmark?.tweetId ?? "", tagId)}
            isSaving={workspace.isSavingTag || workspace.isSavingFolder}
          />
          <SettingsPanel
            bookmarks={workspace.bookmarks}
            tags={workspace.tags}
            latestSyncRun={workspace.latestSyncRun}
            onExport={workspace.handleExport}
            onReset={workspace.handleReset}
            isResetting={workspace.isResetting}
            compact
          />
        </section>
      </section>
    </div>
  )
}
