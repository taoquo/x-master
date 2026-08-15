import { useWorkspaceCommands } from "./useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "./useWorkspaceQueries.ts"

export function useWorkspaceData() {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    refreshData: queries.refreshData,
    applyWorkspacePatch: queries.applyWorkspacePatch,
    getWorkspaceData: () => ({
      bookmarks: queries.bookmarks,
      tags: queries.tags,
      bookmarkTags: queries.bookmarkTags,
      savedViews: queries.savedViews,
      tagSuggestions: queries.tagSuggestions,
      summary: queries.summary,
      latestSyncRun: queries.latestSyncRun,
      stats: queries.stats
    })
  })

  return {
    ...queries,
    ...commands
  }
}
