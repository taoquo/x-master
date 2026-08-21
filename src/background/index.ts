import { runBookmarkSync } from "./syncBookmarks.ts"
import { testLlmConnection } from "../lib/autotag/llmProvider.ts"
import { runAutoTagPipeline } from "../lib/autotag/pipeline.ts"
import { reviewTagVocabulary, type TagVocabularyReviewResult } from "../lib/autotag/vocabularyReview.ts"
import {
  acceptTagSuggestion,
  acceptTagSuggestionsBulk,
  rejectTagSuggestion
} from "../lib/autotag/suggestionActions.ts"
import { removeBookmarkSnapshot, upsertBookmarkSnapshot } from "../lib/storage/bookmarksStore.ts"
import { startKeepAlive, stopKeepAlive } from "../lib/runtime/keepAlive.ts"
import { resetLocalData } from "../lib/storage/resetLocalData.ts"
import { getSecrets } from "../lib/storage/secrets.ts"
import {
  AUTO_TAG_RUN_STALE_MS,
  getSettings,
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
  acceptSuggestion?: (suggestionId: string) => Promise<TagSuggestionRecord | null>
  rejectSuggestion?: (suggestionId: string) => Promise<TagSuggestionRecord | null>
  acceptSuggestionsBulk?: (suggestionIds: string[]) => Promise<{ acceptedCount: number }>
  testLlmConnection?: () => Promise<{ ok: boolean; error?: string }>
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
  // Holds the start time rather than a bare boolean. The old flag could only be
  // cleared by the run's own finally block, so a wedged run held it forever and
  // every later trigger answered "already running" with no way back short of
  // reloading the extension. A run older than the stale window is presumed dead
  // and may be taken over.
  let autoTagRunStartedAt: number | null = null

  const startAutoTagRun = () => {
    const startedAt = now()

    if (autoTagRunStartedAt !== null && startedAt - autoTagRunStartedAt <= AUTO_TAG_RUN_STALE_MS) {
      return { started: false, alreadyRunning: true }
    }

    const takeoverOf = autoTagRunStartedAt
    autoTagRunStartedAt = startedAt
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
      return resetData()
    }

    if (message.type === RUN_SYNC_MESSAGE) {
      if (isSyncRunning) {
        return { started: false, alreadyRunning: true }
      }

      isSyncRunning = true
      // A paged sync has the same shape as an auto-tag run: long, mostly
      // waiting, and fatal to lose halfway through.
      startKeepAlive()
      // Run the sync in the background instead of holding the message channel
      // open for the whole run. Progress and errors are persisted by the sync
      // itself (lastSyncSummary + sync runs), so callers poll that state.
      void (async () => {
        try {
          await runSync()

          if (await shouldAutoTagAfterSync()) {
            startAutoTagRun()
          }
        } catch (error) {
          await persistSyncErrorFallback(error)
        } finally {
          stopKeepAlive()
          isSyncRunning = false
        }
      })()

      return { started: true }
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
// key + LLM settings and pings the provider's /models endpoint.
async function testLlmConnectionDefault(): Promise<{ ok: boolean; error?: string }> {
  const [settings, secrets] = await Promise.all([getSettings(), getSecrets()])

  if (!secrets.llmApiKey) {
    return { ok: false, error: "missing-api-key" }
  }

  return testLlmConnection({ settings: settings.autoTag.llm, apiKey: secrets.llmApiKey })
}

// Vocabulary review is a single chat request over the whole tag list, so it can
// answer the message directly instead of going through the fire-and-forget path
// used by the batched auto-tag run.
async function reviewTagVocabularyDefault(): Promise<TagVocabularyReviewResult> {
  const [settings, secrets, tags, bookmarkTags] = await Promise.all([
    getSettings(),
    getSecrets(),
    getAllTags(),
    getAllBookmarkTags()
  ])

  if (!secrets.llmApiKey) {
    return { ok: false, error: "missing-api-key", merges: [], renames: [] }
  }

  return reviewTagVocabulary({
    settings: settings.autoTag.llm,
    apiKey: secrets.llmApiKey,
    tags,
    bookmarkTags
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
