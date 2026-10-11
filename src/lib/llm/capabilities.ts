import { DEFAULT_PROVIDER_ID, resolveProvider } from "./providers.ts"
import type { JsonStrategy, ModelCapabilities } from "./types.ts"

// Capabilities are data on the provider (and, when known, on the model), not a
// subclass and not a switch. A new provider is a data edit.

const PROVIDER_DEFAULTS: Record<string, ModelCapabilities> = {
  openai: { jsonStrategy: "json-schema-strict", temperature: true },
  anthropic: { jsonStrategy: "tool", temperature: true },
  google: { jsonStrategy: "json-object", temperature: true },
  "azure-openai": { jsonStrategy: "json-schema-strict", temperature: true },
  custom: { jsonStrategy: "json-object", temperature: true }
}

// Only prefixes whose behaviour is documented, and only where sending the
// parameter is an error rather than a no-op.
const PREFIX_RULES: Array<{ providerId: string; pattern: RegExp; capabilities: Partial<ModelCapabilities> }> = [
  // OpenAI's reasoning models reject `temperature`.
  { providerId: "openai", pattern: /^o[1-9]/, capabilities: { temperature: false } },
  { providerId: "openai", pattern: /^gpt-5/, capabilities: { temperature: false } },
  { providerId: "azure-openai", pattern: /^o[1-9]/, capabilities: { temperature: false } },
  { providerId: "azure-openai", pattern: /^gpt-5/, capabilities: { temperature: false } },
  // Anthropic's tool-choice JSON path is always available.
  { providerId: "anthropic", pattern: /^claude-/, capabilities: { jsonStrategy: "tool" } }
]

export function learnedCapabilityKey(providerId: string, model: string) {
  return `${providerId}::${model}`
}

export function providerDefaultCapabilities(providerId: string): ModelCapabilities {
  return { ...(PROVIDER_DEFAULTS[providerId] ?? PROVIDER_DEFAULTS[DEFAULT_PROVIDER_ID]) }
}

// Highest priority first:
//   1. the user's explicit override (the escape hatch when the table is stale)
//   2. what a previous run learned the hard way
//   3. a documented model-name prefix rule
//   4. the provider default
export function resolveCapabilities(input: {
  providerId: string | undefined
  model: string
  overrides?: Partial<ModelCapabilities>
  learned?: Partial<ModelCapabilities>
}): ModelCapabilities {
  const providerId = resolveProvider(input.providerId).id
  const base = providerDefaultCapabilities(providerId)

  let resolved = base
  for (const rule of PREFIX_RULES) {
    if (rule.providerId === providerId && rule.pattern.test(input.model.trim())) {
      resolved = { ...resolved, ...rule.capabilities }
      break
    }
  }

  if (input.learned) {
    resolved = { ...resolved, ...input.learned }
  }

  if (input.overrides) {
    resolved = { ...resolved, ...input.overrides }
  }

  return resolved
}

// "Which parameters will this request not carry?" is decided here, at assembly
// time, because the answers interact: a schema-less request degrades the strategy,
// and maxOutputTokens only makes sense next to a context window.
export interface AssembledRequest {
  strategy: JsonStrategy
  temperature?: number
  maxOutputTokens?: number
  jsonSchema?: Record<string, unknown>
  droppedOptions: Array<"temperature" | "jsonSchema" | "maxOutputTokens">
  promptIncludesSchema: boolean
}

export function assembleRequest(input: {
  capabilities: ModelCapabilities
  temperature?: number
  maxOutputTokens?: number
  jsonSchema?: Record<string, unknown>
  // Set when the caller needs a schema but the provider can only be prompted.
  requireSchema: boolean
}): AssembledRequest {
  const dropped: AssembledRequest["droppedOptions"] = []
  const hasSchema = Boolean(input.jsonSchema && Object.keys(input.jsonSchema).length)

  const strategy: JsonStrategy = hasSchema ? input.capabilities.jsonStrategy : "prompt-only"
  if (hasSchema && strategy === "prompt-only") {
    dropped.push("jsonSchema")
  }

  const temperature = input.capabilities.temperature ? input.temperature : undefined
  if (input.temperature !== undefined && temperature === undefined) {
    dropped.push("temperature")
  }

  const contextWindow = input.capabilities.contextWindow
  let maxOutputTokens = input.maxOutputTokens
  if (maxOutputTokens !== undefined && contextWindow !== undefined && maxOutputTokens > contextWindow) {
    maxOutputTokens = contextWindow
    dropped.push("maxOutputTokens")
  }

  return {
    strategy,
    temperature,
    maxOutputTokens,
    jsonSchema: hasSchema && strategy !== "prompt-only" ? input.jsonSchema : undefined,
    droppedOptions: dropped,
    // prompt-only means the schema has to travel inside the prompt instead.
    promptIncludesSchema: hasSchema && strategy === "prompt-only"
  }
}
