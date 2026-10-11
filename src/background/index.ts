import { runBookmarkSync } from "./syncBookmarks.ts"
import { createLlmChat, testLlmConnectionFor } from "../lib/llm/orchestrator.ts"
import type { LlmConnectionTestResult } from "../lib/llm/orchestrator.ts"
import { resolveProvider, resolveBaseUrl } from "../lib/llm/providers.ts"
import { resolveAuth } from "../lib/llm/auth/index.ts"
import { runAutoTagPipeline } from "../lib/autotag/pipeline.ts"
import { reviewTagVocabulary, type TagVocabularyReviewResult } from "../lib/autotag/vocabularyReview.ts"
import {
  acceptTagSuggestion,
  acceptTagSuggestionsBulk,
  rejectTagSuggestion
} from "../lib/autotag/suggestionActions.ts"
import { removeBookmarkSnapshot, upsertBookmarkSnapshot } from "../lib/storage/bookmarksStore.ts"
import { backfillHashtagsFromRawPayloads } from "../lib/storage/backfillHashtags.ts"
import { releaseKeepAliveForAbandonedRun, startKeepAlive, stopKeepAlive } from "../lib/runtime/keepAlive.ts"
import { resetLocalData } from "../lib/storage/resetLocalData.ts"
import {
  AUTO_TAG_RUN_LIVENESS_MS,
  AUTO_TAG_RUN_STALE_MS,
  clearAutoTagRunState,
  getSettings,
  isAutoTagRunActive,
  requestAutoTagRunCancel,
  saveLastSyncSummary
} from "../lib/storage/settings.ts"
import {
  attachTagToBookmark,
  createTag,
  detachTagFromBookmark,
  getAllBookmarkTags,
  getAllTags
} from "../lib/storage/tagsStore.ts"
import {
  AUTOTAG_CANCEL_MESSAGE,
  AUTOTAG_RUN_MESSAGE,
  LLM_TEST_CONNECTION_MESSAGE,
  LOAD_WORKSPACE_DATA_MESSAGE,
  RESET_LOCAL_DATA_MESSAGE,
  RUN_SYNC_MESSAGE,
  SITE_TWEET_BOOKMARK_SYNC_MESSAGE,
  SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE,
  SITE_TWEET_TAGGING_PREPARE_MESSAGE,
  SITE_TWEET_TAGGING_SET_TAG_MESSAGE,
  SUGGESTIONS_ACCEPT_BULK_MESSAGE,
  SUGGESTIONS_ACCEPT_MESSAGE,
  SUGGESTIONS_REJECT_MESSAGE,
  TAG_VOCABULARY_REVIEW_MESSAGE
} from "../lib/runtime/messages.ts"
import type {
  Locale,
  SiteTweetBookmarkSyncResult,
  SiteTweetCreateTagResult,
  SiteTweetDraft,
  SiteTweetTagState,
  TagSuggestionRecord,
  WorkspaceData
} from "../lib/types.ts"
import { loadWorkspaceDataFromLocal } from "../lib/workspace/loadWorkspaceData.ts"

const OPTIONS_PAGE_PATH = "options.html"

interface BackgroundDependencies {
  loadWorkspaceData: () => Promise<WorkspaceData>
  resetData: () => Promise<unknown>
  runSync: () => Promise<unknown>
  runAutoTag?: () => Promise<unknown>
  cancelAutoTag?: () => Promise<boolean>
  // Injectable clock: the stale-run takeover is a time-based rule, and a test
  // cannot wait out the real stale window.
  now?: () => number
  shouldAutoTagAfterSync?: () => Promise<boolean>
  // One-time hashtag backfill. It used to run inside the auto-tag pipeline,
  // behind the "auto-tag is enabled" early return, so a fresh install with the
  // feature off (the default) never backfilled at all. It is a data migration
  // rather than an auto-tag concern, so it runs off the sync path instead.
  backfillHashtags?: () => Promise<unknown>
  acceptSuggestion?: (suggestionId: string) => Promise<TagSuggestionRecord | null>
  rejectSuggestion?: (suggestionId: string) => Promise<TagSuggestionRecord | null>
  acceptSuggestionsBulk?: (suggestionIds: string[]) => Promise<{ acceptedCount: number }>
  testLlmConnection?: () => Promise<LlmConnectionTestResult>
  reviewTagVocabulary?: () => Promise<TagVocabularyReviewResult>
  syncSiteTweetBookmark?: (input: { tweet: SiteTweetDraft; enabled: boolean }) => Promise<SiteTweetBookmarkSyncResult>
  prepareSiteTweetTagging?: (input: { tweet: SiteTweetDraft }) => Promise<SiteTweetTagState>
  setSiteTweetTag?: (input: { bookmarkId: string; tagId: string; enabled: boolean }) => Promise<SiteTweetTagState>
  createSiteTweetTag?: (input: { bookmarkId: string; name: string }) => Promise<SiteTweetCreateTagResult>
}

