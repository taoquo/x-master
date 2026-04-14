import { runBookmarkSync } from "./syncBookmarks.ts"
import { removeBookmarkSnapshot, upsertBookmarkSnapshot } from "../lib/storage/bookmarksStore.ts"
import { assignBookmarksToInboxIfMissing } from "../lib/storage/listsStore.ts"
import { resetLocalData } from "../lib/storage/resetLocalData.ts"
import { getSettings } from "../lib/storage/settings.ts"
import {
  attachTagToBookmark,
  createTag,
  detachTagFromBookmark,
  getAllBookmarkTags,
  getAllTags
} from "../lib/storage/tagsStore.ts"
import {
  LOAD_WORKSPACE_DATA_MESSAGE,
  RESET_LOCAL_DATA_MESSAGE,
  RUN_SYNC_MESSAGE,
  SITE_TWEET_BOOKMARK_SYNC_MESSAGE,
  SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE,
  SITE_TWEET_TAGGING_PREPARE_MESSAGE,
  SITE_TWEET_TAGGING_SET_TAG_MESSAGE
} from "../lib/runtime/messages.ts"
import type {
  Locale,
  SiteTweetBookmarkSyncResult,
  SiteTweetCreateTagResult,
  SiteTweetDraft,
  SiteTweetTagState,
  WorkspaceData
} from "../lib/types.ts"
import { loadWorkspaceDataFromLocal } from "../lib/workspace/loadWorkspaceData.ts"

const OPTIONS_PAGE_PATH = "options.html"

interface BackgroundDependencies {
  loadWorkspaceData: () => Promise<WorkspaceData>
  resetData: () => Promise<unknown>
  runSync: () => Promise<unknown>
  syncSiteTweetBookmark?: (input: { tweet: SiteTweetDraft; enabled: boolean }) => Promise<SiteTweetBookmarkSyncResult>
  prepareSiteTweetTagging?: (input: { tweet: SiteTweetDraft }) => Promise<SiteTweetTagState>
  setSiteTweetTag?: (input: { bookmarkId: string; tagId: string; enabled: boolean }) => Promise<SiteTweetTagState>
  createSiteTweetTag?: (input: { bookmarkId: string; name: string }) => Promise<SiteTweetCreateTagResult>
}

type BackgroundMessage =
  | { type: typeof LOAD_WORKSPACE_DATA_MESSAGE }
  | { type: typeof RESET_LOCAL_DATA_MESSAGE }
  | { type: typeof RUN_SYNC_MESSAGE }
  | { type: typeof SITE_TWEET_BOOKMARK_SYNC_MESSAGE; tweet: SiteTweetDraft; enabled: boolean }
  | { type: typeof SITE_TWEET_TAGGING_PREPARE_MESSAGE; tweet: SiteTweetDraft }
  | { type: typeof SITE_TWEET_TAGGING_SET_TAG_MESSAGE; bookmarkId: string; tagId: string; enabled: boolean }
  | { type: typeof SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE; bookmarkId: string; name: string }

export function createBackgroundMessageHandler({
  loadWorkspaceData,
  resetData,
  runSync,
  syncSiteTweetBookmark = async ({ tweet, enabled }) => syncSiteTweetBookmarkDefault({ tweet, enabled }),
  prepareSiteTweetTagging = async ({ tweet }) => prepareSiteTweetTaggingDefault({ tweet }),
  setSiteTweetTag = async ({ bookmarkId, tagId, enabled }) => setSiteTweetTagDefault({ bookmarkId, tagId, enabled }),
  createSiteTweetTag = async ({ bookmarkId, name }) => createSiteTweetTagDefault({ bookmarkId, name })
}: BackgroundDependencies) {
  return async function handleMessage(message: BackgroundMessage | { type: string; [key: string]: unknown }) {
    if (message.type === LOAD_WORKSPACE_DATA_MESSAGE) {
      return loadWorkspaceData()
    }

    if (message.type === RESET_LOCAL_DATA_MESSAGE) {
      return resetData()
    }

    if (message.type === RUN_SYNC_MESSAGE) {
      return runSync()
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

async function syncSiteTweetBookmarkDefault({
  tweet,
  enabled
}: {
  tweet: SiteTweetDraft
  enabled: boolean
}): Promise<SiteTweetBookmarkSyncResult> {
  if (enabled) {
    const bookmark = await upsertBookmarkSnapshot(tweet)
    await assignBookmarksToInboxIfMissing([bookmark.tweetId])

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
