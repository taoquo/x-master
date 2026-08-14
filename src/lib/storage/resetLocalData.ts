import { clearBookmarksDbStores } from "./db.ts"
import { resetSettings } from "./settings.ts"

export async function resetLocalData() {
  await clearBookmarksDbStores()
  await resetSettings()
}
