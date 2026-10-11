import {
  createEmptySyncSummary,
  type AutoTagRunOutcome,
  type AutoTagRunState,
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
import { DEFAULT_PROVIDER_ID, LLM_PROVIDERS } from "../llm/providers.ts"
import type { JsonStrategy, ModelCapabilities } from "../llm/types.ts"
import { isSyncErrorKind } from "../x/syncErrors.ts"

export const SETTINGS_STORAGE_KEY = "settings"
const SETTINGS_SCHEMA_VERSION = 7
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
      activeProviderId: DEFAULT_PROVIDER_ID,
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      batchSize: DEFAULT_LLM_BATCH_SIZE,
      maxBookmarksPerRun: DEFAULT_LLM_MAX_BOOKMARKS_PER_RUN,
      tagVocabularyMode: "guarded"
    },
    blockedTagKeys: []
  }
}

// v6 stored a single provider ("openai-compatible") plus a base URL. The base URL
// is the only reliable hint about which provider an existing install was using, so
// the id is inferred from it. Nothing else about the config changes, so even a wrong
// guess only affects which entry the picker shows as selected: a non-empty baseUrl
// still overrides the provider default.
function inferProviderId(baseUrl: string, explicit: unknown): string {
  const candidate = typeof explicit === "string" ? explicit.trim() : ""
  if (candidate && LLM_PROVIDERS.some((provider) => provider.id === candidate)) {
    return candidate
  }

  const host = baseUrl.toLowerCase()
  if (host.includes("anthropic")) {
    return "anthropic"
  }
  if (host.includes("generativelanguage") || host.includes("makersuite")) {
    return "google"
  }
  if (host.includes("openai.azure.com")) {
    return "azure-openai"
  }

  return DEFAULT_PROVIDER_ID
}

const JSON_STRATEGIES: JsonStrategy[] = [
  "json-schema-strict",
  "json-schema",
  "json-object",
  "tool",
  "prompt-only"
]

function normalizeCapabilityOverrides(value: unknown): Partial<ModelCapabilities> | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const record = value as Record<string, unknown>
  const next: Partial<ModelCapabilities> = {}

  if (typeof record.temperature === "boolean") {
    next.temperature = record.temperature
  }
  if (typeof record.jsonStrategy === "string" && JSON_STRATEGIES.includes(record.jsonStrategy as JsonStrategy)) {
    next.jsonStrategy = record.jsonStrategy as JsonStrategy
  }
  for (const field of ["maxOutputTokens", "contextWindow"] as const) {
    const raw = record[field]
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      next[field] = Math.trunc(raw)
    }
  }

  return Object.keys(next).length ? next : undefined
}

function normalizeLearnedCapabilities(
  value: unknown
): Record<string, Partial<ModelCapabilities>> | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const next: Record<string, Partial<ModelCapabilities>> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeCapabilityOverrides(raw)
    if (key.trim() && normalized) {
      next[key.trim()] = normalized
    }
  }

  return Object.keys(next).length ? next : undefined
}

