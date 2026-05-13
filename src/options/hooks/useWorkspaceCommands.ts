import { useState } from "react"
import { createWorkspaceExportFilename, exportBookmarks } from "../../lib/export/exportBookmarks.ts"
import {
  restoreWorkspaceBackup,
  validateWorkspaceBackupText,
  type WorkspaceBackupValidationResult,
  type WorkspaceRestoreResult
} from "../../lib/export/workspaceBackup.ts"
import { resetStoredData, runSync } from "../../lib/runtime/popupClient.ts"
import { createList, deleteList, moveBookmarkToList, moveBookmarksToList, renameList } from "../../lib/storage/listsStore.ts"
import { getSettings, removeTagFromClassificationRules, saveClassificationRules, saveSettings } from "../../lib/storage/settings.ts"
import { attachTagToBookmark, attachTagToBookmarks, createTag, deleteTag, detachTagFromBookmark, renameTag } from "../../lib/storage/tagsStore.ts"
import type { ClassificationRule, SavedViewRecord, WorkspaceData } from "../../lib/types.ts"

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useWorkspaceCommands({
  refreshData,
  getWorkspaceData
}: {
  refreshData: () => Promise<void>
  getWorkspaceData: () => WorkspaceData
}) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isValidatingBackup, setIsValidatingBackup] = useState(false)
  const [isRestoringBackup, setIsRestoringBackup] = useState(false)
  const [isResettingData, setIsResettingData] = useState(false)
  const [isSavingLists, setIsSavingLists] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [backupValidationResult, setBackupValidationResult] = useState<WorkspaceBackupValidationResult | null>(null)
  const [restoreResult, setRestoreResult] = useState<WorkspaceRestoreResult | null>(null)
  const [resetResult, setResetResult] = useState<{ success: true } | null>(null)

  async function handleSync() {
    setCommandError(null)
    setIsSyncing(true)

    try {
      await runSync()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Sync failed"))
    } finally {
      await refreshData()
      setIsSyncing(false)
    }
  }

  async function handleExportWorkspace() {
    setCommandError(null)
    setIsExporting(true)

    try {
      if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        throw new Error("Download APIs unavailable")
      }

      const exportedAt = new Date().toISOString()
      const settings = await getSettings()
      const json = exportBookmarks({
        workspace: getWorkspaceData(),
        settings,
        exportedAt
      })
      const blob = new Blob([json], { type: "application/json;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      link.href = url
      link.download = createWorkspaceExportFilename(exportedAt)
      link.rel = "noopener"
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to export data"))
    } finally {
      setIsExporting(false)
    }
  }

  async function readBackupFile(file: File) {
    if (!file) {
      throw new Error("Backup file is required")
    }

    if (typeof file.text !== "function") {
      throw new Error("File APIs unavailable")
    }

    return file.text()
  }

  async function handleValidateBackupFile(file: File) {
    setCommandError(null)
    setBackupValidationResult(null)
    setRestoreResult(null)
    setResetResult(null)
    setIsValidatingBackup(true)

    try {
      const text = await readBackupFile(file)
      const validation = validateWorkspaceBackupText(text)
      setBackupValidationResult(validation)
      return validation
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to validate backup"))
      throw error
    } finally {
      setIsValidatingBackup(false)
    }
  }

  async function handleRestoreBackupFile(file: File) {
    setCommandError(null)
    setBackupValidationResult(null)
    setRestoreResult(null)
    setResetResult(null)
    setIsRestoringBackup(true)

    try {
      const text = await readBackupFile(file)
      const validation = validateWorkspaceBackupText(text)
      const result = await restoreWorkspaceBackup(validation.payload)
      setBackupValidationResult(validation)
      setRestoreResult(result)
      await refreshData()
      return result
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to restore backup"))
      throw error
    } finally {
      setIsRestoringBackup(false)
    }
  }

  async function handleResetLocalData() {
    setCommandError(null)
    setBackupValidationResult(null)
    setRestoreResult(null)
    setResetResult(null)
    setIsResettingData(true)

    try {
      await resetStoredData()
      setResetResult({ success: true })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to reset local data"))
      throw error
    } finally {
      setIsResettingData(false)
    }
  }

  async function handleCreateList(name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setCommandError(null)
    setIsSavingLists(true)

    try {
      const list = await createList({ name: trimmedName })
      await refreshData()
      return list
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to create list"))
      throw error
    } finally {
      setIsSavingLists(false)
    }
  }

  async function handleRenameList(listId: string, name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setCommandError(null)
    setIsSavingLists(true)

    try {
      const list = await renameList({ listId, name: trimmedName })
      await refreshData()
      return list
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to rename list"))
      throw error
    } finally {
      setIsSavingLists(false)
    }
  }

  async function handleDeleteList(listId: string) {
    setCommandError(null)
    setIsSavingLists(true)

    try {
      await deleteList(listId)
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to delete list"))
      throw error
    } finally {
      setIsSavingLists(false)
    }
  }

  async function handleMoveBookmarkToList(bookmarkId: string, listId: string) {
    setCommandError(null)
    setIsSavingLists(true)

    try {
      await moveBookmarkToList({ bookmarkId, listId })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to move bookmark"))
      throw error
    } finally {
      setIsSavingLists(false)
    }
  }

  async function handleMoveBookmarksToList(bookmarkIds: string[], listId: string) {
    if (!bookmarkIds.length || !listId) {
      return
    }

    setCommandError(null)
    setIsSavingLists(true)

    try {
      await moveBookmarksToList({ bookmarkIds, listId })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to move bookmarks"))
      throw error
    } finally {
      setIsSavingLists(false)
    }
  }

  async function handleCreateTag(name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      const tag = await createTag({ name: trimmedName })
      await refreshData()
      return tag
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to create tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleDeleteTag(tagId: string) {
    setCommandError(null)
    setIsSavingTags(true)

    try {
      await deleteTag(tagId)
      await removeTagFromClassificationRules(tagId)
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to delete tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleRenameTag(tagId: string, name: string) {
    const trimmedName = name.trim()
    if (!tagId || !trimmedName) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      const tag = await renameTag({ tagId, name: trimmedName })
      await refreshData()
      return tag
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to rename tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleAttachTag(bookmarkId: string, tagId: string) {
    if (!bookmarkId || !tagId) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      await attachTagToBookmark({ bookmarkId, tagId })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to attach tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleDetachTag(bookmarkId: string, tagId: string) {
    setCommandError(null)
    setIsSavingTags(true)

    try {
      await detachTagFromBookmark({ bookmarkId, tagId })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to detach tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleBulkAttachTag(bookmarkIds: string[], tagId: string) {
    if (!bookmarkIds.length || !tagId) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      await attachTagToBookmarks({ bookmarkIds, tagId })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to apply tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleSaveRules(classificationRules: ClassificationRule[]) {
    setCommandError(null)
    setIsSavingRules(true)

    try {
      await saveClassificationRules(classificationRules)
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to save rules"))
      throw error
    } finally {
      setIsSavingRules(false)
    }
  }

  async function handleSaveViews(savedViews: SavedViewRecord[]) {
    setCommandError(null)

    try {
      const settings = await getSettings()
      await saveSettings({
        ...settings,
        savedViews
      })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to save view"))
      throw error
    }
  }

  return {
    isSyncing,
    isExporting,
    isValidatingBackup,
    isRestoringBackup,
    isResettingData,
    isSavingLists,
    isSavingTags,
    isSavingRules,
    commandError,
    backupValidationResult,
    restoreResult,
    resetResult,
    handleSync,
    handleExportWorkspace,
    handleValidateBackupFile,
    handleRestoreBackupFile,
    handleResetLocalData,
    handleCreateList,
    handleRenameList,
    handleDeleteList,
    handleMoveBookmarkToList,
    handleMoveBookmarksToList,
    handleCreateTag,
    handleDeleteTag,
    handleRenameTag,
    handleAttachTag,
    handleDetachTag,
    handleBulkAttachTag,
    handleSaveRules,
    handleSaveViews
  }
}
