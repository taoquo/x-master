import { useCallback, useEffect, useMemo, useState } from "react"
import { exportBookmarks } from "../../lib/export/exportBookmarks.ts"
import { buildFolderTree, createFolder, moveBookmarkToFolder, moveBookmarksToFolder } from "../../lib/storage/foldersStore.ts"
import { attachTagToBookmark, attachTagToBookmarks, createTag, detachTagFromBookmark } from "../../lib/storage/tagsStore.ts"
import type { BookmarkFolderRecord, BookmarkRecord, FolderRecord, SyncRunRecord, SyncSummary, TagRecord } from "../../lib/types.ts"
import { createEmptySyncSummary } from "../../lib/types.ts"
import { loadPopupData, resetStoredData, runSync } from "../../lib/runtime/popupClient.ts"

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

function mapFoldersById(folders: FolderRecord[]) {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

export function useWorkspaceData() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolderRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [bookmarkTags, setBookmarkTags] = useState<Array<{ id: string; bookmarkId: string; tagId: string; createdAt: string }>>([])
  const [summary, setSummary] = useState<SyncSummary>({
    ...createEmptySyncSummary(),
    status: "idle"
  })
  const [latestSyncRun, setLatestSyncRun] = useState<SyncRunRecord | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [isSavingFolder, setIsSavingFolder] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const refreshData = useCallback(async () => {
    const data = await loadPopupData()
    setBookmarks(data.bookmarks)
    setFolders(data.folders)
    setBookmarkFolders(data.bookmarkFolders)
    setTags(data.tags)
    setBookmarkTags(data.bookmarkTags)
    setSummary(data.summary)
    setLatestSyncRun(data.latestSyncRun)
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const handleSync = useCallback(async () => {
    setIsSyncing(true)
    setSummary((current) => ({
      ...current,
      status: "running",
      errorSummary: undefined
    }))

    try {
      await runSync()
    } catch {
      // The background sync persists the failed summary; refresh after the request settles.
    } finally {
      await refreshData()
      setIsSyncing(false)
    }
  }, [refreshData])

  const handleCreateTag = useCallback(
    async (name: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return
      }

      setIsSavingTag(true)
      try {
        await createTag({ name: trimmedName })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleAttachTag = useCallback(
    async (bookmarkId: string, tagId: string) => {
      setIsSavingTag(true)
      try {
        await attachTagToBookmark({ bookmarkId, tagId })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleDetachTag = useCallback(
    async (bookmarkId: string, tagId: string) => {
      setIsSavingTag(true)
      try {
        await detachTagFromBookmark({ bookmarkId, tagId })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleBulkAttachTag = useCallback(
    async (bookmarkIds: string[], tagId: string) => {
      setIsSavingTag(true)
      try {
        await attachTagToBookmarks({ bookmarkIds, tagId })
        await refreshData()
      } finally {
        setIsSavingTag(false)
      }
    },
    [refreshData]
  )

  const handleCreateFolder = useCallback(
    async (name: string, parentId?: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return
      }

      setIsSavingFolder(true)
      try {
        await createFolder({ name: trimmedName, parentId })
        await refreshData()
      } finally {
        setIsSavingFolder(false)
      }
    },
    [refreshData]
  )

  const handleMoveToFolder = useCallback(
    async (bookmarkId: string, folderId: string) => {
      setIsSavingFolder(true)
      try {
        await moveBookmarkToFolder({ bookmarkId, folderId })
        await refreshData()
      } finally {
        setIsSavingFolder(false)
      }
    },
    [refreshData]
  )

  const handleBulkMoveToFolder = useCallback(
    async (bookmarkIds: string[], folderId: string) => {
      setIsSavingFolder(true)
      try {
        await moveBookmarksToFolder({ bookmarkIds, folderId })
        await refreshData()
      } finally {
        setIsSavingFolder(false)
      }
    },
    [refreshData]
  )

  const handleExport = useCallback(async () => {
    const payload = exportBookmarks(bookmarks)
    downloadJson("x-bookmarks.json", payload)
    return payload
  }, [bookmarks])

  const handleReset = useCallback(async () => {
    setIsResetting(true)

    try {
      await resetStoredData()
      await refreshData()
    } finally {
      setIsResetting(false)
    }
  }, [refreshData])

  const foldersById = useMemo(() => mapFoldersById(folders), [folders])
  const folderTree = useMemo(() => buildFolderTree(folders), [folders])

  return {
    bookmarks,
    folders,
    foldersById,
    folderTree,
    bookmarkFolders,
    tags,
    bookmarkTags,
    summary,
    latestSyncRun,
    isSyncing,
    isSavingTag,
    isSavingFolder,
    isResetting,
    refreshData,
    handleSync,
    handleCreateTag,
    handleAttachTag,
    handleDetachTag,
    handleBulkAttachTag,
    handleCreateFolder,
    handleMoveToFolder,
    handleBulkMoveToFolder,
    handleExport,
    handleReset
  }
}
