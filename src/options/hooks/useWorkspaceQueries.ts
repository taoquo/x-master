import { useEffect, useState } from "react"
import type { WorkspaceData } from "../../lib/types.ts"
import { createEmptySyncSummary } from "../../lib/types.ts"
import { createEmptyWorkspaceStats } from "../../lib/workspace/stats.ts"
import { loadWorkspaceDataFromLocal } from "../../lib/workspace/loadWorkspaceData.ts"

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

  async function refreshData({ background = false }: { background?: boolean } = {}) {
    if (!background) {
      setIsLoading(true)
    }

    try {
      const nextData = await loadWorkspaceDataFromLocal()
      setData(nextData)
      setLoadError(null)
    } catch (error) {
      setLoadError(toErrorMessage(error))
    } finally {
      if (!background) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void refreshData()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    function refreshFromExternalChange() {
      if (document.visibilityState === "hidden") {
        return
      }

      void refreshData({ background: true })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshData({ background: true })
      }
    }

    window.addEventListener("focus", refreshFromExternalChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", refreshFromExternalChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return {
    ...data,
    isLoading,
    loadError,
    refreshData
  }
}
