import { useState } from "react"
import { runSync } from "../../lib/runtime/popupClient.ts"
import { createList, deleteList, moveBookmarkToList, moveBookmarksToList, renameList } from "../../lib/storage/listsStore.ts"
import { removeTagFromClassificationRules, saveClassificationRules } from "../../lib/storage/settings.ts"
import { attachTagToBookmark, attachTagToBookmarks, createTag, deleteTag, detachTagFromBookmark } from "../../lib/storage/tagsStore.ts"
import type { ClassificationRule } from "../../lib/types.ts"

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useWorkspaceCommands({ refreshData }: { refreshData: () => Promise<void> }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSavingLists, setIsSavingLists] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)

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

  return {
    isSyncing,
    isSavingLists,
    isSavingTags,
    isSavingRules,
    commandError,
    handleSync,
    handleCreateList,
    handleRenameList,
    handleDeleteList,
    handleMoveBookmarkToList,
    handleMoveBookmarksToList,
    handleCreateTag,
    handleDeleteTag,
    handleAttachTag,
    handleDetachTag,
    handleBulkAttachTag,
    handleSaveRules
  }
}