type BackgroundMessage =
  | { type: typeof LOAD_WORKSPACE_DATA_MESSAGE }
  | { type: typeof RESET_LOCAL_DATA_MESSAGE }
  | { type: typeof RUN_SYNC_MESSAGE }
  | { type: typeof AUTOTAG_RUN_MESSAGE }
  | { type: typeof AUTOTAG_CANCEL_MESSAGE }
  | { type: typeof SUGGESTIONS_ACCEPT_MESSAGE; suggestionId: string }
  | { type: typeof SUGGESTIONS_REJECT_MESSAGE; suggestionId: string }
  | { type: typeof SUGGESTIONS_ACCEPT_BULK_MESSAGE; suggestionIds: string[] }
  | { type: typeof LLM_TEST_CONNECTION_MESSAGE }
  | { type: typeof TAG_VOCABULARY_REVIEW_MESSAGE }
  | { type: typeof SITE_TWEET_BOOKMARK_SYNC_MESSAGE; tweet: SiteTweetDraft; enabled: boolean }
  | { type: typeof SITE_TWEET_TAGGING_PREPARE_MESSAGE; tweet: SiteTweetDraft }
  | { type: typeof SITE_TWEET_TAGGING_SET_TAG_MESSAGE; bookmarkId: string; tagId: string; enabled: boolean }
  | { type: typeof SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE; bookmarkId: string; name: string }

