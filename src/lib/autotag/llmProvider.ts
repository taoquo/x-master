import type { AutoTagLlmSettings } from "../types.ts"

export interface LlmBookmarkInput {
  tweetId: string
  authorHandle: string
  text: string
}

export interface LlmTagSuggestion {
  tweetId: string
  tags: Array<{ name: string; confidence: number }>
}

export interface AutoTagLlmProvider {
  suggestTags(input: {
    bookmarks: LlmBookmarkInput[]
    vocabulary: string[]
    allowNewTags: boolean
  }): Promise<LlmTagSuggestion[]>
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

const MAX_TEXT_LENGTH = 500
const RATE_LIMIT_BACKOFF_MS = 2000
const MAX_ERROR_DETAIL_LENGTH = 200

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

function buildPrompt(input: { bookmarks: LlmBookmarkInput[]; vocabulary: string[]; allowNewTags: boolean }) {
  const bookmarkLines = input.bookmarks.map((bookmark) => ({
    tweetId: bookmark.tweetId,
    author: bookmark.authorHandle,
    text: bookmark.text.slice(0, MAX_TEXT_LENGTH)
  }))

  const vocabularyInstruction = input.allowNewTags
    ? "Prefer tags from the existing vocabulary below, but you may introduce new concise tags when nothing fits."
    : "You must only use tags from the existing vocabulary below. Never invent new tags."

  return [
    "You assign topical tags to bookmarked tweets.",
    vocabularyInstruction,
    `Existing vocabulary: ${JSON.stringify(input.vocabulary)}`,
    "For each bookmark, return up to 3 tags with a confidence between 0 and 1.",
    'Respond with JSON only: {"results":[{"tweetId":"...","tags":[{"name":"...","confidence":0.8}]}]}',
    `Bookmarks: ${JSON.stringify(bookmarkLines)}`
  ].join("\n\n")
}

function parseSuggestions(content: string, validTweetIds: Set<string>): LlmTagSuggestion[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }

  const results = (parsed as { results?: unknown })?.results
  if (!Array.isArray(results)) {
    return []
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

// OpenAI-compatible chat/completions provider. One implementation covers
// OpenAI / DeepSeek / Moonshot / Ollama etc. Batches are requested serially
// by the pipeline; this class handles one batch with a single retry and a
// 429 backoff.
export function createOpenAiCompatibleProvider(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
}): AutoTagLlmProvider {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const endpoint = `${resolveApiBaseUrl(options.settings.baseUrl)}/chat/completions`

  async function requestOnce(prompt: string): Promise<{ ok: boolean; rateLimited: boolean; content: string }> {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.settings.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      })
    })

    if (response.status === 429) {
      return { ok: false, rateLimited: true, content: "" }
    }

    if (!response.ok) {
      return { ok: false, rateLimited: false, content: "" }
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content ?? ""
    return { ok: true, rateLimited: false, content }
  }

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

      for (let attempt = 0; attempt < 2; attempt += 1) {
        let result: { ok: boolean; rateLimited: boolean; content: string }
        try {
          result = await requestOnce(prompt)
        } catch {
          result = { ok: false, rateLimited: false, content: "" }
        }

        if (result.ok) {
          return parseSuggestions(result.content, validTweetIds)
        }

        if (attempt === 0) {
          await delay(result.rateLimited ? RATE_LIMIT_BACKOFF_MS : 0, options.sleep)
        }
      }

      return []
    }
  }
}

// Lightweight connectivity check for the settings panel "test connection"
// button: lists models, which every OpenAI-compatible server supports.
export async function testLlmConnection(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  fetchImpl?: FetchLike
}): Promise<{ ok: boolean; error?: string }> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const endpoint = `${resolveApiBaseUrl(options.settings.baseUrl)}/models`

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${options.apiKey}` }
    })

    if (!response.ok) {
      return { ok: false, error: await readErrorDetail(response) }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
