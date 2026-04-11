import { resetBookmarksDb } from "./db.ts"
import { resetSettings } from "./settings.ts"

export async function resetLocalData() {
  await resetBookmarksDb()
  await resetSettings()
}
