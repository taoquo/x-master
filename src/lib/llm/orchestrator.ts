import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  buildPrompt,
  parseSuggestedTags
} from "../autotag/llmProvider.ts"
import type { AutoTagLlmProvider, LlmTagSuggestion } from "../autotag/llmProvider.ts"
import type { AutoTagLlmSettings } from "../types.ts"
import { assembleRequest, learnedCapabilityKey, resolveCapabilities } from "./capabilities.ts"
import { LlmError, isLlmError } from "./errors.ts"
import { degradeStrategy, isUnsupportedSchemaError, parseJsonLoose, toStrictJsonSchema } from "./json.ts"
import { resolveBaseUrl, resolveProvider } from "./providers.ts"
import { apiFor } from "./registry.ts"
import { resolveAuth } from "./auth/index.ts"
import type { AdapterContext, DroppedOption, JsonStrategy, ModelCapabilities } from "./types.ts"

// Used only when the caller passes no budget. The pipeline always passes one.
const DEFAULT_CALL_BUDGET_MS = 4 * 60 * 1000

// A batch must be able to express every bookmark's answer in one response. Each
// entry is `{"tweetId":"…","tags":[{"name":"…","confidence":0.9}]}` — roughly 30-45
// tokens for the two tags the prompt allows — so this leaves headroom without asking
// a provider to reserve its whole output window.
const OUTPUT_TOKENS_PER_BOOKMARK = 64
const MIN_OUTPUT_TOKENS = 256
const MAX_OUTPUT_TOKENS = 4_096

export const MISSING_CREDENTIAL_ERROR = "missing-credentials"
const SCHEMA_NAME = "tag_suggestions"

// The shape the tag parser already understands. Optional properties are all
// listed as required on purpose: strict JSON-schema mode demands it, and every one
// of these fields is produced on every path anyway.
const TAG_RESULTS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tweetId: { type: "string" },
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                confidence: { type: "number" }
              },
              required: ["name", "confidence"],
              additionalProperties: false
            }
          }
        },
        required: ["tweetId", "tags"],
        additionalProperties: false
      }
    }
  },
  required: ["results"],
  additionalProperties: false
}

const SYSTEM_PROMPT =
  "You are a librarian assigning topical tags to bookmarked tweets. Answer with the requested JSON and nothing else."

const SCHEMA_PROMPT_SUFFIX =
  'The response must be a single JSON object matching this schema exactly: {"results":[{"tweetId":"...","tags":[{"name":"...","confidence":0.8}]}]}'

export interface LlmCallOptions {
  settings: AutoTagLlmSettings
  credential?: { apiKey?: string }
  fetchImpl?: AdapterContext["fetchImpl"]
  sleep?: AdapterContext["sleep"]
  timeoutMs?: number
  now?: () => number
  signal?: AbortSignal
  // Every adapter sleeps through this one seam, so wrapping it here reports a
  // provider-requested backoff for all four protocols without touching any
  // adapter (including the OpenAI-compatible engine, which sleeps internally).
  onWait?: (wait: { waitMs: number; reason: "rate-limit" | "retry" }) => void
}

// Capability resolution and request assembly happen once, in one place, because
// the answers interact: whether a schema can be enforced decides whether it has to
// travel in the prompt instead.
// Providers default their output ceiling to whatever suits a chat reply (Anthropic
// defaults to 1024 tokens). A batch of 25 answers does not fit in that, and a
// truncated response is indistinguishable from a model that answered nothing, so the
// ceiling is derived from the batch size instead of inherited.
function deriveMaxOutputTokens(batchSize: number, settings: AutoTagLlmSettings): number {
  const override = settings.capabilityOverrides?.maxOutputTokens
  if (override !== undefined) {
    return override
  }

  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, batchSize * OUTPUT_TOKENS_PER_BOOKMARK))
}

