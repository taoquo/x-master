import test from "node:test"
import assert from "node:assert/strict"
import {
  buildPrompt,
  createOpenAiCompatibleProvider,
  resolveApiBaseUrl,
  testLlmConnection
} from "../../src/lib/autotag/llmProvider.ts"

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

function errorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { message } }),
    json: async () => ({ error: { message } })
  } as unknown as Response
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
    vocabulary: [{ name: "AI", count: 4 }],
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
    vocabulary: [{ name: "AI", count: 4 }],
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

  // The provider now surfaces the failure so the pipeline can count and report it.
  await assert.rejects(
    provider.suggestTags({
      bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
      vocabulary: [{ name: "AI", count: 4 }],
      allowNewTags: false
    }),
    /HTTP 429/
  )

  assert.equal(calls, 2)
  assert.deepEqual(sleeps, [2000])
})

test("provider drops a gateway-rejected temperature and retries", async () => {
  const bodies: Array<Record<string, unknown>> = []
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (bodies.length === 1) {
        return errorResponse(400, "`temperature` is deprecated for this model.")
      }
      return chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.7 }] }])
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  assert.equal(bodies.length, 2)
  assert.equal(bodies[0]?.temperature, 0)
  assert.equal("temperature" in (bodies[1] ?? {}), false)
  assert.deepEqual(bodies[1]?.response_format, { type: "json_object" })
  assert.equal(suggestions.length, 1)
})

test("provider remembers a rejected temperature across batches", async () => {
  const bodies: Array<Record<string, unknown>> = []
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      bodies.push(body)
      if ("temperature" in body) {
        return errorResponse(400, "`temperature` is deprecated for this model.")
      }
      return chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.7 }] }])
    }
  })

  const input = {
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  }

  assert.equal((await provider.suggestTags(input)).length, 1)
  assert.equal(bodies.length, 2)

  // The second batch must not re-probe the parameter the gateway already refused.
  assert.equal((await provider.suggestTags(input)).length, 1)
  assert.equal(bodies.length, 3)
  assert.equal("temperature" in (bodies[2] ?? {}), false)
})

test("provider drops response_format then temperature before giving up", async () => {
  const bodies: Array<Record<string, unknown>> = []
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (bodies.length === 1) {
        return errorResponse(400, "response_format is not supported")
      }
      if (bodies.length === 2) {
        return errorResponse(400, "temperature is not supported")
      }
      return chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.7 }] }])
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  assert.equal(bodies.length, 3)
  assert.equal("response_format" in (bodies[1] ?? {}), false)
  assert.equal("temperature" in (bodies[2] ?? {}), false)
  assert.equal(suggestions.length, 1)
})

test("provider stops after one blind retry on an unexplained 400", async () => {
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1
      return errorResponse(400, "quota exhausted")
    }
  })

  await assert.rejects(
    provider.suggestTags({
      bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
      vocabulary: [{ name: "AI", count: 4 }],
      allowNewTags: false
    }),
    /quota exhausted/
  )

  // The error names no parameter, so both optional parameters are dropped in
  // turn; a 4xx with nothing left to drop ends the attempt.
  assert.equal(calls, 3)
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

test("provider throws when the response carries no results array", async () => {
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async () =>
      jsonResponse(200, { choices: [{ message: { content: "not json" } }] })
  })

  // A prose answer is a provider failure, not an empty verdict: the pipeline
  // must be able to count the batch as failed and show the reason.
  await assert.rejects(
    provider.suggestTags({
      bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
      vocabulary: [{ name: "AI", count: 4 }],
      allowNewTags: false
    }),
    /invalid-response/
  )
})

test("provider accepts a fenced bare array response", async () => {
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async () =>
      jsonResponse(200, {
        choices: [
          {
            message: {
              content: "Sure, here you go:\n```json\n[{\"tweetId\":\"t1\",\"tags\":[{\"name\":\"AI\",\"confidence\":0.8}]}]\n```"
            }
          }
        ]
      })
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  assert.deepEqual(suggestions, [{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.8 }] }])
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