export function createBackgroundMessageHandler({
  loadWorkspaceData,
  resetData,
  runSync,
  runAutoTag = runAutoTagPipeline,
  cancelAutoTag = requestAutoTagRunCancel,
  now = () => Date.now(),
  shouldAutoTagAfterSync = shouldAutoTagAfterSyncDefault,
  backfillHashtags = backfillHashtagsFromRawPayloads,
  acceptSuggestion = acceptTagSuggestion,
  rejectSuggestion = rejectTagSuggestion,
  acceptSuggestionsBulk = acceptTagSuggestionsBulk,
  testLlmConnection: testLlmConnectionDep = testLlmConnectionDefault,
  reviewTagVocabulary: reviewTagVocabularyDep = reviewTagVocabularyDefault,
  syncSiteTweetBookmark = async ({ tweet, enabled }) => syncSiteTweetBookmarkDefault({ tweet, enabled }),
  prepareSiteTweetTagging = async ({ tweet }) => prepareSiteTweetTaggingDefault({ tweet }),
  setSiteTweetTag = async ({ bookmarkId, tagId, enabled }) => setSiteTweetTagDefault({ bookmarkId, tagId, enabled }),
  createSiteTweetTag = async ({ bookmarkId, name }) => createSiteTweetTagDefault({ bookmarkId, name })
}: BackgroundDependencies) {
  let isSyncRunning = false
  let syncRunStartedAt: number | null = null
  // Holds the start time rather than a bare boolean. The old flag could only be
  // cleared by the run's own finally block, so a wedged run held it forever and
  // every later trigger answered "already running" with no way back short of
  // reloading the extension. A run older than the stale window is presumed dead
  // and may be taken over.
  let autoTagRunStartedAt: number | null = null

  // A run that is genuinely alive keeps refreshing its persisted heartbeat once
  // per batch. The in-memory timestamp cannot see a run left behind by an earlier
  // worker generation, and on its own it wrongly declared a healthy but slow run
  // dead and started a second one on top of it — two pipelines spending on the
  // same bookmarks and fighting over one run state.
  const hasLivePersistedRun = async (atMs: number) => {
    try {
      const persisted = await getSettings()
      // The liveness window, not the UI stale window: a run dead enough to take
      // over must not be able to refuse new runs for the full five minutes.
      return isAutoTagRunActive(persisted.autoTagRunState, atMs, AUTO_TAG_RUN_LIVENESS_MS)
    } catch {
      // Unreadable settings cannot prove a run is alive, so fall back to the
      // in-memory answer rather than blocking every future run.
      return false
    }
  }

  const startAutoTagRun = async () => {
    const startedAt = now()

    if (autoTagRunStartedAt !== null && startedAt - autoTagRunStartedAt <= AUTO_TAG_RUN_STALE_MS) {
      return { started: false, alreadyRunning: true }
    }

    if (await hasLivePersistedRun(startedAt)) {
      return { started: false, alreadyRunning: true }
    }

    const takeoverOf = autoTagRunStartedAt
    autoTagRunStartedAt = startedAt
    // The predecessor is abandoned: its `finally` will never release the holder
    // it took, so the alarm would otherwise stay armed for the life of the worker.
    if (takeoverOf !== null) {
      releaseKeepAliveForAbandonedRun()
    }
    // A batched run is mostly waiting, and the gaps between batches do not keep
    // an MV3 worker alive on their own, so hold a keepalive for the whole run.
    startKeepAlive()
    // Fire-and-forget like sync: suggestions are persisted by the pipeline and
    // progress is broadcast, so the message channel is released immediately.
    void (async () => {
      try {
        await runAutoTag()
      } catch {
        // Auto-tagging is best-effort; a failed run leaves no partial state
        // beyond already-persisted suggestions, which are safe to keep.
      } finally {
        stopKeepAlive()
        // Only the run that currently owns the lock may release it, otherwise a
        // wedged predecessor finishing late would unlock its own replacement.
        if (autoTagRunStartedAt === startedAt) {
          autoTagRunStartedAt = null
        }
      }
    })()

    return { started: true, ...(takeoverOf !== null ? { tookOverStaleRun: true } : {}) }
  }

  return async function handleMessage(message: BackgroundMessage | { type: string; [key: string]: unknown }) {
    if (message.type === LOAD_WORKSPACE_DATA_MESSAGE) {
      return loadWorkspaceData()
    }

    if (message.type === RESET_LOCAL_DATA_MESSAGE) {
      // Stop owning the runs before clearing: a live pipeline or sync keeps
      // writing into the stores that are about to be emptied, which is how a
      // reset used to refill tag-suggestions/llm-analysis and resurrect run
      // state for bookmarks that no longer existed. Clearing the persisted run
      // state is what tells the pipeline it lost ownership, and it stops at its
      // next batch boundary.
      autoTagRunStartedAt = null
      syncRunStartedAt = null
      isSyncRunning = false
      releaseKeepAliveForAbandonedRun()
      try {
        await clearAutoTagRunState()
      } catch {
        // Best-effort: the reset itself is what the caller asked for.
      }

      return resetData()
    }

    if (message.type === RUN_SYNC_MESSAGE) {
      // Same escape hatch as auto-tagging. A sync with no takeover rule answered
      // "already running" forever once one hung, with no way back short of
      // reloading the extension.
      if (isSyncRunning && syncRunStartedAt !== null && now() - syncRunStartedAt <= AUTO_TAG_RUN_STALE_MS) {
        return { started: false, alreadyRunning: true }
      }

      const takeoverOf = isSyncRunning ? syncRunStartedAt : null
      isSyncRunning = true
      syncRunStartedAt = now()
      const syncStartedAtSnapshot = syncRunStartedAt
      if (takeoverOf !== null) {
        releaseKeepAliveForAbandonedRun()
      }
      // A paged sync has the same shape as an auto-tag run: long, mostly
      // waiting, and fatal to lose halfway through.
      startKeepAlive()
      // Run the sync in the background instead of holding the message channel
      // open for the whole run. Progress and errors are persisted by the sync
      // itself (lastSyncSummary + sync runs), so callers poll that state.
      void (async () => {
        try {
          await runSync()

          // Backfill before the auto-tag gate: the hashtag rule needs the data
          // even when this run does not trigger auto-tagging.
          try {
            await backfillHashtags()
          } catch {
            // Best-effort migration; the sync result is what the caller waits for.
          }

          if (await shouldAutoTagAfterSync()) {
            await startAutoTagRun()
          }
        } catch (error) {
          await persistSyncErrorFallback(error)
        } finally {
          stopKeepAlive()
          // Only the run that owns the flag may clear it, so a superseded sync
          // finishing late cannot unlock its replacement.
          if (syncRunStartedAt === syncStartedAtSnapshot) {
            isSyncRunning = false
            syncRunStartedAt = null
          }
        }
      })()

      return { started: true, ...(takeoverOf !== null ? { tookOverStaleRun: true } : {}) }
    }

    if (message.type === AUTOTAG_RUN_MESSAGE) {
      return startAutoTagRun()
    }

    if (message.type === AUTOTAG_CANCEL_MESSAGE) {
      // The pipeline stops at the next batch boundary, so this only records the
      // request; already-persisted suggestions are kept either way.
      return { cancelRequested: await cancelAutoTag() }
    }

    if (message.type === SUGGESTIONS_ACCEPT_MESSAGE) {
      return acceptSuggestion(message.suggestionId as string)
    }

    if (message.type === SUGGESTIONS_REJECT_MESSAGE) {
      return rejectSuggestion(message.suggestionId as string)
    }

    if (message.type === SUGGESTIONS_ACCEPT_BULK_MESSAGE) {
      return acceptSuggestionsBulk(message.suggestionIds as string[])
    }

    if (message.type === LLM_TEST_CONNECTION_MESSAGE) {
      return testLlmConnectionDep()
    }

    if (message.type === TAG_VOCABULARY_REVIEW_MESSAGE) {
      return reviewTagVocabularyDep()
    }

    if (message.type === SITE_TWEET_BOOKMARK_SYNC_MESSAGE) {
      return syncSiteTweetBookmark({
        tweet: message.tweet as SiteTweetDraft,
        enabled: message.enabled as boolean
      })
    }

    if (message.type === SITE_TWEET_TAGGING_PREPARE_MESSAGE) {
      return prepareSiteTweetTagging({ tweet: message.tweet as SiteTweetDraft })
    }

    if (message.type === SITE_TWEET_TAGGING_SET_TAG_MESSAGE) {
      return setSiteTweetTag({
        bookmarkId: message.bookmarkId as string,
        tagId: message.tagId as string,
        enabled: message.enabled as boolean
      })
    }

    if (message.type === SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE) {
      return createSiteTweetTag({
        bookmarkId: message.bookmarkId as string,
        name: message.name as string
      })
    }

    throw new Error(`Unsupported message type: ${message.type}`)
  }
}

