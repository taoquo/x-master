import { clearBookmarksDbStores } from "./db.ts"
import { saveSecrets } from "./secrets.ts"
import { resetSettings } from "./settings.ts"

export async function resetLocalData() {
  await clearBookmarksDbStores()
  await resetSettings()
  // The API key lives in its own storage key, so it used to survive a full reset
  // even though the confirmation promises every local setting is cleared.
  await saveSecrets({})
}
