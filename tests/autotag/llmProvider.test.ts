import test from "node:test"
import assert from "node:assert/strict"
import {
  buildPrompt,
  createOpenAiCompatibleProvider,
  DEADLINE_EXCEEDED_ERROR,
  parseRetryAfterMs,
  requestChatJson,
  REQUEST_TIMEOUT_ERROR,
  resolveApiBaseUrl,
  testLlmConnection
} from "../../src/lib/autotag/llmProvider.ts"
import { DEFAULT_LLM_BATCH_BUDGET_MS, DEFAULT_LLM_RUN_BUDGET_MS } from "../../src/lib/autotag/pipeline.ts"
import { AUTO_TAG_RUN_LIVENESS_MS, AUTO_TAG_RUN_STALE_MS } from "../../src/lib/storage/settings.ts"

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

// A gateway that accepts the connection and never answers. Only the abort
// signal ends this request, which is exactly the case that used to hang a run
// forever.
function hangingFetch(onCall?: () => void) {
  return (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      onCall?.()
      init.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted")))
    })
}

test("the run budget stays below Chrome's per-invocation service worker limit", () => {
  // An MV3 worker is force-terminated at roughly five minutes and no keepalive
  // resets that, so a budget at or above it lets the worker die before finishRun
  // and leaves the run state stuck on "running". This used to be 8 minutes.
  const chromePerInvocationLimitMs = 5 * 60 * 1000
  assert.ok(
    DEFAULT_LLM_RUN_BUDGET_MS < chromePerInvocationLimitMs,
    `run budget ${DEFAULT_LLM_RUN_BUDGET_MS}ms must stay under ${chromePerInvocationLimitMs}ms`
  )
  // The heartbeat is refreshed once per batch, so a batch must stay shorter than
  // the window that decides whether a run is alive, and that window must in turn
  // be shorter than the UI-facing stale window (otherwise a dead run could refuse
  // new runs for five minutes).
  assert.ok(DEFAULT_LLM_BATCH_BUDGET_MS < AUTO_TAG_RUN_LIVENESS_MS)
  assert.ok(AUTO_TAG_RUN_LIVENESS_MS < AUTO_TAG_RUN_STALE_MS)
})

test("requestChatJson refuses to start an attempt once the deadline has passed", async () => {
  let calls = 0

  const result = await requestChatJson({
    settings: SETTINGS,
    apiKey: "sk-test",
    prompt: "hello",
    fetchImpl: async () => {
      calls += 1
      return chatResponse([])
    },
    now: () => 1_000,
    deadlineMs: 999
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, DEADLINE_EXCEEDED_ERROR)
  // The point of the check: no request is issued at all.
  assert.equal(calls, 0)
})

test("a deadline stops rate-limit retries from running past the budget", async () => {
  let calls = 0
  const sleeps: number[] = []
  let clock = 0

  const result = await requestChatJson({
    settings: SETTINGS,
    apiKey: "sk-test",
    prompt: "hello",
    fetchImpl: async () => {
      calls += 1
      return jsonResponse(429, {})
    },
    sleep: async (ms) => {
      sleeps.push(ms)
      clock += ms
    },
    now: () => clock,
    deadlineMs: 1_000
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, DEADLINE_EXCEEDED_ERROR)
  // Without the deadline the 429 budget alone allows three attempts. The first
  // backoff (2s) is clamped to the 1s that is left, and the next check stops the
  // loop instead of starting attempt two.
  assert.equal(calls, 1)
  assert.deepEqual(sleeps, [1_000])
})

test("a deadline shortens an attempt's timeout instead of running to the request timeout", async () => {
  let calls = 0
  const startedAt = Date.now()

  const result = await requestChatJson({
    settings: SETTINGS,
    apiKey: "sk-test",
    prompt: "hello",
    fetchImpl: hangingFetch(() => {
      calls += 1
    }),
    // The request timeout alone would hold the worker for a full minute.
    timeoutMs: 60_000,
    deadlineMs: Date.now() + 20
  })

  assert.equal(result.ok, false)
  assert.equal(result.timedOut, true)
  assert.equal(calls, 1)
  // Clamped to the ~20ms budget rather than the 60s request timeout.
  assert.ok(Date.now() - startedAt < 5_000, "the attempt must not run to the full request timeout")
})

test("the provider passes the batch deadline through to the request", async () => {
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1
      return chatResponse([])
    }
  })

  await assert.rejects(
    provider.suggestTags({
      bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
      vocabulary: [{ name: "AI", count: 1 }],
      allowNewTags: false,
      deadlineMs: Date.now() - 1
    }),
    new RegExp(DEADLINE_EXCEEDED_ERROR)
  )

  // An expired batch deadline must not spend a request.
  assert.equal(calls, 0)
})

