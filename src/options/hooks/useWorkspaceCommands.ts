import { useEffect, useState } from "react"
import { createWorkspaceExportFilename, exportBookmarks } from "../../lib/export/exportBookmarks.ts"
import {
  restoreWorkspaceBackup,
  validateWorkspaceBackupText,
  type WorkspaceBackupValidationResult,
  type WorkspaceRestoreResult
} from "../../lib/export/workspaceBackup.ts"
import { resetStoredData } from "../../lib/runtime/popupClient.ts"
import { runSyncAndWait } from "../../lib/runtime/syncStatus.ts"
import { subscribeSyncProgress, type SyncProgress } from "../../lib/runtime/syncProgress.ts"
import {
  acceptTagSuggestion,
  acceptTagSuggestionsBulk,
  rejectTagSuggestion
} from "../../lib/autotag/suggestionActions.ts"
import { getSettings, updateSettings } from "../../lib/storage/settings.ts"
import {
  attachTagToBookmark,
  attachTagToBookmarks,
  createTag,
  detachTagFromBookmark,
  mergeTags,
  renameTag,
  setTagParent,
  updateTagAliases
} from "../../lib/storage/tagsStore.ts"
import { deleteTagPermanently, unblockTagKey } from "../../lib/tags/tagActions.ts"
import { isSameTagName } from "../../lib/tags/canonical.ts"
import type { BookmarkTagRecord, SavedViewRecord, TagRecord, WorkspaceData } from "../../lib/types.ts"
import type { WorkspaceTagPatch } from "./useWorkspaceQueries.ts"

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function sortTagsByName(tags: TagRecord[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name))
}

function appendMissingRelations(
  bookmarkTags: BookmarkTagRecord[],
  relations: BookmarkTagRecord[]
): BookmarkTagRecord[] {
  const existingIds = new Set(bookmarkTags.map((relation) => relation.id))
  const additions = relations.filter((relation) => !existingIds.has(relation.id))
  return additions.length ? [...bookmarkTags, ...additions] : bookmarkTags
}

