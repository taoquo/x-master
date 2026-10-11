import {
  DEADLINE_EXCEEDED_ERROR,
  LlmError,
  deadlineExceededError,
  normalizeHttpError,
  normalizeNetworkError
} from "./errors.ts"
import type { FetchLike } from "./types.ts"

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
export const RATE_LIMIT_BACKOFF_MS = 2_000
export const MAX_RATE_LIMIT_BACKOFF_MS = 30_000
export const RATE_LIMIT_RETRIES = 2
// A provider asking us to wait longer than this gets reported instead of obeyed:
// silently sleeping past a wall-clock budget is how a run looks hung.
export const MAX_RETRY_AFTER_MS = 30_000
const MAX_ATTEMPTS = 5

// Providers say how long to wait; guessing when they already told us is how a
// retry storm starts. Accepts both forms the header allows (delay-seconds and an
// HTTP date) and ignores anything unparsable.
export function parseRetryAfterMs(
  value: string | null | undefined,
  nowMs: number,
  capMs: number = MAX_RATE_LIMIT_BACKOFF_MS
): number | null {
  const raw = (value ?? "").trim()
  if (!raw) {
    return null
  }

  const seconds = Number(raw)
  if (Number.isFinite(seconds)) {
    return seconds <= 0 ? 0 : Math.min(seconds * 1000, capMs)
  }

  const dateMs = Date.parse(raw)
  if (!Number.isFinite(dateMs)) {
    return null
  }

  return Math.min(Math.max(0, dateMs - nowMs), capMs)
}

export function resolveRateLimitBackoffMs(retryAfterMs: number | null, hits: number) {
  if (retryAfterMs !== null) {
    return retryAfterMs
  }

  return Math.min(RATE_LIMIT_BACKOFF_MS * 2 ** hits, MAX_RATE_LIMIT_BACKOFF_MS)
}

export function delay(ms: number, sleep?: (ms: number) => Promise<void>) {
  if (sleep) {
    return sleep(ms)
  }

  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Aborts the request once its own timeout passes and reports the abort as a
// timeout. Environments without AbortController still get the deadline, they just
// cannot release the socket early.
async function fetchWithTimeout(
  fetchImpl: FetchLike,
  endpoint: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ ok: true; response: Response } | { ok: false; timedOut: boolean; error: unknown }> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller?.abort()
  }, Math.max(1, timeoutMs))

  try {
    const response = await fetchImpl(endpoint, {
      ...init,
      ...(controller ? { signal: controller.signal } : {})
    })

    return { ok: true, response }
  } catch (error) {
    return { ok: false, timedOut, error }
  } finally {
    clearTimeout(timer)
  }
}

export interface JsonTransportOptions {
  url: string
  method?: "GET" | "POST"
  headers?: Record<string, string>
  // Called per attempt so an adapter can drop a parameter the provider rejected
  // without re-implementing the retry loop.
  buildBody?: (attempt: number) => unknown
  body?: unknown
  timeoutMs?: number
  // Absolute epoch-ms wall clock. No attempt starts after it.
  deadlineMs: number
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  // Return true to retry after the adapter removed the offending parameter.
  onUnsupportedParam?: (error: LlmError, attempt: number) => boolean
}

export interface JsonTransportResult {
  status: number
  payload: unknown
  bodyText: string
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500
}

// Fake Response objects in tests may carry neither headers nor body helpers, so
// every optional access stays guarded.
async function readBodyText(response: Response): Promise<string> {
  try {
    const text = (response as { text?: () => Promise<string> }).text
    return typeof text === "function" ? await text() : ""
  } catch {
    return ""
  }
}

function readHeader(response: Response, name: string): string | null {
  try {
    const value = response.headers?.get?.(name)
    return typeof value === "string" ? value : null
  } catch {
    return null
  }
}

async function readPayload(response: Response, bodyText: string): Promise<unknown> {
  const parseJson = (response as { json?: () => Promise<unknown> }).json
  if (typeof parseJson === "function") {
    try {
      return await parseJson.call(response)
    } catch {
      // fall through to the text we already read
    }
  }

  try {
    return JSON.parse(bodyText)
  } catch {
    return undefined
  }
}

