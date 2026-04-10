import {
  SITE_TWEET_BOOKMARK_SYNC_MESSAGE,
  SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE,
  SITE_TWEET_TAGGING_PREPARE_MESSAGE,
  SITE_TWEET_TAGGING_SET_TAG_MESSAGE
} from "../lib/runtime/messages.ts"
import type {
  SiteTweetBookmarkSyncResult,
  SiteTweetCreateTagResult,
  SiteTweetDraft,
  SiteTweetTagState
} from "../lib/types.ts"

function assertNoRuntimeError<T>(response: T | { error: string }): T {
  if (typeof response === "object" && response !== null && "error" in response) {
    throw new Error(response.error)
  }

  return response as T
}

export interface SiteTaggingClient {
  syncSiteTweetBookmark: (input: { tweet: SiteTweetDraft; enabled: boolean }) => Promise<SiteTweetBookmarkSyncResult>
  prepareSiteTweetTagging: (tweet: SiteTweetDraft) => Promise<SiteTweetTagState>
  setSiteTweetTag: (input: { bookmarkId: string; tagId: string; enabled: boolean }) => Promise<SiteTweetTagState>
  createSiteTweetTag: (input: { bookmarkId: string; name: string }) => Promise<SiteTweetCreateTagResult>
}

export function createSiteTaggingClient(): SiteTaggingClient {
  return {
    async syncSiteTweetBookmark({ tweet, enabled }) {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        throw new Error("Extension runtime unavailable")
      }

      return assertNoRuntimeError(
        await chrome.runtime.sendMessage({
          type: SITE_TWEET_BOOKMARK_SYNC_MESSAGE,
          tweet,
          enabled
        })
      )
    },
    async prepareSiteTweetTagging(tweet) {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        throw new Error("Extension runtime unavailable")
      }

      return assertNoRuntimeError(
        await chrome.runtime.sendMessage({
          type: SITE_TWEET_TAGGING_PREPARE_MESSAGE,
          tweet
        })
      )
    },
    async setSiteTweetTag({ bookmarkId, tagId, enabled }) {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        throw new Error("Extension runtime unavailable")
      }

      return assertNoRuntimeError(
        await chrome.runtime.sendMessage({
          type: SITE_TWEET_TAGGING_SET_TAG_MESSAGE,
          bookmarkId,
          tagId,
          enabled
        })
      )
    },
    async createSiteTweetTag({ bookmarkId, name }) {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        throw new Error("Extension runtime unavailable")
      }

      return assertNoRuntimeError(
        await chrome.runtime.sendMessage({
          type: SITE_TWEET_TAGGING_CREATE_TAG_MESSAGE,
          bookmarkId,
          name
        })
      )
    }
  }
}
