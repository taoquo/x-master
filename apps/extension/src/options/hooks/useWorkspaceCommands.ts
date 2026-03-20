import { useCallback, useState } from "react"
import { exportBookmarks } from "../../lib/export/exportBookmarks.ts"
import { createFolder, moveBookmarkToFolder, moveBookmarksToFolder } from "../../lib/storage/foldersStore.ts"
import { attachTagToBookmark, attachTagToBookmarks, createTag, detachTagFromBookmark } from "../../lib/storage/tagsStore.ts"
import { resetStoredData, runSync } from "../../lib/runtime/popupClient.ts"
import type { BookmarkRecord } from "../../lib/types.ts"

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

interface UseWorkspaceCommandsOptions {
  bookmarks: BookmarkRecord[]
  refreshData: () => Promise<void>
}

export function useWorkspaceCommands({ bookmarks, refreshData }: UseWorkspaceCommandsOptions) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [isSavingFolder, setIsSavingFolder] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleSync = useCallback(async () => {
    setIsSyncing(true)

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

  return {
    isSyncing,
    isSavingTag,
    isSavingFolder,
    isResetting,
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
