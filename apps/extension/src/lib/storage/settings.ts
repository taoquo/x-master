import { createEmptySyncSummary, type ExtensionSettings, type SyncSummary } from "../types.ts"

const SETTINGS_STORAGE_KEY = "settings"

export function createDefaultSettings(): ExtensionSettings {
  return {
    schemaVersion: 1,
    hasCompletedOnboarding: false,
    lastSyncSummary: createEmptySyncSummary()
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const defaults = createDefaultSettings()

  if (typeof chrome === "undefined" || !chrome.storage?.local?.get) {
    return defaults
  }

  const stored = (await chrome.storage.local.get(SETTINGS_STORAGE_KEY))[SETTINGS_STORAGE_KEY] as
    | ExtensionSettings
    | undefined

  return stored
    ? {
        ...defaults,
        ...stored,
        lastSyncSummary: {
          ...defaults.lastSyncSummary,
          ...stored.lastSyncSummary
        }
      }
    : defaults
}

export async function saveSettings(settings: ExtensionSettings) {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.set) {
    return
  }

  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings })
}

export async function saveLastSyncSummary(summary: SyncSummary) {
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    lastSyncSummary: summary
  })
}

export async function resetSettings() {
  await saveSettings(createDefaultSettings())
}