function planRequest(input: {
  settings: AutoTagLlmSettings
  providerId: string
  capabilities: ModelCapabilities
  batchSize: number
}): {
  strategy: JsonStrategy
  jsonSchema?: Record<string, unknown>
  maxOutputTokens?: number
  droppedOptions: DroppedOption[]
  promptIncludesSchema: boolean
} {
  let strategy = input.capabilities.jsonStrategy
  let schema: Record<string, unknown> | undefined = TAG_RESULTS_SCHEMA

  if (strategy === "json-schema-strict") {
    try {
      schema = toStrictJsonSchema(TAG_RESULTS_SCHEMA)
    } catch (error) {
      if (!isUnsupportedSchemaError(error)) {
        throw error
      }

      // Tagging degrades rather than failing: a slightly weaker guarantee still
      // produces usable tags, and the loose parser handles the answer.
      strategy = degradeStrategy(strategy)
    }
  }

  const assembled = assembleRequest({
    capabilities: { ...input.capabilities, jsonStrategy: strategy },
    temperature: 0,
    maxOutputTokens: deriveMaxOutputTokens(input.batchSize, input.settings),
    jsonSchema: schema,
    requireSchema: false
  })

  return {
    strategy: assembled.strategy,
    jsonSchema: assembled.jsonSchema,
    maxOutputTokens: assembled.maxOutputTokens,
    droppedOptions: assembled.droppedOptions,
    promptIncludesSchema: assembled.promptIncludesSchema
  }
}

function buildAdapterContext(options: LlmCallOptions, capabilities: ModelCapabilities): AdapterContext {
  const provider = resolveProvider(options.settings.activeProviderId)
  const now = options.now ?? (() => Date.now())
  const realSleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const sleep = options.onWait
    ? async (ms: number) => {
        options.onWait?.({ waitMs: ms, reason: "retry" })
        await realSleep(ms)
      }
    : realSleep

  return {
    apiKey: options.credential?.apiKey,
    baseUrl: resolveBaseUrl(provider, options.settings.baseUrl),
    deploymentName: options.settings.deploymentName,
    apiVersion: options.settings.apiVersion ?? provider.defaultApiVersion,
    extraHeaders: provider.extraHeaders,
    fetchImpl: options.fetchImpl,
    sleep,
    timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    now,
    signal: options.signal,
    capabilities
  }
}

export function capabilitiesFor(settings: AutoTagLlmSettings): ModelCapabilities {
  const provider = resolveProvider(settings.activeProviderId)
  return resolveCapabilities({
    providerId: provider.id,
    model: settings.model,
    overrides: settings.capabilityOverrides,
    learned: settings.learnedCapabilities?.[learnedCapabilityKey(provider.id, settings.model)]
  })
}

export function createAutoTagLlmProvider(options: LlmCallOptions): AutoTagLlmProvider {
  return {
    async suggestTags(input) {
      if (!input.bookmarks.length) {
        return []
      }

      if (!input.allowNewTags && !input.vocabulary.length) {
        return []
      }

      const settings = options.settings
      const provider = resolveProvider(settings.activeProviderId)
      const adapter = apiFor(provider.api, settings.model)
      const capabilities = capabilitiesFor(settings)
      const plan = planRequest({
        settings,
        providerId: provider.id,
        capabilities,
        batchSize: input.bookmarks.length
      })
      const context = buildAdapterContext(
        input.onWait ? { ...options, onWait: (wait) => input.onWait?.({ waitMs: wait.waitMs, reason: "rate-limit" }) } : options,
        capabilities
      )
      const now = context.now
      const deadlineMs = input.deadlineMs ?? now() + DEFAULT_CALL_BUDGET_MS

      const prompt = buildPrompt(input)
      // Only a provider that cannot enforce a schema needs the shape spelled out
      // in the prompt as well.
      const system = plan.promptIncludesSchema
        ? `${SYSTEM_PROMPT}\n\n${SCHEMA_PROMPT_SUFFIX}`
        : SYSTEM_PROMPT
      const validTweetIds = new Set(input.bookmarks.map((bookmark) => bookmark.tweetId))

      let lastError: unknown
      // A model that answered with prose gets exactly one more chance: the failure
      // is often a one-off, and the second request is still inside the budget.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await adapter.chatJson(
            {
              model: settings.model,
              system,
              user: prompt,
              schemaName: SCHEMA_NAME,
              jsonSchema: plan.jsonSchema,
              jsonMode: "prefer",
              temperature: 0,
              maxOutputTokens: plan.maxOutputTokens,
              deadlineMs
            },
            context
          )

          const parsed = result.parsed ?? parseJsonLoose(result.text)
          const suggestions: LlmTagSuggestion[] | null = parseSuggestedTags(
            JSON.stringify(parsed),
            validTweetIds
          )

          if (!suggestions) {
            throw new LlmError("invalid-json", "invalid-response")
          }

          return suggestions
        } catch (error) {
          lastError = error

          if (isLlmError(error) && error.kind === "invalid-json" && attempt === 0) {
            continue
          }

          throw error
        }
      }

      throw lastError instanceof Error ? lastError : new Error(String(lastError))
    }
  }
}