function normalizeAutoTagSettings(value: unknown): AutoTagSettings {
  const defaults = createDefaultAutoTagSettings()
  const record = (value ?? {}) as Partial<AutoTagSettings>
  const heuristics = (record.heuristics ?? {}) as Partial<AutoTagSettings["heuristics"]>
  const llm = (record.llm ?? {}) as Partial<AutoTagSettings["llm"]>
  const baseUrl = String(llm.baseUrl ?? "").trim()
  const model = String(llm.model ?? "").trim()
  const deploymentName = String(llm.deploymentName ?? "").trim()
  const apiVersion = String(llm.apiVersion ?? "").trim()
  const capabilityOverrides = normalizeCapabilityOverrides(llm.capabilityOverrides)
  const learnedCapabilities = normalizeLearnedCapabilities(llm.learnedCapabilities)

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
      activeProviderId: inferProviderId(baseUrl, llm.activeProviderId),
      baseUrl: baseUrl || defaults.llm.baseUrl,
      model: model || defaults.llm.model,
      ...(deploymentName ? { deploymentName } : {}),
      ...(apiVersion ? { apiVersion } : {}),
      batchSize: normalizeRange(llm.batchSize, defaults.llm.batchSize, 1, 50),
      maxBookmarksPerRun: normalizeRange(llm.maxBookmarksPerRun, defaults.llm.maxBookmarksPerRun, 1, 2000),
      tagVocabularyMode: normalizeTagVocabularyMode(llm.tagVocabularyMode, defaults.llm.tagVocabularyMode),
      ...(capabilityOverrides ? { capabilityOverrides } : {}),
      ...(learnedCapabilities ? { learnedCapabilities } : {})
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
  "all-blocked",
  "budget-exhausted",
  "timed-out",
  "cancelled",
  "failed"
])

// A run that never reached finishRun leaves a stale state behind. Anything older
// than this is treated as dead so the panel stops claiming a run is in flight
// and the background worker lets a new run take over.
export const AUTO_TAG_RUN_STALE_MS = 5 * 60 * 1000

// How long a silent heartbeat still counts as "alive" when deciding whether a new
// run may take the state over. A live run refreshes it once per batch and a batch
// is capped below this (DEFAULT_LLM_BATCH_BUDGET_MS), so a longer silence means
// the run is gone. Deliberately shorter than the UI-facing stale window: using
// that one here would let a dead run refuse new runs for a full five minutes.
export const AUTO_TAG_RUN_LIVENESS_MS = 2.5 * 60 * 1000

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
    blockedDroppedCount: normalizeCount(record.blockedDroppedCount),
    budgetDroppedCount: normalizeCount(record.budgetDroppedCount),
    unprocessedCount: normalizeCount(record.unprocessedCount),
    ...(error ? { error } : {})
  }
}

// Same rule as the run summary: a malformed state is dropped rather than
// defaulted, so "no run in flight" cannot be faked by a partial object.
function normalizeAutoTagRunState(value: unknown): AutoTagRunState | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const record = value as Partial<AutoTagRunState>
  const startedAt = String(record.startedAt ?? "").trim()
  if (!startedAt) {
    return undefined
  }

  const runId = typeof record.runId === "string" ? record.runId.trim() : ""

  return {
    ...(runId ? { runId } : {}),
    startedAt,
    updatedAt: String(record.updatedAt ?? "").trim() || startedAt,
    phase: record.phase === "llm" ? "llm" : "heuristics",
    processed: normalizeCount(record.processed),
    total: normalizeCount(record.total),
    ...(record.cancelRequested ? { cancelRequested: true } : {})
  }
}

// A heartbeat that stopped moving means the run died without reaching
// finishRun: the service worker was recycled, the browser was closed, or the
// run wedged. Callers use this to ignore the state instead of waiting forever.
export function isAutoTagRunStateStale(
  state: AutoTagRunState | undefined,
  nowMs = Date.now(),
  staleAfterMs = AUTO_TAG_RUN_STALE_MS
) {
  if (!state) {
    return false
  }

  const heartbeat = Date.parse(state.updatedAt)
  if (!Number.isFinite(heartbeat)) {
    return true
  }

  return nowMs - heartbeat > staleAfterMs
}

// "A run is really in flight right now." The absence of a state means finished
// (finishRun clears it), and a frozen heartbeat means the worker died, so both
// read as not-running. This is the only terminal signal a run produces: the
// progress messages are broadcast-only and never announce completion.
//
// `staleAfterMs` lets the takeover decision use the shorter liveness window while
// the UI keeps the longer one: the two questions differ, because a run that is
// dead enough to take over is not necessarily stale enough to stop reporting.
export function isAutoTagRunActive(
  state: AutoTagRunState | undefined,
  nowMs = Date.now(),
  staleAfterMs = AUTO_TAG_RUN_STALE_MS
) {
  return Boolean(state) && !isAutoTagRunStateStale(state, nowMs, staleAfterMs)
}