test("resolveApiBaseUrl appends the version segment only for bare hosts", () => {
  assert.equal(resolveApiBaseUrl("https://api.appintheloop.com/"), "https://api.appintheloop.com/v1")
  assert.equal(resolveApiBaseUrl("https://api.appintheloop.com"), "https://api.appintheloop.com/v1")
  assert.equal(resolveApiBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1")
  assert.equal(resolveApiBaseUrl("https://api.example.com/openai/v1"), "https://api.example.com/openai/v1")
  assert.equal(resolveApiBaseUrl("  "), "")
})

test("provider and connection test reach a bare host through the version segment", async () => {
  const urls: string[] = []
  await testLlmConnection({
    settings: { baseUrl: "https://api.appintheloop.com/", model: "claude-sonnet-5" },
    apiKey: "sk-test",
    fetchImpl: async (url) => {
      urls.push(url)
      return jsonResponse(200, {})
    }
  })

  const provider = createOpenAiCompatibleProvider({
    settings: { baseUrl: "https://api.appintheloop.com/", model: "claude-sonnet-5" },
    apiKey: "sk-test",
    fetchImpl: async (url) => {
      urls.push(url)
      return chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.6 }] }])
    }
  })
  await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  assert.deepEqual(urls, [
    "https://api.appintheloop.com/v1/models",
    "https://api.appintheloop.com/v1/chat/completions"
  ])
})

test("testLlmConnection surfaces the provider error message on failure", async () => {
  const failed = await testLlmConnection({
    settings: SETTINGS,
    apiKey: "sk-test",
    fetchImpl: async () =>
      ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: "Invalid API key provided" } })
      }) as unknown as Response
  })

  assert.deepEqual(failed, { ok: false, error: "HTTP 401: Invalid API key provided" })
})

test("buildPrompt states the abstraction and naming rules", () => {
  const prompt = buildPrompt({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  assert.match(prompt, /durable subject area/)
  assert.match(prompt, /applies to dozens of bookmarks/)
  assert.match(prompt, /Assign 1-2 tags per bookmark/)
  assert.match(prompt, /English only, lowercase, singular/)
  assert.match(prompt, /must only use tags from the vocabulary/)
  assert.match(prompt, /AI \(4\)/)
})

test("buildPrompt sorts the vocabulary by usage, caps it and states the new tag budget", () => {
  const vocabulary = Array.from({ length: 250 }, (_, index) => ({
    name: `tag${String(index).padStart(3, "0")}`,
    count: index
  }))

  const prompt = buildPrompt({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary,
    allowNewTags: true,
    newTagBudget: 3
  })

  const listed = prompt.match(/Existing vocabulary[^\n]*/)?.[0] ?? ""
  const names = listed.match(/tag\d{3}/g) ?? []

  assert.equal(names.length, 200)
  assert.equal(names[0], "tag249")
  assert.equal(names.at(-1), "tag050")
  assert.match(prompt, /at most 3 new tag\(s\)/)

  const unlimited = buildPrompt({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [],
    allowNewTags: true
  })
  assert.match(unlimited, /Introduce a new tag only when nothing in the vocabulary comes close/)
  assert.match(unlimited, /\(empty\)/)
})

test("provider keeps at most two tags per bookmark, highest confidence first", async () => {
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    fetchImpl: async () =>
      chatResponse([
        {
          tweetId: "t1",
          tags: [
            { name: "low", confidence: 0.2 },
            { name: "high", confidence: 0.95 },
            { name: "mid", confidence: 0.6 },
            { name: "  ", confidence: 1 }
          ]
        }
      ])
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: true,
    newTagBudget: 2
  })

  assert.deepEqual(suggestions, [
    {
      tweetId: "t1",
      tags: [
        { name: "high", confidence: 0.95 },
        { name: "mid", confidence: 0.6 }
      ]
    }
  ])
})
