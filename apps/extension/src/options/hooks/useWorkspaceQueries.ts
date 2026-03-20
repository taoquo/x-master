import { useCallback, useEffect, useMemo, useState } from "react"
import { createEmptySyncSummary, type BookmarkFolderRecord, type BookmarkRecord, type BookmarkTagRecord, type FolderRecord, type SyncRunRecord, type SyncSummary, type TagRecord } from "../../lib/types.ts"
import { loadPopupData } from "../../lib/runtime/popupClient.ts"
import { buildFolderTree } from "../../lib/storage/foldersStore.ts"

function mapFoldersById(folders: FolderRecord[]) {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load workspace data"
}

export function useWorkspaceQueries() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolderRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [bookmarkTags, setBookmarkTags] = useState<BookmarkTagRecord[]>([])
  const [summary, setSummary] = useState<SyncSummary>({
    ...createEmptySyncSummary(),
    status: "idle"
  })
  const [latestSyncRun, setLatestSyncRun] = useState<SyncRunRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    setIsLoading(true)

    try {
      const data = await loadPopupData()
      setBookmarks(data.bookmarks)
      setFolders(data.folders)
      setBookmarkFolders(data.bookmarkFolders)
      setTags(data.tags)
      setBookmarkTags(data.bookmarkTags)
      setSummary(data.summary)
      setLatestSyncRun(data.latestSyncRun)
      setLoadError(null)
    } catch (error) {
      setLoadError(toErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
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
    isLoading,
    loadError,
    refreshData
  }
}
