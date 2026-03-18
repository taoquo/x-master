import React, { useEffect, useMemo, useState } from "react"
import { exportBookmarks } from "../lib/export/exportBookmarks.ts"
import {
  applyBookmarkFilters,
  type BookmarkSortOrder,
  type MultiValueMatchMode,
  type SavedTimeRange
} from "../lib/search/searchBookmarks.ts"
import {
  buildFolderTree,
  createFolder,
  INBOX_FOLDER_ID,
  moveBookmarkToFolder
} from "../lib/storage/foldersStore.ts"
import {
  attachTagToBookmark,
  createTag,
  detachTagFromBookmark
} from "../lib/storage/tagsStore.ts"
import type {
  BookmarkFolderRecord,
  BookmarkRecord,
  BookmarkTagRecord,
  FolderRecord,
  SyncRunRecord,
  SyncSummary,
  TagRecord
} from "../lib/types.ts"
import { createEmptySyncSummary } from "../lib/types.ts"
import { loadPopupData, resetStoredData, runSync } from "../lib/runtime/popupClient.ts"
import { BookmarkDetail } from "./components/BookmarkDetail.tsx"
import { BookmarkList } from "./components/BookmarkList.tsx"
import { FilterSidebar } from "./components/FilterSidebar.tsx"
import { SettingsPanel } from "./components/SettingsPanel.tsx"
import { SyncPanel } from "./components/SyncPanel.tsx"

