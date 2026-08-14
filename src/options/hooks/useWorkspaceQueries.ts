import { useEffect, useState } from "react"
import type { BookmarkTagRecord, TagRecord, WorkspaceData } from "../../lib/types.ts"
import { createEmptySyncSummary } from "../../lib/types.ts"
import { buildWorkspaceStats, createEmptyWorkspaceStats } from "../../lib/workspace/stats.ts"
import { loadWorkspaceDataFromLocal } from "../../lib/workspace/loadWorkspaceData.ts"

export type WorkspaceTagPatch = {
  tags?: TagRecord[]
  bookmarkTags?: BookmarkTagRecord[]
}

function createEmptyWorkspaceData(): WorkspaceData {
  return {
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
    savedViews: [],
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

  function applyWorkspacePatch(
    mutate: (current: Pick<WorkspaceData, "tags" | "bookmarkTags">) => WorkspaceTagPatch
  ) {
    setData((previous) => {
      const patch = mutate({ tags: previous.tags, bookmarkTags: previous.bookmarkTags })
      const tags = patch.tags ?? previous.tags
      const bookmarkTags = patch.bookmarkTags ?? previous.bookmarkTags

      return {
        ...previous,
        tags,
        bookmarkTags,
        stats: buildWorkspaceStats({ bookmarks: previous.bookmarks, tags, bookmarkTags })
      }
    })
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
    refreshData,
    applyWorkspacePatch
  }
}
