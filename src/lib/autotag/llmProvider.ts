import { HEALTHY_TAG_COUNT_MAX, HEALTHY_TAG_COUNT_MIN } from "../tags/health.ts"
import type { AutoTagLlmSettings } from "../types.ts"

export interface LlmBookmarkInput {
  tweetId: string
  authorHandle: string
  text: string
}

// Vocabulary entries carry a usage count so the model can prefer established
// tags over one-off ones.
export interface LlmVocabularyEntry {
  name: string
  count: number
}

export interface LlmTagSuggestion {
  tweetId: string
  tags: Array<{ name: string; confidence: number }>
}

export interface AutoTagLlmProvider {
  suggestTags(input: {
    bookmarks: LlmBookmarkInput[]
    vocabulary: LlmVocabularyEntry[]
    allowNewTags: boolean
    // Max number of brand new tags the model may introduce for this batch.
    // Ignored when allowNewTags is false.
    newTagBudget?: number
  }): Promise<LlmTagSuggestion[]>
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

// Aborts the request once the deadline passes and reports the abort as a
// timeout. Environments without AbortController still get the deadline, they
// just cannot release the socket early.
async function fetchWithTimeout(
  fetchImpl: FetchLike,
  endpoint: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ ok: true; response: Response } | { ok: false; timedOut: boolean; error: string }> {
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
    return {
      ok: false,
      timedOut,
      error: timedOut ? REQUEST_TIMEOUT_ERROR : error instanceof Error ? error.message : String(error)
    }
  } finally {
    clearTimeout(timer)
  }
}

const MAX_TEXT_LENGTH = 500
const RATE_LIMIT_BACKOFF_MS = 2000
const MAX_ERROR_DETAIL_LENGTH = 200
// A gateway that accepts the connection and never answers used to hang the
// whole run: the await never settles, the pipeline never reaches finishRun, and
// the background lock stays held forever. Every request now carries its own
// deadline so a dead socket costs one batch instead of the entire feature.
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
// Kept distinguishable from gateway errors on purpose: a timeout is a transient
// network verdict worth one retry, a 4xx is a settled verdict about the request.
export const REQUEST_TIMEOUT_ERROR = "request-timeout"
// Hard cap enforced on the response: a model that ignores the prompt cannot
// flood a bookmark with five near-synonyms.
const MAX_TAGS_PER_BOOKMARK = 2

// Users routinely paste a bare host ("https://api.example.com/") into the
// settings panel. OpenAI-compatible servers expose the API under a version
// segment, so add the conventional "/v1" when the URL carries no path.
export function resolveApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  if (!trimmed) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    if (url.pathname === "/" || url.pathname === "") {
      return `${url.origin}/v1`
    }
  } catch {
    return trimmed
  }

  return trimmed
}

async function readErrorDetail(response: Response): Promise<string> {
  let body = ""
  try {
    body = await response.text()
  } catch {
    body = ""
  }

  if (!body) {
    return `HTTP ${response.status}`
  }

  let message = body
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string }
    const fromError = typeof parsed.error === "string" ? parsed.error : parsed.error?.message
    message = fromError ?? parsed.message ?? body
  } catch {
    message = body
  }

  const compact = message.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_DETAIL_LENGTH)
  return compact ? `HTTP ${response.status}: ${compact}` : `HTTP ${response.status}`
}

const MAX_VOCABULARY_ENTRIES = 200

// Mirrors the healthy taxonomy size used by the vocabulary review, so both
// prompts push the library towards the same target instead of fighting.

