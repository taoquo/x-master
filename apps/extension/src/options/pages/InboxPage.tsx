import React, { useEffect, useMemo, useState } from "react"
import {
  applyBookmarkFilters,
  type BookmarkSortOrder,
  type MultiValueMatchMode,
  type SavedTimeRange
} from "../../lib/search/searchBookmarks.ts"
import { INBOX_FOLDER_ID } from "../../lib/storage/foldersStore.ts"
import { InboxBookmarkDetailDrawer } from "../components/InboxBookmarkDetailDrawer.tsx"
import { InboxFolderNavigation } from "../components/InboxFolderNavigation.tsx"
import { InboxTable } from "../components/InboxTable.tsx"
import { InboxWorkbenchToolbar } from "../components/InboxWorkbenchToolbar.tsx"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { getAuthorOptions, getBookmarkTagsForBookmark, getCurrentFolderForBookmark } from "../lib/pageHelpers.ts"

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

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
  const visibleBookmarkIds = useMemo(() => new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId)), [visibleBookmarks])

  useEffect(() => {
    setSelectedBookmarkIds((current) => current.filter((bookmarkId) => visibleBookmarkIds.has(bookmarkId)))
  }, [visibleBookmarkIds])

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
  const folderNameByBookmarkId = useMemo(() => {
    const names = new Map<string, string>()

    for (const bookmarkFolder of workspace.bookmarkFolders) {
      names.set(bookmarkFolder.bookmarkId, workspace.foldersById.get(bookmarkFolder.folderId)?.name ?? "Inbox")
    }

    return names
  }, [workspace.bookmarkFolders, workspace.foldersById])

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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 28 }}>Inbox</h2>
        <p style={{ margin: 0, color: "#52606d" }}>Organize new bookmarks in a dense table, then use the drawer for item-level filing and tagging.</p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr) 400px",
          gap: 16,
          minHeight: 0
        }}>
        <InboxFolderNavigation
          folderTree={workspace.folderTree}
          selectedFolderId={selectedFolderId}
          selectedFolderLabel={selectedFolderLabel}
          visibleCount={visibleBookmarks.length}
          totalCount={workspace.bookmarks.length}
          onSelectFolder={setSelectedFolderId}
        />

        <section
          style={{
            minHeight: 0,
            display: "grid",
            gap: 16
          }}>
          <InboxWorkbenchToolbar
            query={query}
            onQueryChange={setQuery}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            onlyWithMedia={onlyWithMedia}
            onOnlyWithMediaChange={setOnlyWithMedia}
            onlyLongform={onlyLongform}
            onOnlyLongformChange={setOnlyLongform}
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
            resultCount={visibleBookmarks.length}
            totalCount={workspace.bookmarks.length}
            selectedCount={selectedBookmarkIds.length}
            onSelectAllVisible={handleSelectAllVisible}
            onClearSelection={handleClearSelection}
            bulkFolderId={bulkFolderId}
            onBulkFolderIdChange={setBulkFolderId}
            bulkTagId={bulkTagId}
            onBulkTagIdChange={setBulkTagId}
            folders={workspace.folders}
            onBulkMove={() => void handleBulkMove()}
            onBulkTag={() => void handleBulkTag()}
            isSavingFolder={workspace.isSavingFolder}
            isSavingTag={workspace.isSavingTag}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters((current) => !current)}
            onClearFilters={handleClearFilters}
          />
          <InboxTable
            bookmarks={visibleBookmarks}
            selectedBookmarkId={selectedBookmark?.tweetId}
            selectedBookmarkIds={selectedBookmarkIds}
            folderNameByBookmarkId={folderNameByBookmarkId}
            onSelectBookmark={setSelectedBookmarkId}
            onToggleBookmarkSelection={handleToggleBookmarkSelection}
          />
        </section>

        <InboxBookmarkDetailDrawer
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
      </section>
    </div>
  )
}
