import test from "node:test"
import assert from "node:assert/strict"
import { createOpenAiCompatibleProvider, testLlmConnection } from "../../src/lib/autotag/llmProvider.ts"

const SETTINGS = { baseUrl: "https://api.example.com/v1/", model: "test-model" }

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response
}

function chatResponse(results: unknown): Response {
  return jsonResponse(200, {
    choices: [{ message: { content: JSON.stringify({ results }) } }]
  })
}

test("provider posts batches to chat/completions and parses suggestions", async () => {
  const requests: Array<{ url: string; body: any }> = []
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(String(init.body)) })
      return chatResponse([
        { tweetId: "t1", tags: [{ name: "AI", confidence: 0.9 }] },
        { tweetId: "unknown", tags: [{ name: "spam", confidence: 1 }] }
      ])
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: ["AI"],
    allowNewTags: false
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.url, "https://api.example.com/v1/chat/completions")
  assert.equal(requests[0]?.body.model, "test-model")
  assert.deepEqual(suggestions, [{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.9 }] }])
})

test("provider retries once after a failed request", async () => {
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse(500, {})
      }
      return chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.5 }] }])
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: ["AI"],
    allowNewTags: false
  })

  assert.equal(calls, 2)
  assert.equal(suggestions.length, 1)
})

test("provider backs off on 429 and gives up after the retry", async () => {
  let calls = 0
  const sleeps: number[] = []
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    fetchImpl: async () => {
      calls += 1
      return jsonResponse(429, {})
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: ["AI"],
    allowNewTags: false
  })

  assert.equal(calls, 2)
  assert.deepEqual(sleeps, [2000])
  assert.deepEqual(suggestions, [])
})

test("provider skips the request in closed mode with an empty vocabulary", async () => {
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    fetchImpl: async () => {
      calls += 1
      return chatResponse([])
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [],
    allowNewTags: false
  })

  assert.equal(calls, 0)
  assert.deepEqual(suggestions, [])
})

test("provider returns no suggestions when the response is not valid JSON", async () => {
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async () =>
      jsonResponse(200, { choices: [{ message: { content: "not json" } }] })
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: ["AI"],
    allowNewTags: false
  })

  assert.deepEqual(suggestions, [])
})

test("testLlmConnection reports ok and error states", async () => {
  const ok = await testLlmConnection({
    settings: SETTINGS,
    apiKey: "sk-test",
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.example.com/v1/models")
      return jsonResponse(200, {})
    }
  })
  assert.deepEqual(ok, { ok: true })

  const failed = await testLlmConnection({
    settings: SETTINGS,
    apiKey: "sk-test",
    fetchImpl: async () => jsonResponse(401, {})
  })
  assert.deepEqual(failed, { ok: false, error: "HTTP 401" })
})
