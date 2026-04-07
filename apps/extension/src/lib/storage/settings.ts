import {
  createEmptySyncSummary,
  type ClassificationRule,
  type ExtensionSettings,
  type Locale,
  type SyncSummary,
  type ThemePreference
} from "../types.ts"

const SETTINGS_STORAGE_KEY = "settings"
const SETTINGS_SCHEMA_VERSION = 3
const DEFAULT_LOCALE: Locale = "zh-CN"
const DEFAULT_THEME_PREFERENCE: ThemePreference = "system"

function normalizeLocale(locale: unknown): Locale {
  return locale === "en" || locale === "zh-CN" ? locale : DEFAULT_LOCALE
}

function normalizeThemePreference(themePreference: unknown): ThemePreference {
  return themePreference === "light" || themePreference === "dark" || themePreference === "system"
    ? themePreference
    : DEFAULT_THEME_PREFERENCE
}

function normalizeRule(rule: Partial<ClassificationRule> | undefined, index: number): ClassificationRule {
  return {
    id: String(rule?.id ?? `rule-${index + 1}`),
    name: String(rule?.name ?? "").trim(),
    enabled: rule?.enabled ?? true,
    authorHandles: Array.isArray(rule?.authorHandles) ? rule.authorHandles.map(String) : [],
    keywords: Array.isArray(rule?.keywords) ? rule.keywords.map(String) : [],
    requireMedia: Boolean(rule?.requireMedia),
    requireLongform: Boolean(rule?.requireLongform),
    targetTagIds: Array.isArray(rule?.targetTagIds) ? rule.targetTagIds.map(String) : []
  }
}

function normalizeSettings(settings: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  const defaults = createDefaultSettings()

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    locale: normalizeLocale(settings?.locale),
    themePreference: normalizeThemePreference(settings?.themePreference),
    lastSyncSummary: {
      ...defaults.lastSyncSummary,
      ...settings?.lastSyncSummary
    },
    classificationRules: Array.isArray(settings?.classificationRules)
      ? settings.classificationRules.map((rule, index) => normalizeRule(rule, index))
      : defaults.classificationRules
  }
}

export function createDefaultSettings(): ExtensionSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    locale: DEFAULT_LOCALE,
    themePreference: DEFAULT_THEME_PREFERENCE,
    lastSyncSummary: createEmptySyncSummary(),
    classificationRules: []
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.get) {
    return createDefaultSettings()
  }

  const stored = (await chrome.storage.local.get(SETTINGS_STORAGE_KEY))[SETTINGS_STORAGE_KEY] as
    | Partial<ExtensionSettings>
    | undefined

  return normalizeSettings(stored)
}

export async function saveSettings(settings: ExtensionSettings) {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.set) {
    return
  }

  await chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: normalizeSettings(settings)
  })
}

export async function saveLastSyncSummary(summary: SyncSummary) {
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    lastSyncSummary: {
      ...settings.lastSyncSummary,
      ...summary
    }
  })
}

export async function saveClassificationRules(classificationRules: ClassificationRule[]) {
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    classificationRules: classificationRules.map((rule, index) => normalizeRule(rule, index))
  })
}

export async function removeTagFromClassificationRules(tagId: string) {
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    classificationRules: settings.classificationRules.map((rule) => ({
      ...rule,
      targetTagIds: rule.targetTagIds.filter((currentTagId) => currentTagId !== tagId)
    }))
  })
}

export async function resetSettings() {
  await saveSettings(createDefaultSettings())
}
