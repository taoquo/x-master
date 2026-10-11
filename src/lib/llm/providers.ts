import { resolveApiBaseUrl } from "../autotag/llmProvider.ts"
import type { CredentialKind } from "./auth/types.ts"

// Provider definitions are pure data: no adapter is imported here, so the options
// page can render the provider picker without pulling any HTTP code into
// options.js. Adapters are wired in ./registry.ts, which only the background uses.

export interface LlmProviderDefinition {
  id: string
  api: string
  defaultBaseUrl: string
  originPattern: string
  credentialKind: CredentialKind
  // true → the user must supply a base URL (resource-specific or self-hosted).
  needsBaseUrl: boolean
  needsDeployment?: boolean
  needsApiVersion?: boolean
  defaultApiVersion?: string
  extraHeaders?: Record<string, string>
  // Where the user creates a key. Opened with chrome.tabs.create, which needs no
  // `tabs` permission.
  apiKeyUrl: string
}

export const ANTHROPIC_VERSION = "2023-06-01"

export const LLM_PROVIDERS: LlmProviderDefinition[] = [
  {
    id: "openai",
    api: "openai-chat",
    defaultBaseUrl: "https://api.openai.com/v1",
    originPattern: "https://api.openai.com/*",
    credentialKind: "api-key",
    needsBaseUrl: false,
    apiKeyUrl: "https://platform.openai.com/api-keys"
  },
  {
    id: "anthropic",
    api: "anthropic-messages",
    defaultBaseUrl: "https://api.anthropic.com",
    originPattern: "https://api.anthropic.com/*",
    credentialKind: "api-key",
    needsBaseUrl: false,
    extraHeaders: { "anthropic-version": ANTHROPIC_VERSION },
    apiKeyUrl: "https://console.anthropic.com/settings/keys"
  },
  {
    id: "google",
    api: "google-generative-ai",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    originPattern: "https://generativelanguage.googleapis.com/*",
    credentialKind: "api-key",
    needsBaseUrl: false,
    apiKeyUrl: "https://aistudio.google.com/app/apikey"
  },
  {
    id: "azure-openai",
    api: "azure-openai-chat",
    defaultBaseUrl: "",
    originPattern: "",
    credentialKind: "azure-deployment",
    needsBaseUrl: true,
    needsDeployment: true,
    needsApiVersion: true,
    defaultApiVersion: "2024-10-21",
    apiKeyUrl: "https://portal.azure.com/"
  },
  {
    id: "custom",
    api: "openai-chat",
    defaultBaseUrl: "",
    originPattern: "",
    credentialKind: "api-key-or-none",
    needsBaseUrl: true,
    apiKeyUrl: ""
  }
]

export const DEFAULT_PROVIDER_ID = "openai"

export function resolveProvider(providerId: string | undefined): LlmProviderDefinition {
  return LLM_PROVIDERS.find((provider) => provider.id === providerId) ?? LLM_PROVIDERS[0]
}

export interface BaseUrlValidation {
  ok: boolean
  url?: string
  error?: "empty" | "invalid" | "protocol"
}

// A user-supplied endpoint is untrusted input. https only, plus plain http for a
// loopback host so local models keep working.
export function validateBaseUrl(baseUrl: string): BaseUrlValidation {
  const trimmed = (baseUrl ?? "").trim()
  if (!trimmed) {
    return { ok: false, error: "empty" }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: "invalid" }
  }

  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"
  if (url.protocol === "https:") {
    return { ok: true, url: trimmed }
  }

  if (url.protocol === "http:" && isLoopback) {
    return { ok: true, url: trimmed }
  }

  return { ok: false, error: "protocol" }
}

// The origin to ask Chrome for. Derived from the URL the user actually entered,
// so a self-hosted gateway asks for its own origin and nothing else.
export function permissionOrigin(baseUrl: string): string | undefined {
  const validation = validateBaseUrl(baseUrl)
  if (!validation.ok || !validation.url) {
    return undefined
  }

  try {
    return `${new URL(validation.url).origin}/*`
  } catch {
    return undefined
  }
}

export function resolveBaseUrl(provider: LlmProviderDefinition, configuredBaseUrl: string): string {
  return (configuredBaseUrl ?? "").trim() || provider.defaultBaseUrl
}

export function joinUrl(baseUrl: string, path: string): string {
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "")
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

// The OpenAI-compatible endpoints go through the same base-URL normalisation the
// single-provider implementation has always used ("a bare host gets /v1").
export function resolveOpenAiBaseUrl(baseUrl: string): string {
  return resolveApiBaseUrl(baseUrl)
}