async function shouldAutoTagAfterSyncDefault() {
  try {
    const settings = await getSettings()
    return settings.autoTag.enabled && settings.autoTag.runAfterSync
  } catch {
    return false
  }
}

// Default "test connection" wiring for the settings panel: reads the stored
// credential for the active provider and pings that provider's model-listing
// endpoint. The reported strategy and dropped parameters are computed locally from
// capability data, so this costs no tokens. The credential itself is never returned.
async function testLlmConnectionDefault(): Promise<LlmConnectionTestResult> {
  const settings = await getSettings()
  const llmSettings = settings.autoTag.llm
  const provider = resolveProvider(llmSettings.activeProviderId)
  const auth = await resolveAuth(llmSettings.activeProviderId, { allowLegacy: true })

  if (provider.credentialKind !== "api-key-or-none" && !auth?.apiKey) {
    return { ok: false, providerId: provider.id, model: llmSettings.model, error: "missing-api-key" }
  }

  const result = await testLlmConnectionFor({ settings: llmSettings, credential: auth })
  return result.ok ? result : { ...result, error: result.message ?? "request-failed" }
}

// Vocabulary review is a single chat request over the whole tag list, so it can
// answer the message directly instead of going through the fire-and-forget path
// used by the batched auto-tag run.
async function reviewTagVocabularyDefault(): Promise<TagVocabularyReviewResult> {
  const [settings, tags, bookmarkTags] = await Promise.all([
    getSettings(),
    getAllTags(),
    getAllBookmarkTags()
  ])

  const llmSettings = settings.autoTag.llm
  const provider = resolveProvider(llmSettings.activeProviderId)
  const auth = await resolveAuth(llmSettings.activeProviderId, { allowLegacy: true })

  if (provider.credentialKind !== "api-key-or-none" && !auth?.apiKey) {
    return { ok: false, error: "missing-api-key", merges: [], renames: [] }
  }

  return reviewTagVocabulary({
    settings: { baseUrl: resolveBaseUrl(provider, llmSettings.baseUrl), model: llmSettings.model },
    apiKey: auth?.apiKey ?? "",
    tags,
    bookmarkTags,
    chat: createLlmChat({ settings: llmSettings, credential: auth })
  })
}

async function persistSyncErrorFallback(error: unknown) {
  try {
    const settings = await getSettings()

    // runBookmarkSync persists a terminal error summary before throwing. Only
    // write a fallback when the failure happened before that persistence.
    if (settings.lastSyncSummary.status === "error") {
      return
    }

    await saveLastSyncSummary({
      status: "error",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 1,
      lastSyncedAt: new Date().toISOString(),
      errorSummary: error instanceof Error ? error.message : String(error)
    })
  } catch {
    // Nothing left to report to; polling clients will hit their timeout.
  }
}