test("provider abandons a hung request once the timeout passes", async () => {
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    timeoutMs: 5,
    fetchImpl: hangingFetch(() => {
      calls += 1
    })
  })

  await assert.rejects(
    provider.suggestTags({
      bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
      vocabulary: [{ name: "AI", count: 4 }],
      allowNewTags: false
    }),
    new RegExp(REQUEST_TIMEOUT_ERROR)
  )

  // A timeout is transient, so it spends the single blind retry and then stops
  // instead of stalling the batch loop.
  assert.equal(calls, 2)
})

test("provider recovers when only the first request hangs", async () => {
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async () => {},
    timeoutMs: 5,
    fetchImpl: (url, init) => {
      calls += 1
      if (calls === 1) {
        return hangingFetch()(url, init)
      }

      return Promise.resolve(chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.9 }] }]))
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  assert.equal(calls, 2)
  assert.deepEqual(suggestions, [{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.9 }] }])
})

test("testLlmConnection reports a timeout instead of hanging", async () => {
  const result = await testLlmConnection({
    settings: SETTINGS,
    apiKey: "sk-test",
    timeoutMs: 5,
    fetchImpl: hangingFetch()
  })

  assert.deepEqual(result, { ok: false, error: REQUEST_TIMEOUT_ERROR })
})

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

test("provider retries a rate limit twice with a growing backoff", async () => {
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

  // The provider surfaces the failure so the pipeline can count and report it.
  await assert.rejects(
    provider.suggestTags({
      bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
      vocabulary: [{ name: "AI", count: 4 }],
      allowNewTags: false
    }),
    /HTTP 429/
  )

  // Rate limits are the failure most likely to pass on a later attempt, so they
  // get their own budget and the wait grows instead of repeating a flat 2s.
  assert.equal(calls, 3)
  assert.deepEqual(sleeps, [2000, 4000])
})

test("provider waits exactly as long as a Retry-After header asks", async () => {
  const sleeps: number[] = []
  let calls = 0
  const provider = createOpenAiCompatibleProvider({
    settings: SETTINGS,
    apiKey: "sk-test",
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "7" : null) },
          json: async () => ({}),
          text: async () => ""
        } as unknown as Response
      }

      return chatResponse([{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.6 }] }])
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
    vocabulary: [{ name: "AI", count: 4 }],
    allowNewTags: false
  })

  // The provider said 7 seconds, so guessing 2 would only cause another 429.
  assert.deepEqual(sleeps, [7000])
  assert.equal(suggestions.length, 1)
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

test("an unexplained 400 gets exactly one blind probe", async () => {
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

  // The error names no parameter, so one probe drops json mode in case the
  // gateway simply refused it silently. A second probe would only bury the
  // gateway's own reason under the answer to a question nobody asked.
  assert.equal(calls, 2)
})

test("a settled 4xx is reported verbatim without probing parameters", async () => {
  for (const status of [401, 402, 403, 404, 405]) {
    let calls = 0
    const provider = createOpenAiCompatibleProvider({
      settings: SETTINGS,
      apiKey: "sk-test",
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1
        return errorResponse(status, "invalid api key")
      }
    })

    await assert.rejects(
      provider.suggestTags({
        bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "hello" }],
        vocabulary: [{ name: "AI", count: 4 }],
        allowNewTags: false
      }),
      /invalid api key/,
      `status ${status} should surface the gateway message`
    )

    // No parameter change can fix authentication, quota, an unknown model or a
    // wrong route, and a retry would replace the real reason with a later one.
    assert.equal(calls, 1, `status ${status} should not be retried`)
  }
})

test("parseRetryAfterMs accepts seconds and dates and rejects nonsense", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z")

  assert.equal(parseRetryAfterMs("5", now), 5000)
  assert.equal(parseRetryAfterMs(" 5 ", now), 5000)
  assert.equal(parseRetryAfterMs("0", now), 0)
  assert.equal(parseRetryAfterMs("-3", now), 0)
  assert.equal(parseRetryAfterMs("2026-01-01T00:00:08.000Z", now), 8000)
  // A date already in the past means "retry now", not "wait forever".
  assert.equal(parseRetryAfterMs("2025-01-01T00:00:00.000Z", now), 0)
  // A hostile header must not be able to stall the run.
  assert.equal(parseRetryAfterMs("99999", now), 30_000)
  assert.equal(parseRetryAfterMs(null, now), null)
  assert.equal(parseRetryAfterMs("", now), null)
  assert.equal(parseRetryAfterMs("soon", now), null)
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