export function buildPrompt(input: {
  bookmarks: LlmBookmarkInput[]
  vocabulary: LlmVocabularyEntry[]
  allowNewTags: boolean
  newTagBudget?: number
}) {
  const bookmarkLines = input.bookmarks.map((bookmark) => ({
    tweetId: bookmark.tweetId,
    author: bookmark.authorHandle,
    text: bookmark.text.slice(0, MAX_TEXT_LENGTH)
  }))

  // Most used tags first, capped so a large library cannot blow up the prompt.
  const vocabulary = [...input.vocabulary]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, MAX_VOCABULARY_ENTRIES)
    .map((entry) => `${entry.name} (${entry.count})`)

  const budget = Math.max(0, Math.trunc(input.newTagBudget ?? 0))
  const vocabularyInstruction = input.allowNewTags
    ? budget > 0
      ? `Reuse a tag from the vocabulary whenever it is a reasonable fit. Across this whole batch you may introduce at most ${budget} new tag(s), and only when no existing tag covers the topic.`
      : "Reuse tags from the vocabulary whenever they are a reasonable fit. Introduce a new tag only when nothing in the vocabulary comes close."
    : "You must only use tags from the vocabulary below. Never invent new tags. If nothing fits, return no tags for that bookmark."

  return [
    "You are a librarian assigning topical tags to bookmarked tweets. The tag set is a small, stable taxonomy shared by thousands of bookmarks.",
    `The whole library should settle at ${HEALTHY_TAG_COUNT_MIN}-${HEALTHY_TAG_COUNT_MAX} tags in total, so treat every new tag as expensive.`,
    [
      "Rules for choosing tags:",
      "- Tag the durable subject area, not the specific event, product launch, person, or company mentioned once.",
      "- A good tag applies to dozens of bookmarks. If a tag would only ever fit this one bookmark, it is too specific.",
      "- Prefer the broader concept over a narrow instance (use \"llm\" over \"gpt-4o-mini-benchmark\", \"startup-funding\" over \"seriesb-of-companyx\").",
      "- An imperfect existing tag beats a precise new one. Only reach for a new tag when the subject area is missing from the vocabulary entirely.",
      "- Never introduce a near-synonym, translation, abbreviation, plural or hyphenated variant of a tag that already exists.",
      "- Assign 1-2 tags per bookmark. Never pad the list to reach a limit.",
      "- Skip a bookmark entirely if it has no clear topic."
    ].join("\n"),
    [
      "Naming rules for tags:",
      "- English only, lowercase, singular.",
      "- One or two words, words separated by a single space.",
      "- No leading '#', no emoji, no punctuation, no author handles."
    ].join("\n"),
    vocabularyInstruction,
    `Existing vocabulary, most used first (name and usage count): ${
      vocabulary.length ? vocabulary.join(", ") : "(empty)"
    }`,
    "Return a confidence between 0 and 1 for each tag.",
    'Respond with JSON only: {"results":[{"tweetId":"...","tags":[{"name":"...","confidence":0.8}]}]}',
    `Bookmarks: ${JSON.stringify(bookmarkLines)}`
  ].join("\n\n")
}

// Providers behind OpenAI-compatible gateways do not all honour
// response_format, so a valid answer can arrive fenced in markdown, prefixed
// with prose, or as a bare array. Recover the JSON payload instead of
// returning nothing.
function extractJsonCandidates(content: string): string[] {
  const trimmed = content.trim()
  if (!trimmed) {
    return []
  }

  const candidates = [trimmed]
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim())
  }

  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"]
  ] as const) {
    const start = trimmed.indexOf(open)
    const end = trimmed.lastIndexOf(close)
    if (start >= 0 && end > start) {
      candidates.push(trimmed.slice(start, end + 1))
    }
  }

  return candidates
}

