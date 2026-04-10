import { useWorkspaceCommands } from "./useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "./useWorkspaceQueries.ts"

export function useWorkspaceData() {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    refreshData: queries.refreshData
  })

  return {
    ...queries,
    ...commands
  }
}