function downloadJson(filename: string, content: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return
  }

  const blob = new Blob([content], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function findBookmarkTags(bookmarkTags: BookmarkTagRecord[], bookmarkId: string) {
  return bookmarkTags.filter((bookmarkTag) => bookmarkTag.bookmarkId === bookmarkId)
}

function mapTagsById(tags: TagRecord[]) {
  return new Map(tags.map((tag) => [tag.id, tag]))
}

function mapFoldersById(folders: FolderRecord[]) {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

function getSortLabel(sortOrder: BookmarkSortOrder) {
  switch (sortOrder) {
    case "saved-asc":
      return "oldest saved"
    case "created-desc":
      return "newest on X"
    case "likes-desc":
      return "most likes"
    case "saved-desc":
    default:
      return "newest saved"
  }
}

function getAuthorOptions(bookmarks: BookmarkRecord[]) {
  const countsByHandle = new Map<string, { handle: string; label: string; count: number }>()

  for (const bookmark of bookmarks) {
    const handle = bookmark.authorHandle.trim()
    if (!handle) {
      continue
    }

    const current = countsByHandle.get(handle) ?? {
      handle,
      label: bookmark.authorName ? `${bookmark.authorName} (@${handle})` : `@${handle}`,
      count: 0
    }

    current.count += 1
    countsByHandle.set(handle, current)
  }

  return Array.from(countsByHandle.values()).sort((left, right) => left.label.localeCompare(right.label))
}

interface WorkspaceProps {
  width: number | string
  minHeight: number
}

export function Workspace({ width, minHeight }: WorkspaceProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolderRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [bookmarkTags, setBookmarkTags] = useState<BookmarkTagRecord[]>([])
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
  const [summary, setSummary] = useState<SyncSummary>({
    ...createEmptySyncSummary(),
    status: "idle"
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [isSavingFolder, setIsSavingFolder] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [latestSyncRun, setLatestSyncRun] = useState<SyncRunRecord | null>(null)
  const [collapsedSections, setCollapsedSections] = useState({
    folders: false,
    authors: true,
    tags: true,
    time: true,
    content: true,
    sort: true
  })
  const isCompactLayout = typeof window !== "undefined" ? window.innerWidth < 1100 : false

  useEffect(() => {
    void refreshPopupData()
  }, [])

  async function refreshPopupData() {
    const data = await loadPopupData()
    setBookmarks(data.bookmarks)
    setFolders(data.folders)
    setBookmarkFolders(data.bookmarkFolders)
    setTags(data.tags)
    setBookmarkTags(data.bookmarkTags)
    setSummary(data.summary)
    setLatestSyncRun(data.latestSyncRun)
    setSelectedBookmarkId((current) => {
      if (current && data.bookmarks.some((bookmark) => bookmark.tweetId === current)) {
        return current
      }

      return data.bookmarks[0]?.tweetId
    })
  }

  async function handleSync() {
    setIsSyncing(true)
    setSummary((current) => ({
      ...current,
      status: "running",
      errorSummary: undefined
    }))

    try {
      await runSync()
    } catch {
      // The background sync persists the failed summary; refreshing popup state surfaces it.
    } finally {
      await refreshPopupData()
      setIsSyncing(false)
    }
  }

  async function handleCreateTag(name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setIsSavingTag(true)
    try {
      await createTag({ name: trimmedName })
      await refreshPopupData()
    } finally {
      setIsSavingTag(false)
    }
  }

  async function handleCreateFolder(name: string, parentId?: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setIsSavingFolder(true)
    try {
      await createFolder({ name: trimmedName, parentId })
      await refreshPopupData()
    } finally {
      setIsSavingFolder(false)
    }
  }

  async function handleAttachTag(tagId: string) {
    if (!selectedBookmarkId || !tagId) {
      return
    }

    setIsSavingTag(true)
    try {
      await attachTagToBookmark({ bookmarkId: selectedBookmarkId, tagId })
      await refreshPopupData()
    } finally {
      setIsSavingTag(false)
    }
  }

  async function handleMoveToFolder(folderId: string) {
    if (!selectedBookmarkId) {
      return
    }

    setIsSavingFolder(true)
    try {
      await moveBookmarkToFolder({ bookmarkId: selectedBookmarkId, folderId })
      await refreshPopupData()
    } finally {
      setIsSavingFolder(false)
    }
  }

  async function handleDetachTag(tagId: string) {
    if (!selectedBookmarkId) {
      return
    }

    setIsSavingTag(true)
    try {
      await detachTagFromBookmark({ bookmarkId: selectedBookmarkId, tagId })
      await refreshPopupData()
    } finally {
      setIsSavingTag(false)
    }
  }

  async function handleExport() {
    const payload = exportBookmarks(bookmarks)
    downloadJson("x-bookmarks.json", payload)
    return payload
  }

  async function handleReset() {
    setIsResetting(true)

    try {
      await resetStoredData()
      await refreshPopupData()
      handleClearFilters()
      setSelectedBookmarkId(undefined)
    } finally {
      setIsResetting(false)
    }
  }

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
  }

  function handleToggleAuthor(authorHandle: string) {
    setSelectedAuthorHandles((current) => {
      if (current.includes(authorHandle)) {
        return current.filter((value) => value !== authorHandle)
      }

      return [...current, authorHandle]
    })
  }

  function handleToggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      if (current.includes(tagId)) {
        return current.filter((value) => value !== tagId)
      }

      return [...current, tagId]
    })
  }

  function handleToggleSection(section: keyof typeof collapsedSections) {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section]
    }))
  }

  const visibleBookmarks = useMemo(() => {
    return applyBookmarkFilters(bookmarks, {
      query,
      folders,
      bookmarkFolders,
      selectedFolderId,
      bookmarkTags,
      selectedAuthorHandles,
      authorMatchMode,
      selectedTagIds,
      tagMatchMode,
      timeRange,
      onlyWithMedia,
      onlyLongform,
      sortOrder
    })
  }, [
    authorMatchMode,
    bookmarkFolders,
    bookmarkTags,
    bookmarks,
    folders,
    onlyLongform,
    onlyWithMedia,
    query,
    selectedFolderId,
    selectedAuthorHandles,
    selectedTagIds,
    sortOrder,
    tagMatchMode,
    timeRange
  ])

  const selectedBookmark = useMemo(() => {
    return visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ?? visibleBookmarks[0] ?? null
  }, [visibleBookmarks, selectedBookmarkId])

  useEffect(() => {
    if (!selectedBookmark && visibleBookmarks[0]) {
      setSelectedBookmarkId(visibleBookmarks[0].tweetId)
      return
    }

    if (selectedBookmark && selectedBookmark.tweetId !== selectedBookmarkId) {
      setSelectedBookmarkId(selectedBookmark.tweetId)
    }
  }, [selectedBookmark, selectedBookmarkId, visibleBookmarks])

  const tagsById = useMemo(() => mapTagsById(tags), [tags])
  const foldersById = useMemo(() => mapFoldersById(folders), [folders])
  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const authorOptions = useMemo(() => getAuthorOptions(bookmarks), [bookmarks])
  const sortLabel = useMemo(() => getSortLabel(sortOrder), [sortOrder])
  const selectedFolderLabel = useMemo(() => {
    if (!selectedFolderId) {
      return "All folders"
    }

    return foldersById.get(selectedFolderId)?.name ?? "Selected folder"
  }, [foldersById, selectedFolderId])
  const currentFolder = useMemo(() => {
    if (!selectedBookmark) {
      return null
    }

    const bookmarkFolder = bookmarkFolders.find((item) => item.bookmarkId === selectedBookmark.tweetId)
    return bookmarkFolder ? foldersById.get(bookmarkFolder.folderId) ?? null : null
  }, [bookmarkFolders, foldersById, selectedBookmark])
  const selectedBookmarkTags = useMemo(() => {
    if (!selectedBookmark) {
      return []
    }

    return findBookmarkTags(bookmarkTags, selectedBookmark.tweetId)
      .map((bookmarkTag) => tagsById.get(bookmarkTag.tagId))
      .filter(Boolean) as TagRecord[]
  }, [bookmarkTags, selectedBookmark, tagsById])

  return (
    <main
      style={{
        width,
        maxWidth: "100%",
        minHeight,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: 16,
        padding: 16,
        background: "linear-gradient(180deg, #f7fbff 0%, #eef4f8 100%)",
        color: "#102a43",
        boxSizing: "border-box"
      }}>
      <section
        style={{
          display: "grid",
          gap: 14,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(320px, 380px) 1fr",
            gap: 16,
            alignItems: "start"
          }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>X Bookmark Manager</h1>
            <p style={{ margin: 0, color: "#52606d" }}>Manage bookmarks with combined author, tag, and saved-time filters.</p>
          </div>
          <SyncPanel summary={summary} isSyncing={isSyncing} onSync={handleSync} />
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(280px, 320px) minmax(320px, 420px) minmax(360px, 1fr)",
          gap: 16,
          minHeight: 0
        }}>
        <FilterSidebar
          query={query}
          onQueryChange={setQuery}
          folderTree={folderTree}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          authorOptions={authorOptions}
          selectedAuthorHandles={selectedAuthorHandles}
          authorMatchMode={authorMatchMode}
          onToggleAuthor={handleToggleAuthor}
          onAuthorMatchModeChange={setAuthorMatchMode}
          tags={tags}
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
            sortLabel={sortLabel}
            folderLabel={selectedFolderLabel}
            onSelectBookmark={setSelectedBookmarkId}
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
            availableFolders={folders}
            tags={selectedBookmarkTags}
            availableTags={tags}
            onCreateFolder={handleCreateFolder}
            onMoveToFolder={handleMoveToFolder}
            onCreateTag={handleCreateTag}
            onAttachTag={handleAttachTag}
            onDetachTag={handleDetachTag}
            isSaving={isSavingTag || isSavingFolder}
          />
          <SettingsPanel
            bookmarks={bookmarks}
            tags={tags}
            latestSyncRun={latestSyncRun}
            onExport={handleExport}
            onReset={handleReset}
            isResetting={isResetting}
            compact
          />
        </section>
      </section>
    </main>
  )
}