// Returns null when the response carries no parsable results array. That is a
// real provider failure (wrong model, prose answer, truncated output) and must
// stay distinguishable from a valid "no tags for this batch" answer.
function parseSuggestions(content: string, validTweetIds: Set<string>): LlmTagSuggestion[] | null {
  let results: unknown

  for (const candidate of extractJsonCandidates(content)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(candidate)
    } catch {
      continue
    }

    const wrapped = (parsed as { results?: unknown })?.results
    if (Array.isArray(wrapped)) {
      results = wrapped
      break
    }

    if (Array.isArray(parsed)) {
      results = parsed
      break
    }
  }

  if (!Array.isArray(results)) {
    return null
  }

  const suggestions: LlmTagSuggestion[] = []
  for (const entry of results) {
    const tweetId = String((entry as { tweetId?: unknown })?.tweetId ?? "")
    const rawTags = (entry as { tags?: unknown })?.tags
    if (!validTweetIds.has(tweetId) || !Array.isArray(rawTags)) {
      continue
    }

    const tags = rawTags
      .map((tag) => ({
        name: String((tag as { name?: unknown })?.name ?? "").trim(),
        confidence: Number((tag as { confidence?: unknown })?.confidence)
      }))
      .filter((tag) => tag.name.length > 0)
      .map((tag) => ({
        name: tag.name,
        confidence: Number.isFinite(tag.confidence) ? Math.min(1, Math.max(0, tag.confidence)) : 0.5
      }))
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, MAX_TAGS_PER_BOOKMARK)

    if (tags.length) {
      suggestions.push({ tweetId, tags })
    }
  }

  return suggestions
}

