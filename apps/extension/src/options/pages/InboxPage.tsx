import React, { useEffect, useMemo, useState } from "react"
import { Stack } from "@mantine/core"
import {
  applyBookmarkFilters,
  type BookmarkSortOrder,
  type MultiValueMatchMode,
  type SavedTimeRange
} from "../../lib/search/searchBookmarks.ts"
import { INBOX_FOLDER_ID } from "../../lib/storage/foldersStore.ts"
import { InboxBookmarkDetailDrawer } from "../components/InboxBookmarkDetailDrawer.tsx"
import { InboxTable } from "../components/InboxTable.tsx"
import { InboxWorkbenchToolbar } from "../components/InboxWorkbenchToolbar.tsx"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { getAuthorOptions, getBookmarkTagsForBookmark } from "../lib/pageHelpers.ts"
import { SectionHeader } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"
import type { InboxRouteState } from "../lib/navigation.ts"

export function InboxPage({ initialRouteState }: { initialRouteState?: InboxRouteState }) {
  const workspace = useWorkspaceData()
  const [query, setQuery] = useState("")
  const [selectedAuthorHandles, setSelectedAuthorHandles] = useState<string[]>([])
  const [authorMatchMode, setAuthorMatchMode] = useState<MultiValueMatchMode>("any")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagMatchMode, setTagMatchMode] = useState<MultiValueMatchMode>("all")
  const [timeRange, setTimeRange] = useState<SavedTimeRange>("all")
  const [selectedPublishedDate, setSelectedPublishedDate] = useState<string | undefined>(initialRouteState?.publishedDate)
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
    setSelectedAuthorHandles([])
    setAuthorMatchMode("any")
    setSelectedTagIds([])
    setTagMatchMode("all")
    setTimeRange("all")
    setSelectedPublishedDate(undefined)
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
        selectedPublishedDate,
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
      selectedPublishedDate,
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
    () => visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ?? null,
    [selectedBookmarkId, visibleBookmarks]
  )
  const visibleBookmarkIds = useMemo(() => new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId)), [visibleBookmarks])

  useEffect(() => {
    setSelectedBookmarkIds((current) => current.filter((bookmarkId) => visibleBookmarkIds.has(bookmarkId)))
  }, [visibleBookmarkIds])

  useEffect(() => {
    if (selectedBookmarkId && !visibleBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(undefined)
    }
  }, [selectedBookmarkId, visibleBookmarkIds])

  const selectedBookmarkTags = useMemo(
    () => getBookmarkTagsForBookmark(selectedBookmark?.tweetId, workspace.bookmarkTags, new Map(workspace.tags.map((tag) => [tag.id, tag]))),
    [selectedBookmark?.tweetId, workspace.bookmarkTags, workspace.tags]
  )
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
    <ExtensionUiProvider>
      <Stack gap="xl">
        <SectionHeader
          title="Inbox"
          description="Organize new bookmarks in a dense table, then use the drawer for item-level filing and tagging."
        />

        <Stack gap="md" style={{ minHeight: 0 }}>
          <InboxWorkbenchToolbar
            query={query}
            onQueryChange={setQuery}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            selectedPublishedDate={selectedPublishedDate}
            onClearPublishedDate={() => setSelectedPublishedDate(undefined)}
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
        </Stack>

        <InboxBookmarkDetailDrawer
          opened={Boolean(selectedBookmark)}
          onClose={() => setSelectedBookmarkId(undefined)}
          bookmark={selectedBookmark}
          tags={selectedBookmarkTags}
          availableTags={workspace.tags}
          onCreateTag={workspace.handleCreateTag}
          onAttachTag={(tagId) => workspace.handleAttachTag(selectedBookmark?.tweetId ?? "", tagId)}
          onDetachTag={(tagId) => workspace.handleDetachTag(selectedBookmark?.tweetId ?? "", tagId)}
          isSaving={workspace.isSavingTag || workspace.isSavingFolder}
        />
      </Stack>
    </ExtensionUiProvider>
  )
}
