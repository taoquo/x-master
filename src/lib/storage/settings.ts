import {
  createEmptySyncSummary,
  type ClassificationRule,
  type ExtensionSettings,
  type Locale,
  type SavedViewRecord,
  type SyncSummary,
  type ThemePreference
} from "../types.ts"
import type { BookmarkSortOrder } from "../search/searchBookmarks.ts"
import { isSyncErrorKind } from "../x/syncErrors.ts"

const SETTINGS_STORAGE_KEY = "settings"
const SETTINGS_SCHEMA_VERSION = 4
const SYNC_STRATEGY_VERSION = 1
const DEFAULT_LOCALE: Locale = "en"
const DEFAULT_THEME_PREFERENCE: ThemePreference = "system"
const DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES = 3
const DEFAULT_LEFT_SIDEBAR_WIDTH = 280
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 360
const SAVED_VIEW_SORT_ORDERS = new Set<BookmarkSortOrder>(["timeline", "saved-desc", "saved-asc", "created-desc", "likes-desc"])

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

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function isSavedViewSortOrder(value: unknown): value is BookmarkSortOrder {
  return typeof value === "string" && SAVED_VIEW_SORT_ORDERS.has(value as BookmarkSortOrder)
}

function normalizeSavedView(view: Partial<SavedViewRecord> | undefined): SavedViewRecord | null {
  const id = String(view?.id ?? "").trim()
  const name = String(view?.name ?? "").trim()
  const createdAt = String(view?.createdAt ?? "").trim()
  const updatedAt = String(view?.updatedAt ?? "").trim()

  if (!id || !name || !createdAt || !updatedAt || !isSavedViewSortOrder(view?.sortOrder)) {
    return null
  }

  return {
    id,
    name,
    createdAt,
    updatedAt,
    query: String(view?.query ?? ""),
    activeTagIds: normalizeStringArray(view?.activeTagIds),
    activeAuthorHandles: normalizeStringArray(view?.activeAuthorHandles),
    onlyWithMedia: Boolean(view?.onlyWithMedia),
    onlyLongform: Boolean(view?.onlyLongform),
    sortOrder: view.sortOrder,
    viewMode: view?.viewMode === "list" ? "list" : "grid"
  }
}

function normalizeSavedViews(savedViews: unknown): SavedViewRecord[] {
  if (!Array.isArray(savedViews)) {
    return []
  }

  return savedViews
    .map((savedView) => normalizeSavedView(savedView as Partial<SavedViewRecord> | undefined))
    .filter((savedView): savedView is SavedViewRecord => savedView !== null)
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : fallback
}

function normalizeRange(value: unknown, fallback: number, min: number, max: number) {
  const normalized = normalizePositiveInteger(value, fallback)
  return Math.min(max, Math.max(min, normalized))
}

function normalizeSyncSummary(summary: Partial<SyncSummary> | undefined): SyncSummary {
  const defaults = createEmptySyncSummary()
  const errorKind = isSyncErrorKind(summary?.errorKind) ? summary.errorKind : undefined
  const normalized: SyncSummary = {
    ...defaults,
    ...summary,
    errorKind
  }

  if (errorKind === undefined) {
    delete normalized.errorKind
  }

  return normalized
}

function normalizeSettings(settings: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  const defaults = createDefaultSettings()

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    locale: normalizeLocale(settings?.locale),
    themePreference: normalizeThemePreference(settings?.themePreference),
    lastSyncSummary: normalizeSyncSummary(settings?.lastSyncSummary),
    syncStrategyVersion: normalizePositiveInteger(settings?.syncStrategyVersion, SYNC_STRATEGY_VERSION),
    hasCompletedInitialFullSync: Boolean(settings?.hasCompletedInitialFullSync),
    incrementalStopBufferPages: normalizePositiveInteger(
      settings?.incrementalStopBufferPages,
      DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES
    ),
    leftSidebarWidth: normalizeRange(settings?.leftSidebarWidth, DEFAULT_LEFT_SIDEBAR_WIDTH, 260, 420),
    rightSidebarWidth: normalizeRange(settings?.rightSidebarWidth, DEFAULT_RIGHT_SIDEBAR_WIDTH, 320, 520),
    savedViews: normalizeSavedViews(settings?.savedViews),
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
    classificationRules: [],
    syncStrategyVersion: SYNC_STRATEGY_VERSION,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES,
    leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
    rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
    savedViews: []
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

export async function saveSettings(settings: Partial<ExtensionSettings>) {
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