function delay(ms: number, sleep?: (ms: number) => Promise<void>) {
  if (sleep) {
    return sleep(ms)
  }

  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Shared chat/completions call used by tag suggestion batches and by the
// vocabulary review. Optional parameters are dropped one by one when the
// gateway rejects them, with a backoff on 429.
//
// Returns true when an optional parameter named by the error was dropped, so
// the caller knows the next request differs from the one that just failed.
export type ChatCapabilities = { jsonMode: boolean; temperature: boolean }

export function createChatCapabilities(): ChatCapabilities {
  return { jsonMode: true, temperature: true }
}

function dropRejectedOption(sendOptions: ChatCapabilities, error: string) {
  const detail = error.toLowerCase()

  if (sendOptions.temperature && detail.includes("temperature")) {
    sendOptions.temperature = false
    return true
  }

  if (sendOptions.jsonMode && (detail.includes("response_format") || !detail.includes("temperature"))) {
    sendOptions.jsonMode = false
    return true
  }

  if (sendOptions.temperature) {
    sendOptions.temperature = false
    return true
  }

  return false
}

export async function requestChatJson(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  prompt: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  capabilities?: ChatCapabilities
  timeoutMs?: number
}): Promise<{ ok: boolean; content: string; error?: string; timedOut?: boolean }> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const endpoint = `${resolveApiBaseUrl(options.settings.baseUrl)}/chat/completions`
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  async function requestOnce(sendOptions: {
    jsonMode: boolean
    temperature: boolean
  }): Promise<{
    ok: boolean
    rateLimited: boolean
    badRequest: boolean
    timedOut: boolean
    content: string
    error?: string
  }> {
    const attempt = await fetchWithTimeout(
      fetchImpl,
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`
        },
        body: JSON.stringify({
          model: options.settings.model,
          messages: [{ role: "user", content: options.prompt }],
          ...(sendOptions.jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(sendOptions.temperature ? { temperature: 0 } : {})
        })
      },
      timeoutMs
    )

    if (!attempt.ok) {
      return {
        ok: false,
        rateLimited: false,
        badRequest: false,
        timedOut: attempt.timedOut,
        content: "",
        error: attempt.error
      }
    }

    const response = attempt.response

    if (response.status === 429) {
      return {
        ok: false,
        rateLimited: true,
        badRequest: false,
        timedOut: false,
        content: "",
        error: `HTTP ${response.status}`
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        rateLimited: false,
        badRequest: response.status >= 400 && response.status < 500,
        timedOut: false,
        content: "",
        error: await readErrorDetail(response)
      }
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    return {
      ok: true,
      rateLimited: false,
      badRequest: false,
      timedOut: false,
      content: payload.choices?.[0]?.message?.content ?? ""
    }
  }

  let lastError = "request-failed"
  let lastTimedOut = false

  // Gateways that proxy non-OpenAI models reject optional parameters with a 4xx:
  // some refuse response_format, newer reasoning models refuse temperature. Each
  // retry drops exactly the parameter the error names instead of repeating a
  // doomed request, and a request that carries no optional parameter left is the
  // last one worth sending.
  // Shared across batches when the caller passes it in: a gateway that rejects
  // temperature rejects it for every batch, and re-probing per batch wasted one
  // failing request each time and could exhaust the retry budget on its own.
  const sendOptions = options.capabilities ?? createChatCapabilities()

  // Transient failures (5xx, network, rate limiting) get exactly one blind
  // retry; dropping a rejected parameter buys an extra attempt on top of that
  // budget because the next request is genuinely different.
  let blindRetriesLeft = 1

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let result: {
      ok: boolean
      rateLimited: boolean
      badRequest: boolean
      timedOut: boolean
      content: string
      error?: string
    }
    try {
      result = await requestOnce(sendOptions)
    } catch (error) {
      result = {
        ok: false,
        rateLimited: false,
        badRequest: false,
        timedOut: false,
        content: "",
        error: error instanceof Error ? error.message : String(error)
      }
    }

    if (result.ok) {
      return { ok: true, content: result.content }
    }

    lastError = result.error ?? lastError
    lastTimedOut = result.timedOut

    const dropped = result.badRequest ? dropRejectedOption(sendOptions, lastError) : false

    if (!dropped) {
      // A 4xx with nothing left to drop is a settled verdict (bad key, quota,
      // unknown model); only transient failures deserve the blind retry.
      if (result.badRequest || blindRetriesLeft <= 0) {
        return { ok: false, content: "", error: lastError, ...(lastTimedOut ? { timedOut: true } : {}) }
      }

      blindRetriesLeft -= 1
    }

    await delay(result.rateLimited ? RATE_LIMIT_BACKOFF_MS : 0, options.sleep)
  }

  return { ok: false, content: "", error: lastError, ...(lastTimedOut ? { timedOut: true } : {}) }
}

// OpenAI-compatible chat/completions provider. One implementation covers
// OpenAI / DeepSeek / Moonshot / Ollama etc. Batches are requested serially
// by the pipeline; this class handles one batch with a single retry and a
// 429 backoff.
export function createOpenAiCompatibleProvider(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  timeoutMs?: number
}): AutoTagLlmProvider {
  // One capability probe per provider instance, reused by every batch.
  const capabilities = createChatCapabilities()

  return {
    async suggestTags(input) {
      if (!input.bookmarks.length) {
        return []
      }

      if (!input.allowNewTags && !input.vocabulary.length) {
        return []
      }

      const prompt = buildPrompt(input)
      const validTweetIds = new Set(input.bookmarks.map((bookmark) => bookmark.tweetId))
      const result = await requestChatJson({
        settings: options.settings,
        apiKey: options.apiKey,
        prompt,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        timeoutMs: options.timeoutMs,
        capabilities
      })

      if (!result.ok) {
        // Surface the failure so the pipeline can count the batch and report a
        // reason, instead of looking like the model returned nothing.
        throw new Error(result.error ?? "request-failed")
      }

      const suggestions = parseSuggestions(result.content, validTweetIds)

      if (!suggestions) {
        throw new Error("invalid-response")
      }

      return suggestions
    }
  }
}

// Lightweight connectivity check for the settings panel "test connection"
// button: lists models, which every OpenAI-compatible server supports.
export async function testLlmConnection(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<{ ok: boolean; error?: string }> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const endpoint = `${resolveApiBaseUrl(options.settings.baseUrl)}/models`

  // The settings panel awaits this button, so a hung gateway must not leave the
  // spinner running forever either.
  const attempt = await fetchWithTimeout(
    fetchImpl,
    endpoint,
    { method: "GET", headers: { Authorization: `Bearer ${options.apiKey}` } },
    options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  )

  if (!attempt.ok) {
    return { ok: false, error: attempt.error }
  }

  if (!attempt.response.ok) {
    return { ok: false, error: await readErrorDetail(attempt.response) }
  }

  return { ok: true }
}
