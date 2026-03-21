import { useWorkspaceCommands } from "./useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "./useWorkspaceQueries.ts"

export function useWorkspaceData() {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    bookmarks: queries.bookmarks,
    knowledgeCards: queries.knowledgeCards,
    bookmarkTags: queries.bookmarkTags,
    tags: queries.tags,
    exportScope: queries.exportScope,
    refreshData: queries.refreshData
  })

  return {
    ...queries,
    ...commands
  }
}
