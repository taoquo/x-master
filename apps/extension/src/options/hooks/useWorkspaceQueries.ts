import { useCallback, useEffect, useState } from "react"
import { createEmptySyncSummary, type BookmarkRecord, type BookmarkTagRecord, type SyncRunRecord, type SyncSummary, type TagRecord } from "../../lib/types.ts"
import { loadPopupData } from "../../lib/runtime/popupClient.ts"

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load workspace data"
}

export function useWorkspaceQueries() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
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

  return {
    bookmarks,
    tags,
    bookmarkTags,
    summary,
    latestSyncRun,
    isLoading,
    loadError,
    refreshData
  }
}
