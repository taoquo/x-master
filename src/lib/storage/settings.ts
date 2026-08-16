import {
  createEmptySyncSummary,
  type AutoTagRunOutcome,
  type AutoTagRunSummary,
  type AutoTagSettings,
  type ExtensionSettings,
  type Locale,
  type KeywordTagRule,
  type SavedViewRecord,
  type SyncSummary,
  type ThemePreference,
  type TagVocabularyMode
} from "../types.ts"
import type { BookmarkSortOrder } from "../search/searchBookmarks.ts"
import { canonicalTagKey } from "../tags/canonical.ts"
import { isSyncErrorKind } from "../x/syncErrors.ts"

const SETTINGS_STORAGE_KEY = "settings"
const SETTINGS_SCHEMA_VERSION = 6
const SYNC_STRATEGY_VERSION = 1
const DEFAULT_LOCALE: Locale = "en"
const DEFAULT_THEME_PREFERENCE: ThemePreference = "system"
const DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES = 3
const DEFAULT_LEFT_SIDEBAR_WIDTH = 280
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 360
const SAVED_VIEW_SORT_ORDERS = new Set<BookmarkSortOrder>(["timeline", "saved-desc", "saved-asc", "created-desc", "likes-desc"])
const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1"
const DEFAULT_LLM_MODEL = "gpt-4o-mini"
const DEFAULT_LLM_BATCH_SIZE = 10
const DEFAULT_LLM_MAX_BOOKMARKS_PER_RUN = 200

function normalizeLocale(locale: unknown): Locale {
  return locale === "en" || locale === "zh-CN" ? locale : DEFAULT_LOCALE
}

function normalizeThemePreference(themePreference: unknown): ThemePreference {
  return themePreference === "light" || themePreference === "dark" || themePreference === "system"
    ? themePreference
    : DEFAULT_THEME_PREFERENCE
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

function normalizeKeywordRules(value: unknown): KeywordTagRule[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((rule) => ({
      keyword: String((rule as Partial<KeywordTagRule>)?.keyword ?? "").trim(),
      tagName: String((rule as Partial<KeywordTagRule>)?.tagName ?? "").trim()
    }))
    .filter((rule) => rule.keyword.length > 0 && rule.tagName.length > 0)
}

const TAG_VOCABULARY_MODES = new Set<TagVocabularyMode>(["closed", "guarded", "open"])

function normalizeTagVocabularyMode(value: unknown, fallback: TagVocabularyMode): TagVocabularyMode {
  return typeof value === "string" && TAG_VOCABULARY_MODES.has(value as TagVocabularyMode)
    ? (value as TagVocabularyMode)
    : fallback
}

function normalizeBlockedTagKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const keys = new Set<string>()
  for (const entry of value) {
    const key = canonicalTagKey(String(entry ?? ""))
    if (key) {
      keys.add(key)
    }
  }

  return [...keys]
}

export function createDefaultAutoTagSettings(): AutoTagSettings {
  return {
    enabled: false,
    runAfterSync: true,
    heuristics: {
      useHashtags: true,
      useAuthors: true,
      keywordRules: []
    },
    llm: {
      enabled: false,
      provider: "openai-compatible",
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      batchSize: DEFAULT_LLM_BATCH_SIZE,
      maxBookmarksPerRun: DEFAULT_LLM_MAX_BOOKMARKS_PER_RUN,
      tagVocabularyMode: "guarded"
    },
    blockedTagKeys: []
  }
}

