// One error shape for every provider, so the UI and the pipeline can branch on a
// verdict instead of pattern-matching vendor prose.

export type LlmErrorKind =
  | "unauthorized"
  | "forbidden"
  | "rate-limit"
  | "quota"
  | "bad-request"
  | "unsupported-param"
  | "context-length"
  | "timeout"
  | "network"
  | "server"
  | "content-filter"
  | "invalid-json"
  | "unknown"

// Reported when the run's wall-clock budget is spent before/while a request could
// be attempted. Distinct from a socket timeout so the run summary can tell "the
// gateway is slow" from "we ran out of run".
export const DEADLINE_EXCEEDED_ERROR = "run-deadline-exceeded"
// Kept distinguishable from gateway errors on purpose: a timeout is a transient
// network verdict worth one retry, a 4xx is a settled verdict about the request.
export const REQUEST_TIMEOUT_ERROR = "request-timeout"

export const MAX_ERROR_DETAIL_LENGTH = 200

export type DroppedOptionLike = "temperature" | "jsonSchema" | "maxOutputTokens"

export class LlmError extends Error {
  readonly kind: LlmErrorKind
  readonly status?: number
  readonly retryAfterMs?: number
  readonly droppedOption?: DroppedOptionLike
  // True when the provider's own body is already folded into `message`, so callers
  // do not print the response body a second time.
  readonly messageCarriesBody: boolean

  constructor(
    kind: LlmErrorKind,
    message: string,
    options: {
      status?: number
      retryAfterMs?: number
      droppedOption?: DroppedOptionLike
      messageCarriesBody?: boolean
    } = {}
  ) {
    super(message)
    this.name = "LlmError"
    this.kind = kind
    this.status = options.status
    this.retryAfterMs = options.retryAfterMs
    this.droppedOption = options.droppedOption
    this.messageCarriesBody = options.messageCarriesBody ?? false
  }
}

export function isLlmError(error: unknown): error is LlmError {
  return error instanceof LlmError
}

// Google puts the API key in the query string, so any URL that may reach a message,
// a log or the UI has to lose its query before it gets there.
export function redactBaseUrl(value: string): string {
  const trimmed = (value ?? "").trim()
  if (!trimmed) {
    return ""
  }

  try {
    const url = new URL(trimmed)
    return `${url.origin}${url.pathname}`
  } catch {
    return trimmed.split("?")[0]
  }
}

const QUOTA_PATTERN = /quota|billing|insufficient|exceeded your current|out of credits|no credits/i
const CONTEXT_PATTERN = /context length|context_length|too long|maximum context|max_tokens.*exceed|token limit/i
const CONTENT_FILTER_PATTERN = /content[_ ]filter|content policy|safety|blocked by/i
const UNSUPPORTED_PATTERN = /unsupported|not supported|unknown (?:parameter|field|argument)|invalid[_ ]?(?:parameter|request).*(?:temperature|response_format|json|max_tokens)/i

function droppedOptionFor(detail: string): DroppedOptionLike | undefined {
  const lower = detail.toLowerCase()
  if (lower.includes("temperature")) {
    return "temperature"
  }
  if (lower.includes("response_format") || lower.includes("json_schema") || lower.includes("json mode")) {
    return "jsonSchema"
  }
  if (lower.includes("max_tokens") || lower.includes("max_output_tokens")) {
    return "maxOutputTokens"
  }
  return undefined
}

// Mirrors the shape of an OpenAI/Anthropic/Gemini error body: all three nest the
// human-readable reason one level down, under different keys.
export function extractErrorDetail(bodyText: string): string {
  const body = (bodyText ?? "").trim()
  if (!body) {
    return ""
  }

  let message = body
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown; type?: unknown } | string
      message?: unknown
    }
    if (typeof parsed.error === "string") {
      message = parsed.error
    } else if (typeof parsed.error?.message === "string") {
      message = parsed.error.message
    } else if (typeof parsed.message === "string") {
      message = parsed.message
    }
  } catch {
    message = body
  }

  return message.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_DETAIL_LENGTH)
}

// Google carries the key in the query string, and fetch failures often quote the
// URL they failed on. Nothing that may reach a user, a log or an error message is
// allowed to contain the key.
export function redactSecret(text: string, secret: string | undefined): string {
  if (!secret || secret.length < 6) {
    return text
  }

  return text.split(secret).join("***")
}

export function sanitizeLlmError(error: unknown, secret: string | undefined): LlmError {
  if (!(error instanceof LlmError)) {
    const message = error instanceof Error ? error.message : String(error)
    return new LlmError("unknown", redactSecret(message, secret))
  }

  const message = redactSecret(error.message, secret)
  if (message === error.message) {
    return error
  }

  return new LlmError(error.kind, message, {
    status: error.status,
    retryAfterMs: error.retryAfterMs,
    droppedOption: error.droppedOption,
    messageCarriesBody: error.messageCarriesBody
  })
}

export function classifyStatus(status: number, detail: string): LlmErrorKind {
  if (status === 401) {
    return "unauthorized"
  }
  if (status === 402) {
    return "quota"
  }
  if (status === 403) {
    return QUOTA_PATTERN.test(detail) ? "quota" : "forbidden"
  }
  if (status === 429) {
    return "rate-limit"
  }
  if (status >= 500) {
    return "server"
  }
  if (status === 400 || status === 404 || status === 422) {
    if (CONTENT_FILTER_PATTERN.test(detail)) {
      return "content-filter"
    }
    if (UNSUPPORTED_PATTERN.test(detail) || droppedOptionFor(detail) !== undefined) {
      return "unsupported-param"
    }
    if (CONTEXT_PATTERN.test(detail)) {
      return "context-length"
    }
    return "bad-request"
  }
  if (status >= 400) {
    return "bad-request"
  }
  return "unknown"
}

export function normalizeHttpError(options: {
  status: number
  bodyText?: string
  retryAfterMs?: number
}): LlmError {
  const detail = extractErrorDetail(options.bodyText ?? "")
  const kind = classifyStatus(options.status, detail)
  // "HTTP 401" with no body was the legacy wording, and callers/tests rely on it.
  const message = detail ? `HTTP ${options.status}: ${detail}` : `HTTP ${options.status}`

  return new LlmError(kind, message, {
    status: options.status,
    retryAfterMs: options.retryAfterMs,
    droppedOption: kind === "unsupported-param" ? droppedOptionFor(detail) : undefined,
    messageCarriesBody: Boolean(detail)
  })
}

export function normalizeNetworkError(error: unknown, timedOut: boolean): LlmError {
  const message = error instanceof Error ? error.message : String(error)
  return new LlmError(timedOut ? "timeout" : "network", timedOut ? REQUEST_TIMEOUT_ERROR : message)
}

export function deadlineExceededError(): LlmError {
  return new LlmError("timeout", DEADLINE_EXCEEDED_ERROR, { messageCarriesBody: true })
}

export function invalidJsonError(detail = "the model did not return JSON"): LlmError {
  return new LlmError("invalid-json", detail, { messageCarriesBody: true })
}
