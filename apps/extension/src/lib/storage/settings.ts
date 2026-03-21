import { createEmptySyncSummary, type ExtensionSettings, type SyncSummary } from "../types.ts"

const SETTINGS_STORAGE_KEY = "settings"

export function createDefaultSettings(): ExtensionSettings {
  return {
    schemaVersion: 2,
    hasCompletedOnboarding: false,
    lastSyncSummary: createEmptySyncSummary(),
    aiGeneration: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      model: "gpt-5-mini"
    },
    exportScope: "all"
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
        aiGeneration: {
          ...defaults.aiGeneration,
          ...stored.aiGeneration
        },
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

export async function saveAiGenerationSettings(settings: ExtensionSettings["aiGeneration"]) {
  const currentSettings = await getSettings()
  await saveSettings({
    ...currentSettings,
    aiGeneration: {
      ...currentSettings.aiGeneration,
      ...settings
    }
  })
}

export async function saveExportScope(exportScope: ExtensionSettings["exportScope"]) {
  const currentSettings = await getSettings()
  await saveSettings({
    ...currentSettings,
    exportScope
  })
}

export async function setHasCompletedOnboarding(hasCompletedOnboarding: boolean) {
  const currentSettings = await getSettings()
  await saveSettings({
    ...currentSettings,
    hasCompletedOnboarding
  })
}

export async function resetSettings() {
  await saveSettings(createDefaultSettings())
}
