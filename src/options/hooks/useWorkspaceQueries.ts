import { useEffect, useState } from "react"
import type { WorkspaceData } from "../../lib/types.ts"
import { loadWorkspaceData } from "../../lib/runtime/popupClient.ts"
import { createEmptySyncSummary } from "../../lib/types.ts"
import { createEmptyWorkspaceStats } from "../../lib/workspace/stats.ts"

function createEmptyWorkspaceData(): WorkspaceData {
  return {
    bookmarks: [],
    lists: [],
    bookmarkLists: [],
    tags: [],
    bookmarkTags: [],
    classificationRules: [],
    summary: createEmptySyncSummary(),
    latestSyncRun: null,
    stats: createEmptyWorkspaceStats()
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load workspace data"
}

export function useWorkspaceQueries() {
  const [data, setData] = useState<WorkspaceData>(createEmptyWorkspaceData())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function refreshData() {
    setIsLoading(true)

    try {
      const nextData = await loadWorkspaceData()
      setData(nextData)
      setLoadError(null)
    } catch (error) {
      setLoadError(toErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshData()
  }, [])

  return {
    ...data,
    isLoading,
    loadError,
    refreshData
  }
}
