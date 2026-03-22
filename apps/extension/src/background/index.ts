import { getAllBookmarks } from "../lib/storage/bookmarksStore.ts"
import { getAllKnowledgeCardDrafts, regenerateKnowledgeCardDraft } from "../lib/storage/knowledgeCardsStore.ts"
import { resetLocalData } from "../lib/storage/resetLocalData.ts"
import { getSettings } from "../lib/storage/settings.ts"
import { getLatestSyncRun } from "../lib/storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../lib/storage/tagsStore.ts"
import { LOAD_POPUP_DATA_MESSAGE, REGENERATE_CARD_MESSAGE, RESET_LOCAL_DATA_MESSAGE, RUN_SYNC_MESSAGE } from "../lib/runtime/messages.ts"
import type { PopupData, SourceMaterialRecord } from "../lib/types.ts"
import { toSourceMaterialRecord } from "../lib/sourceMaterials.ts"
import { runBookmarkSync } from "./syncBookmarks.ts"
import { generateKnowledgeCardDraftWithAi } from "../lib/cards/generateKnowledgeCardDraftWithAi.ts"

const OPTIONS_PAGE_PATH = "options.html"

interface BackgroundDependencies {
  loadPopupData: () => Promise<PopupData>
  resetData: () => Promise<unknown>
  runSync: () => Promise<unknown>
  regenerateCard: (cardId: string) => Promise<unknown>
}

export function createBackgroundMessageHandler({ loadPopupData, resetData, runSync, regenerateCard }: BackgroundDependencies) {
  return async function handleMessage(message: { type: string; cardId?: string }) {
    if (message.type === LOAD_POPUP_DATA_MESSAGE) {
      return loadPopupData()
    }

    if (message.type === RESET_LOCAL_DATA_MESSAGE) {
      return resetData()
    }

    if (message.type === RUN_SYNC_MESSAGE) {
      return runSync()
    }

    if (message.type === REGENERATE_CARD_MESSAGE) {
      if (!message.cardId) {
        throw new Error("Missing cardId")
      }

      return regenerateCard(message.cardId)
    }

    throw new Error(`Unsupported message type: ${message.type}`)
  }
}

async function loadPopupData() {
  const [bookmarks, knowledgeCards, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
    getAllBookmarks(),
    getAllKnowledgeCardDrafts(),
    getAllTags(),
    getAllBookmarkTags(),
    getSettings(),
    getLatestSyncRun()
  ])

  const sourceMaterials: SourceMaterialRecord[] = bookmarks.map(toSourceMaterialRecord)

  return {
    bookmarks,
    sourceMaterials,
    knowledgeCards,
    tags,
    bookmarkTags,
    aiGeneration: settings.aiGeneration,
    exportScope: settings.exportScope,
    hasCompletedOnboarding: settings.hasCompletedOnboarding,
    summary: settings.lastSyncSummary,
    latestSyncRun
  }
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
  loadPopupData,
  resetData: async () => {
    await resetLocalData()
    return { success: true }
  },
  runSync: runBookmarkSync,
  regenerateCard: async (cardId: string) => {
    const [settings, bookmarks] = await Promise.all([getSettings(), getAllBookmarks()])
    const sourceMaterial = bookmarks.find((bookmark) => `card-${bookmark.tweetId}` === cardId)

    if (!sourceMaterial) {
      throw new Error("Source material not found for card regeneration")
    }

    await regenerateKnowledgeCardDraft(
      toSourceMaterialRecord(sourceMaterial),
      {
        generateDraft: (nextSourceMaterial) =>
          generateKnowledgeCardDraftWithAi({
            sourceMaterial: nextSourceMaterial,
            settings: settings.aiGeneration
          })
      }
    )

    return { success: true }
  }
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