function normalizeAutoTagSettings(value: unknown): AutoTagSettings {
  const defaults = createDefaultAutoTagSettings()
  const record = (value ?? {}) as Partial<AutoTagSettings>
  const heuristics = (record.heuristics ?? {}) as Partial<AutoTagSettings["heuristics"]>
  const llm = (record.llm ?? {}) as Partial<AutoTagSettings["llm"]>
  const baseUrl = String(llm.baseUrl ?? "").trim()
  const model = String(llm.model ?? "").trim()

  return {
    enabled: Boolean(record.enabled),
    runAfterSync: record.runAfterSync === undefined ? defaults.runAfterSync : Boolean(record.runAfterSync),
    heuristics: {
      useHashtags: heuristics.useHashtags === undefined ? defaults.heuristics.useHashtags : Boolean(heuristics.useHashtags),
      useAuthors: heuristics.useAuthors === undefined ? defaults.heuristics.useAuthors : Boolean(heuristics.useAuthors),
      keywordRules: normalizeKeywordRules(heuristics.keywordRules)
    },
    llm: {
      enabled: Boolean(llm.enabled),
      provider: "openai-compatible",
      baseUrl: baseUrl || defaults.llm.baseUrl,
      model: model || defaults.llm.model,
      batchSize: normalizeRange(llm.batchSize, defaults.llm.batchSize, 1, 50),
      maxBookmarksPerRun: normalizeRange(llm.maxBookmarksPerRun, defaults.llm.maxBookmarksPerRun, 1, 2000),
      tagVocabularyMode: normalizeTagVocabularyMode(llm.tagVocabularyMode, defaults.llm.tagVocabularyMode)
    },
    blockedTagKeys: normalizeBlockedTagKeys(record.blockedTagKeys)
  }
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

const AUTO_TAG_RUN_OUTCOMES = new Set<AutoTagRunOutcome>([
  "ok",
  "disabled",
  "llm-disabled",
  "missing-api-key",
  "no-candidates",
  "empty-vocabulary",
  "failed"
])

function normalizeCount(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0
}

// Diagnostics only: a malformed or missing summary is dropped rather than
// defaulted, so the panel can distinguish "never ran" from "ran with zeros".
function normalizeAutoTagRunSummary(value: unknown): AutoTagRunSummary | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const record = value as Partial<AutoTagRunSummary>
  const finishedAt = String(record.finishedAt ?? "").trim()
  if (!finishedAt || !AUTO_TAG_RUN_OUTCOMES.has(record.outcome as AutoTagRunOutcome)) {
    return undefined
  }

  const error = String(record.error ?? "").trim()

  return {
    finishedAt,
    outcome: record.outcome as AutoTagRunOutcome,
    suggestedCount: normalizeCount(record.suggestedCount),
    pendingCount: normalizeCount(record.pendingCount),
    candidateCount: normalizeCount(record.candidateCount),
    llmProcessedCount: normalizeCount(record.llmProcessedCount),
    llmBatchCount: normalizeCount(record.llmBatchCount),
    llmFailedBatchCount: normalizeCount(record.llmFailedBatchCount),
    newTagBudget: normalizeCount(record.newTagBudget),
    vocabularySize: normalizeCount(record.vocabularySize),
    blockedTagKeyCount: normalizeCount(record.blockedTagKeyCount),
    ...(error ? { error } : {})
  }
}

function normalizeSettings(settings: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  const lastAutoTagRun = normalizeAutoTagRunSummary(settings?.lastAutoTagRun)

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
    hashtagBackfillDone: Boolean(settings?.hashtagBackfillDone),
    autoTag: normalizeAutoTagSettings(settings?.autoTag),
    ...(lastAutoTagRun ? { lastAutoTagRun } : {})
  }
}

export function createDefaultSettings(): ExtensionSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    locale: DEFAULT_LOCALE,
    themePreference: DEFAULT_THEME_PREFERENCE,
    lastSyncSummary: createEmptySyncSummary(),
    syncStrategyVersion: SYNC_STRATEGY_VERSION,
    hasCompletedInitialFullSync: false,
    incrementalStopBufferPages: DEFAULT_INCREMENTAL_STOP_BUFFER_PAGES,
    leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
    rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
    savedViews: [],
    hashtagBackfillDone: false,
    autoTag: createDefaultAutoTagSettings()
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

// Serializes every read-modify-write. Two concurrent updateSettings calls used
// to read the same snapshot and the slower write silently reverted the faster
// one, which is how a saved tag-vocabulary mode could reappear as its previous
// value while the panel still showed the new one.
let settingsWriteQueue: Promise<unknown> = Promise.resolve()

// saveSettings is a full overwrite: every caller that only knows about a few
// fields would silently reset the rest to defaults. updateSettings reads the
// current snapshot first so partial writers cannot clobber unrelated settings.
// The patch may also be a function, which is the only safe way to edit a nested
// object: a plain patch built from a React snapshot reverts every sibling field
// that changed while the component was awaiting something.
export async function updateSettings(
  patch: Partial<ExtensionSettings> | ((current: ExtensionSettings) => Partial<ExtensionSettings>)
): Promise<ExtensionSettings> {
  const run = settingsWriteQueue.then(async () => {
    const current = await getSettings()
    const next = normalizeSettings({ ...current, ...(typeof patch === "function" ? patch(current) : patch) })

    if (typeof chrome !== "undefined" && chrome.storage?.local?.set) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: next })
    }

    return next
  })

  // A rejected write must not wedge the queue for every later caller.
  settingsWriteQueue = run.catch(() => undefined)

  return run
}

export async function saveLastSyncSummary(summary: SyncSummary) {
  const settings = await getSettings()
  await updateSettings({
    lastSyncSummary: {
      ...settings.lastSyncSummary,
      ...summary
    }
  })
}

export async function resetSettings() {
  await saveSettings(createDefaultSettings())
}