// The vocabulary review needs the same provider plumbing but its own prompt, so it
// borrows this instead of reaching for the OpenAI-compatible engine directly.
export function createLlmChat(options: LlmCallOptions) {
  const settings = options.settings

  return async (prompt: string): Promise<{ ok: boolean; content: string; error?: string }> => {
    const provider = resolveProvider(settings.activeProviderId)
    const capabilities = capabilitiesFor(settings)
    const context = buildAdapterContext(options, capabilities)

    try {
      const adapter = apiFor(provider.api, settings.model)
      const result = await adapter.chatJson(
        {
          model: settings.model,
          system: SYSTEM_PROMPT,
          user: prompt,
          jsonMode: "prefer",
          temperature: 0,
          deadlineMs: context.now() + DEFAULT_CALL_BUDGET_MS
        },
        context
      )

      return { ok: true, content: result.text || JSON.stringify(result.parsed ?? {}) }
    } catch (error) {
      const message = isLlmError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error)
      return { ok: false, content: "", error: message }
    }
  }
}

export interface LlmConnectionTestResult {
  ok: boolean
  // Optional so a minimal `{ ok: true }` (an existing injected test double) stays
  // assignable to this type.
  providerId?: string
  model?: string
  strategy?: JsonStrategy
  droppedOptions?: DroppedOption[]
  httpStatus?: number
  errorKind?: string
  message?: string
  // Legacy field the settings panel has always rendered.
  error?: string
}

// "Test connection" costs no tokens: the probe is a model listing, and the
// strategy / dropped-parameter report is computed locally from declarative
// capability data rather than by asking the provider.
export async function testLlmConnectionFor(
  options: LlmCallOptions
): Promise<LlmConnectionTestResult> {
  const settings = options.settings
  const provider = resolveProvider(settings.activeProviderId)
  const capabilities = capabilitiesFor(settings)
  const plan = planRequest({ settings, providerId: provider.id, capabilities, batchSize: 0 })
  const base = {
    providerId: provider.id,
    model: settings.model,
    strategy: plan.strategy,
    droppedOptions: plan.droppedOptions
  }

  try {
    const adapter = apiFor(provider.api, settings.model)
    const credential = options.credential ?? (await resolveAuth(provider.id, { allowLegacy: true }))

    if (!credential?.apiKey && provider.credentialKind !== "api-key-or-none") {
      return { ...base, ok: false, errorKind: "unauthorized", message: MISSING_CREDENTIAL_ERROR }
    }

    const probe = await adapter.probe(buildAdapterContext({ ...options, credential }, capabilities))
    if (!probe.ok) {
      return { ...base, ok: false, errorKind: "unauthorized", message: probe.error, httpStatus: probe.status }
    }

    return { ...base, ok: true }
  } catch (error) {
    if (isLlmError(error)) {
      return { ...base, ok: false, errorKind: error.kind, message: error.message, httpStatus: error.status }
    }

    return {
      ...base,
      ok: false,
      errorKind: "unknown",
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
