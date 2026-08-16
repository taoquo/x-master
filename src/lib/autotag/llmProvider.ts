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

const MAX_TEXT_LENGTH = 500
const RATE_LIMIT_BACKOFF_MS = 2000
const MAX_ERROR_DETAIL_LENGTH = 200
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
// vocabulary review. One attempt plus one retry, with a backoff on 429.
export async function requestChatJson(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  prompt: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
}): Promise<{ ok: boolean; content: string; error?: string }> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const endpoint = `${resolveApiBaseUrl(options.settings.baseUrl)}/chat/completions`

  async function requestOnce(): Promise<{ ok: boolean; rateLimited: boolean; content: string; error?: string }> {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.settings.model,
        messages: [{ role: "user", content: options.prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      })
    })

    if (response.status === 429) {
      return { ok: false, rateLimited: true, content: "", error: `HTTP ${response.status}` }
    }

    if (!response.ok) {
      return { ok: false, rateLimited: false, content: "", error: await readErrorDetail(response) }
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    return { ok: true, rateLimited: false, content: payload.choices?.[0]?.message?.content ?? "" }
  }

  let lastError = "request-failed"

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result: { ok: boolean; rateLimited: boolean; content: string; error?: string }
    try {
      result = await requestOnce()
    } catch (error) {
      result = {
        ok: false,
        rateLimited: false,
        content: "",
        error: error instanceof Error ? error.message : String(error)
      }
    }

    if (result.ok) {
      return { ok: true, content: result.content }
    }

    lastError = result.error ?? lastError

    if (attempt === 0) {
      await delay(result.rateLimited ? RATE_LIMIT_BACKOFF_MS : 0, options.sleep)
    }
  }

  return { ok: false, content: "", error: lastError }
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
        sleep: options.sleep
      })

      return result.ok ? parseSuggestions(result.content, validTweetIds) : []
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
