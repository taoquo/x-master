import type { TagSuggestionRecord } from "../types.ts"
import {
  SUGGESTIONS_ACCEPT_BULK_MESSAGE,
  SUGGESTIONS_ACCEPT_MESSAGE,
  SUGGESTIONS_REJECT_MESSAGE
} from "./messages.ts"

// The background worker owns the suggestion store: the rules engine and the LLM
// step write to it from there, so the options page goes through the worker too
// rather than becoming a second, unsynchronized writer. That is also what the
// spec's message protocol was for; before this the messages had handlers but no
// sender, and the UI wrote to IndexedDB directly from its own realm.
async function sendMessage<T>(message: unknown): Promise<T | undefined> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return undefined
  }

  const response = (await chrome.runtime.sendMessage(message)) as T | { error: string } | undefined

  if (response && typeof response === "object" && "error" in response) {
    throw new Error(String((response as { error: unknown }).error))
  }

  return response as T | undefined
}

export async function requestAcceptSuggestion(suggestionId: string): Promise<TagSuggestionRecord | null> {
  return (await sendMessage<TagSuggestionRecord | null>({
    type: SUGGESTIONS_ACCEPT_MESSAGE,
    suggestionId
  })) ?? null
}

export async function requestRejectSuggestion(suggestionId: string): Promise<TagSuggestionRecord | null> {
  return (await sendMessage<TagSuggestionRecord | null>({
    type: SUGGESTIONS_REJECT_MESSAGE,
    suggestionId
  })) ?? null
}

export async function requestAcceptSuggestionsBulk(suggestionIds: string[]): Promise<{ acceptedCount: number }> {
  return (await sendMessage<{ acceptedCount: number }>({
    type: SUGGESTIONS_ACCEPT_BULK_MESSAGE,
    suggestionIds
  })) ?? { acceptedCount: 0 }
}
