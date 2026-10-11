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
}

// Capability resolution and request assembly happen once, in one place, because
// the answers interact: whether a schema can be enforced decides whether it has to
// travel in the prompt instead.
function planRequest(input: {
  settings: AutoTagLlmSettings
  providerId: string
  capabilities: ModelCapabilities
}): {
  strategy: JsonStrategy
  jsonSchema?: Record<string, unknown>
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
    jsonSchema: schema,
    requireSchema: false
  })

  return {
    strategy: assembled.strategy,
    jsonSchema: assembled.jsonSchema,
    droppedOptions: assembled.droppedOptions,
    promptIncludesSchema: assembled.promptIncludesSchema
  }
}

function buildAdapterContext(options: LlmCallOptions, capabilities: ModelCapabilities): AdapterContext {
  const provider = resolveProvider(options.settings.activeProviderId)
  const now = options.now ?? (() => Date.now())

  return {
    apiKey: options.credential?.apiKey,
    baseUrl: resolveBaseUrl(provider, options.settings.baseUrl),
    deploymentName: options.settings.deploymentName,
    apiVersion: options.settings.apiVersion ?? provider.defaultApiVersion,
    extraHeaders: provider.extraHeaders,
    fetchImpl: options.fetchImpl,
    sleep: options.sleep,
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
      const plan = planRequest({ settings, providerId: provider.id, capabilities })
      const context = buildAdapterContext(options, capabilities)
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
  const plan = planRequest({ settings, providerId: provider.id, capabilities })
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
