// Neutral types shared by every provider adapter. Nothing in this file knows
// about a specific vendor: adapters map these onto their own wire format, and the
// orchestrator is the only place that knows about our task (tag suggestions).

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

// "require" refuses to silently weaken the JSON guarantee; "prefer" degrades.
export type JsonMode = "require" | "prefer"

// How a provider can be made to answer with JSON, best first. See json.ts.
export type JsonStrategy =
  | "json-schema-strict"
  | "json-schema"
  | "json-object"
  | "tool"
  | "prompt-only"

export interface ModelCapabilities {
  jsonStrategy: JsonStrategy
  temperature: boolean
  maxOutputTokens?: number
  contextWindow?: number
}

export type DroppedOption = "temperature" | "jsonSchema" | "maxOutputTokens"

export interface ChatJsonRequest {
  model: string
  system: string
  user: string
  schemaName?: string
  jsonSchema?: Record<string, unknown>
  jsonMode: JsonMode
  temperature?: number
  maxOutputTokens?: number
  // Absolute epoch-ms wall clock for the whole call. Required, not optional: a
  // batch that can outlive the run budget is what got the worker killed.
  deadlineMs: number
}

export interface ChatJsonResult {
  text: string
  parsed?: unknown
  usage?: { inputTokens?: number; outputTokens?: number }
  finishReason?: string
  // Parameters this request chose not to send, because the model or the provider
  // does not support them. Reported so the UI can say what it ignored.
  droppedOptions: DroppedOption[]
}

export interface AdapterContext {
  apiKey?: string
  baseUrl: string
  // Provider-level headers that are part of the protocol rather than the user's
  // credential (e.g. anthropic-version).
  extraHeaders?: Record<string, string>
  deploymentName?: string
  apiVersion?: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  timeoutMs: number
  now: () => number
  signal?: AbortSignal
  capabilities: ModelCapabilities
}

export interface ChatProbeResult {
  ok: boolean
  error?: string
  status?: number
}

export interface ChatApiAdapter {
  readonly id: string
  readonly needsApiKey: boolean
  chatJson(request: ChatJsonRequest, context: AdapterContext): Promise<ChatJsonResult>
  // Cheap connectivity/credential check: lists models, never generates, so the
  // "test connection" button costs no tokens.
  probe(context: AdapterContext): Promise<ChatProbeResult>
}