// Called once when the service worker starts. A sync or an auto-tag run only ever
// lives inside the worker that began it, so anything still marked "in flight" at
// startup belongs to a worker that is already gone. Left alone, the sync summary
// stayed "running" forever and every popup looked like a live sync until its ten
// minute poll gave up, and the run state kept claiming a run was in flight.
export async function reconcileInterruptedRuns() {
  try {
    const settings = await getSettings()

    if (settings.lastSyncSummary.status === "running") {
      await saveLastSyncSummary({
        status: "error",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        failedCount: 0,
        lastSyncedAt: new Date().toISOString(),
        errorKind: "interrupted"
      })
    }

    if (settings.autoTagRunState) {
      // Clearing it frees the run immediately instead of waiting out the liveness
      // window, and tells the popup to drop its last progress frame.
      await clearAutoTagRunState()
    }
  } catch {
    // Startup is best-effort: a failure here must not stop the worker from
    // serving messages.
  }
}

async function syncSiteTweetBookmarkDefault({
  tweet,
  enabled
}: {
  tweet: SiteTweetDraft
  enabled: boolean
}): Promise<SiteTweetBookmarkSyncResult> {
  if (enabled) {
    const bookmark = await upsertBookmarkSnapshot(tweet)

    return {
      bookmarkId: bookmark.tweetId,
      enabled: true
    }
  }

  await removeBookmarkSnapshot(tweet.tweetId)

  return {
    bookmarkId: tweet.tweetId,
    enabled: false
  }
}

async function buildSiteTweetTagState(bookmarkId: string, locale?: Locale): Promise<SiteTweetTagState> {
  const [tags, bookmarkTags] = await Promise.all([getAllTags(), getAllBookmarkTags()])
  const selectedTagIds = bookmarkTags
    .filter((bookmarkTag) => bookmarkTag.bookmarkId === bookmarkId)
    .map((bookmarkTag) => bookmarkTag.tagId)

  return {
    bookmarkId,
    tags,
    selectedTagIds,
    locale
  }
}

async function prepareSiteTweetTaggingDefault({ tweet }: { tweet: SiteTweetDraft }): Promise<SiteTweetTagState> {
  const [bookmark, settings] = await Promise.all([upsertBookmarkSnapshot(tweet), getSettings()])
  return buildSiteTweetTagState(bookmark.tweetId, settings.locale)
}

async function setSiteTweetTagDefault({
  bookmarkId,
  tagId,
  enabled
}: {
  bookmarkId: string
  tagId: string
  enabled: boolean
}): Promise<SiteTweetTagState> {
  if (enabled) {
    await attachTagToBookmark({ bookmarkId, tagId })
  } else {
    await detachTagFromBookmark({ bookmarkId, tagId })
  }

  return buildSiteTweetTagState(bookmarkId)
}

async function createSiteTweetTagDefault({
  bookmarkId,
  name
}: {
  bookmarkId: string
  name: string
}): Promise<SiteTweetCreateTagResult> {
  const createdTag = await createTag({ name })
  await attachTagToBookmark({ bookmarkId, tagId: createdTag.id })
  const state = await buildSiteTweetTagState(bookmarkId)

  return {
    ...state,
    createdTag
  }
}

async function loadWorkspaceData(): Promise<WorkspaceData> {
  return loadWorkspaceDataFromLocal()
}

export async function openOrFocusOptionsPage() {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL || !chrome.tabs?.query || !chrome.tabs?.update || !chrome.tabs?.create) {
    return
  }

  const optionsUrl = chrome.runtime.getURL(OPTIONS_PAGE_PATH)
  const existingTabs = await chrome.tabs.query({ url: optionsUrl })
  const existingTab = existingTabs[0]

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true })

    if (existingTab.windowId !== undefined && chrome.windows?.update) {
      await chrome.windows.update(existingTab.windowId, { focused: true })
    }

    return
  }

  await chrome.tabs.create({ url: optionsUrl })
}

const handleMessage = createBackgroundMessageHandler({
  loadWorkspaceData,
  resetData: async () => {
    await resetLocalData()
    return { success: true }
  },
  runSync: runBookmarkSync,
  syncSiteTweetBookmark: syncSiteTweetBookmarkDefault,
  prepareSiteTweetTagging: prepareSiteTweetTaggingDefault,
  setSiteTweetTag: setSiteTweetTagDefault,
  createSiteTweetTag: createSiteTweetTagDefault
})

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }))

    return true
  })
}

if (typeof chrome !== "undefined" && chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(() => {
    void openOrFocusOptionsPage()
  })
}

export { handleMessage, OPTIONS_PAGE_PATH }
