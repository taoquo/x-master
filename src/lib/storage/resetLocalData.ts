import { clearBookmarksDbStores } from "./db.ts"
import { ensureInboxList } from "./listsStore.ts"
import { resetSettings } from "./settings.ts"

export async function resetLocalData() {
  await clearBookmarksDbStores()
  await ensureInboxList()
  await resetSettings()
}
