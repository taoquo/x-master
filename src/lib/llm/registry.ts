import { LlmError } from "./errors.ts"
import { anthropicMessagesAdapter } from "./adapters/anthropicMessages.ts"
import { azureOpenAiChatAdapter } from "./adapters/azureOpenAiChat.ts"
import { googleGenerativeAiAdapter } from "./adapters/googleGenerativeAi.ts"
import { openAiChatAdapter } from "./adapters/openaiChat.ts"
import type { ChatApiAdapter } from "./types.ts"

// Dispatch is a map lookup on a data field, never a switch: adding a provider is a
// data edit in providers.ts. A provider may bind one adapter for all its models
// (a string) or choose per model (a map), which is how a vendor that serves
// different protocols per model is expressed without special cases.
export const CHAT_ADAPTERS: Record<string, ChatApiAdapter> = {
  "openai-chat": openAiChatAdapter,
  "anthropic-messages": anthropicMessagesAdapter,
  "google-generative-ai": googleGenerativeAiAdapter,
  "azure-openai-chat": azureOpenAiChatAdapter
}

export const KNOWN_API_IDS = Object.keys(CHAT_ADAPTERS)

export type ProviderApiBinding = string | Record<string, string>

export function apiFor(api: ProviderApiBinding, model: string): ChatApiAdapter {
  const apiId = typeof api === "string" ? api : (api[model] ?? Object.values(api)[0])

  if (!apiId) {
    throw new LlmError("unknown", `No API implementation is configured for model "${model}"`)
  }

  const adapter = CHAT_ADAPTERS[apiId]
  if (!adapter) {
    throw new LlmError("unknown", `No API implementation for "${apiId}"`)
  }

  return adapter
}