// The single HTTP exit for every adapter that is not the OpenAI-compatible legacy
// engine: one timeout, one retry policy, one rate-limit handling, one deadline.
export async function requestJson(options: JsonTransportOptions): Promise<JsonTransportResult> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  const now = options.now ?? (() => Date.now())
  const remainingBudgetMs = () => options.deadlineMs - now()

  let rateLimitRetriesLeft = RATE_LIMIT_RETRIES
  let rateLimitHits = 0
  let blindRetriesLeft = 1
  let paramRetriesLeft = 1
  let lastError: LlmError = new LlmError("unknown", DEADLINE_EXCEEDED_ERROR)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remainingMs = remainingBudgetMs()
    if (remainingMs <= 0) {
      throw deadlineExceededError()
    }

    const body = options.buildBody ? options.buildBody(attempt) : options.body
    const init: RequestInit = {
      method: options.method ?? "POST",
      headers: options.headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }

    const sent = await fetchWithTimeout(
      fetchImpl,
      options.url,
      init,
      Math.max(1, Math.min(timeoutMs, remainingMs))
    )

    if (!sent.ok) {
      lastError = normalizeNetworkError(sent.error, sent.timedOut)

      if (blindRetriesLeft <= 0) {
        throw lastError
      }

      blindRetriesLeft -= 1
      continue
    }

    const response = sent.response
    const bodyText = response.ok ? "" : await readBodyText(response)

    if (response.ok) {
      return { status: response.status, payload: await readPayload(response, bodyText), bodyText }
    }

    const headerRetryAfter = parseRetryAfterMs(readHeader(response, "retry-after"), now(), Number.POSITIVE_INFINITY)
    const error = normalizeHttpError({
      status: response.status,
      bodyText,
      retryAfterMs: headerRetryAfter ?? undefined
    })
    lastError = error

    if (headerRetryAfter !== null && headerRetryAfter > MAX_RETRY_AFTER_MS) {
      throw new LlmError("rate-limit", error.message, {
        status: response.status,
        retryAfterMs: headerRetryAfter
      })
    }

    if (error.kind === "rate-limit") {
      if (rateLimitRetriesLeft <= 0) {
        throw error
      }

      rateLimitRetriesLeft -= 1
      const backoffMs = resolveRateLimitBackoffMs(
        parseRetryAfterMs(readHeader(response, "retry-after"), now()),
        rateLimitHits
      )
      const sleepMs = Math.min(backoffMs, Math.max(0, remainingBudgetMs() - 1))
      if (sleepMs <= 0) {
        throw deadlineExceededError()
      }

      await delay(sleepMs, options.sleep)
      rateLimitHits += 1
      continue
    }

    if (error.kind === "unsupported-param" && paramRetriesLeft > 0 && options.onUnsupportedParam?.(error, attempt)) {
      paramRetriesLeft -= 1
      continue
    }

    // The provider's own verdict wins over the status code: some gateways return
    // 500 for a permanently malformed request, and some return 400 for a blip.
    const shouldRetryHeader = readHeader(response, "x-should-retry")
    const retryable =
      shouldRetryHeader === null ? isRetryableStatus(response.status) : shouldRetryHeader.toLowerCase() === "true"

    if (retryable && blindRetriesLeft > 0) {
      blindRetriesLeft -= 1
      continue
    }

    throw error
  }

  throw lastError
}

// The shared probe: one authenticated GET that costs no tokens.
export async function probeJson(options: {
  url: string
  headers?: Record<string, string>
  timeoutMs?: number
  fetchImpl?: FetchLike
}): Promise<{ ok: boolean; error?: string; status?: number }> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const attempt = await fetchWithTimeout(
    fetchImpl,
    options.url,
    { method: "GET", headers: options.headers },
    options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  )

  if (!attempt.ok) {
    const error = normalizeNetworkError(attempt.error, attempt.timedOut)
    return { ok: false, error: error.message }
  }

  const response = attempt.response
  if (!response.ok) {
    const bodyText = await readBodyText(response)
    const error = normalizeHttpError({ status: response.status, bodyText })
    // Legacy wording ("HTTP 401") is what the settings panel has always shown.
    return { ok: false, error: error.message, status: response.status }
  }

  return { ok: true, status: response.status }
}