export function useWorkspaceCommands({
  refreshData,
  getWorkspaceData,
  applyWorkspacePatch
}: {
  refreshData: (options?: { background?: boolean }) => Promise<void>
  getWorkspaceData: () => WorkspaceData
  applyWorkspacePatch: (
    mutate: (current: Pick<WorkspaceData, "tags" | "bookmarkTags" | "tagSuggestions">) => WorkspaceTagPatch
  ) => void
}) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isValidatingBackup, setIsValidatingBackup] = useState(false)
  const [isRestoringBackup, setIsRestoringBackup] = useState(false)
  const [isResettingData, setIsResettingData] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [backupValidationResult, setBackupValidationResult] = useState<WorkspaceBackupValidationResult | null>(null)
  const [restoreResult, setRestoreResult] = useState<WorkspaceRestoreResult | null>(null)
  const [resetResult, setResetResult] = useState<{ success: true } | null>(null)

  useEffect(() => subscribeSyncProgress(setSyncProgress), [])

  async function handleSync() {
    setCommandError(null)
    setSyncProgress(null)
    setIsSyncing(true)

    try {
      await runSyncAndWait()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Sync failed"))
    } finally {
      await refreshData()
      setIsSyncing(false)
      setSyncProgress(null)
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

  async function handleCreateTag(name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      const tag = await createTag({ name: trimmedName })
      // A deliberate re-create clears any block left behind by a past deletion.
      await unblockTagKey(trimmedName)
      applyWorkspacePatch(({ tags }) => ({ tags: sortTagsByName([...tags, tag]) }))
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
      const tagName = getWorkspaceData().tags.find((tag) => tag.id === tagId)?.name
      await deleteTagPermanently({ tagId, tagName })
      applyWorkspacePatch(({ tags, bookmarkTags, tagSuggestions }) => ({
        tags: tags.filter((tag) => tag.id !== tagId),
        bookmarkTags: bookmarkTags.filter((relation) => relation.tagId !== tagId),
        tagSuggestions: tagName
          ? tagSuggestions.map((suggestion) =>
              suggestion.status === "pending" && isSameTagName(suggestion.tagName, tagName)
                ? { ...suggestion, status: "rejected" as const, resolvedAt: new Date().toISOString() }
                : suggestion
            )
          : tagSuggestions
      }))
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to delete tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleMergeTags(sourceTagIds: string[], targetTagId: string) {
    if (!sourceTagIds.length || !targetTagId) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      const result = await mergeTags({ sourceTagIds, targetTagId })
      const mergedIds = new Set(result.mergedTagIds)
      applyWorkspacePatch(({ tags, bookmarkTags }) => {
        const remappedRelations = new Map<string, BookmarkTagRecord>()

        for (const relation of bookmarkTags) {
          if (!mergedIds.has(relation.tagId)) {
            remappedRelations.set(relation.id, relation)
            continue
          }

          const id = `${relation.bookmarkId}:${targetTagId}`
          if (!remappedRelations.has(id)) {
            remappedRelations.set(id, { ...relation, id, tagId: targetTagId })
          }
        }

        return {
          tags: sortTagsByName(
            tags
              .filter((tag) => !mergedIds.has(tag.id))
              .map((tag) => (tag.id === targetTagId ? result.target : tag))
          ),
          bookmarkTags: [...remappedRelations.values()]
        }
      })
      return result
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to merge tags"))
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
      applyWorkspacePatch(({ tags }) => ({
        tags: sortTagsByName(tags.map((existing) => (existing.id === tagId ? tag : existing)))
      }))
      return tag
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to rename tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleSetTagParent(tagId: string, parentId?: string) {
    if (!tagId) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      const tag = await setTagParent({ tagId, parentId })
      applyWorkspacePatch(({ tags }) => ({
        tags: sortTagsByName(tags.map((existing) => (existing.id === tagId ? tag : existing)))
      }))
      return tag
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to update tag parent"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleUpdateTagAliases(tagId: string, aliases: string[]) {
    if (!tagId) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      const tag = await updateTagAliases({ tagId, aliases })
      applyWorkspacePatch(({ tags }) => ({
        tags: sortTagsByName(tags.map((existing) => (existing.id === tagId ? tag : existing)))
      }))
      return tag
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to update tag aliases"))
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
      const relation = await attachTagToBookmark({ bookmarkId, tagId })
      applyWorkspacePatch(({ bookmarkTags }) => ({
        bookmarkTags: appendMissingRelations(bookmarkTags, [relation])
      }))
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
      applyWorkspacePatch(({ bookmarkTags }) => ({
        bookmarkTags: bookmarkTags.filter(
          (relation) => !(relation.bookmarkId === bookmarkId && relation.tagId === tagId)
        )
      }))
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
      const relations = await attachTagToBookmarks({ bookmarkIds, tagId })
      applyWorkspacePatch(({ bookmarkTags }) => ({
        bookmarkTags: appendMissingRelations(bookmarkTags, relations)
      }))
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to apply tag"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleAcceptSuggestion(suggestionId: string) {
    setCommandError(null)
    setIsSavingTags(true)

    try {
      const accepted = await acceptTagSuggestion(suggestionId)
      if (accepted) {
        applyWorkspacePatch(({ tagSuggestions }) => ({
          tagSuggestions: tagSuggestions.map((suggestion) =>
            suggestion.id === suggestionId ? accepted : suggestion
          )
        }))
      }
      // Accepting may create a tag and attach it; reload those in the background.
      await refreshData({ background: true })
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to accept suggestion"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleRejectSuggestion(suggestionId: string) {
    setCommandError(null)

    try {
      const rejected = await rejectTagSuggestion(suggestionId)
      if (rejected) {
        applyWorkspacePatch(({ tagSuggestions }) => ({
          tagSuggestions: tagSuggestions.map((suggestion) =>
            suggestion.id === suggestionId ? rejected : suggestion
          )
        }))
      }
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to reject suggestion"))
      throw error
    }
  }

  async function handleAcceptSuggestionsBulk(suggestionIds: string[]) {
    if (!suggestionIds.length) {
      return
    }

    setCommandError(null)
    setIsSavingTags(true)

    try {
      await acceptTagSuggestionsBulk(suggestionIds)
      await refreshData({ background: true })
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to accept suggestions"))
      throw error
    } finally {
      setIsSavingTags(false)
    }
  }

  async function handleSaveViews(savedViews: SavedViewRecord[]) {
    setCommandError(null)

    try {
      await updateSettings({ savedViews })
      await refreshData()
    } catch (error) {
      setCommandError(toErrorMessage(error, "Failed to save view"))
      throw error
    }
  }

  return {
    isSyncing,
    syncProgress,
    isExporting,
    isValidatingBackup,
    isRestoringBackup,
    isResettingData,
    isSavingTags,
    commandError,
    backupValidationResult,
    restoreResult,
    resetResult,
    handleSync,
    handleExportWorkspace,
    handleValidateBackupFile,
    handleRestoreBackupFile,
    handleResetLocalData,
    handleCreateTag,
    handleDeleteTag,
    handleMergeTags,
    handleRenameTag,
    handleSetTagParent,
    handleUpdateTagAliases,
    handleAttachTag,
    handleDetachTag,
    handleBulkAttachTag,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleAcceptSuggestionsBulk,
    handleSaveViews
  }
}