function normalizeSettings(settings: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  const lastAutoTagRun = normalizeAutoTagRunSummary(settings?.lastAutoTagRun)
  const autoTagRunState = normalizeAutoTagRunState(settings?.autoTagRunState)

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
    ...(lastAutoTagRun ? { lastAutoTagRun } : {}),
    ...(autoTagRunState ? { autoTagRunState } : {})
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

// Publishes "a run is in flight" before the first request goes out, so a run
// that dies mid-flight is still visible afterwards. Any stale state from a
// previous dead run is replaced, and a pending cancel is cleared with it: that
// cancel belonged to a run that is already gone.
//
// Returns the state it published, whose runId is the run's identity for every
// later write. A takeover replaces the state, and the superseded run must then
// stop writing rather than clobber its replacement.
export async function beginAutoTagRunState(input: {
  phase: "heuristics" | "llm"
  total: number
}): Promise<AutoTagRunState | undefined> {
  const startedAt = new Date().toISOString()
  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const next = await updateSettings({
    autoTagRunState: {
      runId,
      startedAt,
      updatedAt: startedAt,
      phase: input.phase,
      processed: 0,
      total: Math.max(0, Math.trunc(input.total))
    }
  })

  return next.autoTagRunState
}

// One round-trip does double duty: it refreshes the heartbeat and returns the
// state the options page may have written, which is how a cancel reaches a
// running pipeline without a second read per batch.
//
// It is scoped to the run that owns the state. A takeover installs a different
// runId, so a superseded run stops refreshing someone else's heartbeat, stops
// reading someone else's cancel flag, and is told to stop.
export async function touchAutoTagRunState(input: {
  runId: string | undefined
  phase: "heuristics" | "llm"
  processed: number
  total: number
}): Promise<{ state: AutoTagRunState | undefined; ownsState: boolean }> {
  let ownsState = false

  const next = await updateSettings((current) => {
    const state = current.autoTagRunState

    if (state === undefined || state.runId !== input.runId) {
      ownsState = false
      return {}
    }

    ownsState = true
    return {
      autoTagRunState: {
        ...state,
        updatedAt: new Date().toISOString(),
        phase: input.phase,
        processed: Math.max(0, Math.trunc(input.processed)),
        total: Math.max(0, Math.trunc(input.total))
      }
    }
  })

  return { state: next.autoTagRunState, ownsState }
}

// A cancel only marks the persisted state; the pipeline stops at the next batch
// boundary so suggestions already written are never lost.
export async function requestAutoTagRunCancel() {
  const next = await updateSettings((current) =>
    current.autoTagRunState ? { autoTagRunState: { ...current.autoTagRunState, cancelRequested: true } } : {}
  )

  return Boolean(next.autoTagRunState?.cancelRequested)
}

// Clears the in-flight state and records the outcome, but only for the run that
// owns the state. A run superseded by a takeover must stay silent: clearing here
// would hide the run that replaced it (and leave it looking uncancellable),
// while its own report describes work that was thrown away.
export async function finishAutoTagRun(input: {
  runId: string | undefined
  summary: AutoTagRunSummary
}): Promise<{ reported: boolean }> {
  let reported = false

  await updateSettings((current) => {
    const state = current.autoTagRunState
    // No state at all means nothing is live, so reporting is always safe. With a
    // state present, only its owner may clear it.
    reported = state === undefined || (input.runId !== undefined && state.runId === input.runId)

    if (!reported) {
      return {}
    }

    return { autoTagRunState: undefined, lastAutoTagRun: input.summary }
  })

  return { reported }
}

export async function clearAutoTagRunState() {
  await updateSettings({ autoTagRunState: undefined })
}
