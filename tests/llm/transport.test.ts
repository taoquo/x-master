import test from "node:test"
import assert from "node:assert/strict"
import {
  DEADLINE_EXCEEDED_ERROR,
  LlmError,
  classifyStatus,
  normalizeHttpError,
  redactBaseUrl,
  redactSecret,
  sanitizeLlmError
} from "../../src/lib/llm/errors.ts"
import { MAX_RETRY_AFTER_MS, parseRetryAfterMs, requestJson } from "../../src/lib/llm/transport.ts"

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? {})
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => text,
    json: async () => JSON.parse(text)
  } as unknown as Response
}

// A fake Response with neither headers nor body helpers, which is what several
// existing tests in this repo build. Every optional access has to survive it.
const bareResponse = (status: number) => ({ ok: status < 300, status }) as unknown as Response

test("parseRetryAfterMs accepts delay-seconds and HTTP dates", () => {
  const now = Date.parse("2026-04-11T08:00:00.000Z")

  assert.equal(parseRetryAfterMs("2", now), 2000)
  assert.equal(parseRetryAfterMs("0", now), 0)
  assert.equal(parseRetryAfterMs("Wed, 11 Apr 2026 08:00:03 GMT", now), 3000)
  // Unparsable and absent values are ignored rather than guessed.
  assert.equal(parseRetryAfterMs("soon", now), null)
  assert.equal(parseRetryAfterMs(null, now), null)
  // A long server-requested wait is not silently truncated to the cap here: the
  // caller decides, using the uncapped value.
  assert.equal(parseRetryAfterMs("600", now, Number.POSITIVE_INFINITY), 600_000)
})

test("classifyStatus maps the verdicts the UI branches on", () => {
  assert.equal(classifyStatus(401, ""), "unauthorized")
  assert.equal(classifyStatus(402, ""), "quota")
  assert.equal(classifyStatus(403, "exceeded your current quota"), "quota")
  assert.equal(classifyStatus(403, "region not allowed"), "forbidden")
  assert.equal(classifyStatus(429, ""), "rate-limit")
  assert.equal(classifyStatus(500, ""), "server")
  assert.equal(classifyStatus(400, "unsupported parameter: temperature"), "unsupported-param")
  assert.equal(classifyStatus(400, "maximum context length is 8192 tokens"), "context-length")
  assert.equal(classifyStatus(400, "content policy violation"), "content-filter")
  assert.equal(classifyStatus(400, "bad model id"), "bad-request")
  assert.equal(classifyStatus(404, ""), "bad-request")
})

test("normalizeHttpError keeps the legacy message wording and flags the body", () => {
  const bare = normalizeHttpError({ status: 401 })
  assert.equal(bare.message, "HTTP 401")
  assert.equal(bare.kind, "unauthorized")
  assert.equal(bare.messageCarriesBody, false)

  const detailed = normalizeHttpError({
    status: 400,
    bodyText: JSON.stringify({ error: { message: "unknown parameter: temperature" } })
  })
  assert.equal(detailed.message, "HTTP 400: unknown parameter: temperature")
  assert.equal(detailed.kind, "unsupported-param")
  assert.equal(detailed.droppedOption, "temperature")
  assert.equal(detailed.messageCarriesBody, true)
})

test("a key in the URL never reaches an error message", () => {
  assert.equal(redactBaseUrl("https://generativelanguage.googleapis.com/v1beta/models?key=secret"), "https://generativelanguage.googleapis.com/v1beta/models")
  assert.equal(redactSecret("failed at https://x/y?key=sk-abcdef123", "sk-abcdef123"), "failed at https://x/y?key=***")

  const sanitized = sanitizeLlmError(
    new Error("fetch failed: https://generativelanguage.googleapis.com/v1beta/models?key=sk-abcdef123"),
    "sk-abcdef123"
  )
  assert.equal(sanitized.message.includes("sk-abcdef123"), false)
})

test("a request is never attempted once the run budget is spent", async () => {
  let calls = 0
  await assert.rejects(
    () =>
      requestJson({
        url: "https://example.com/x",
        deadlineMs: Date.now() - 1,
        fetchImpl: async () => {
          calls += 1
          return response(200, {})
        }
      }),
    (error: unknown) => error instanceof LlmError && error.message === DEADLINE_EXCEEDED_ERROR
  )
  assert.equal(calls, 0, "the budget check must run before the first attempt")
})

test("a rate limit sleeps for the delay the provider asked for", async () => {
  const sleeps: number[] = []
  let calls = 0

  const result = await requestJson({
    url: "https://example.com/x",
    deadlineMs: Date.now() + 60_000,
    now: () => Date.now(),
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    fetchImpl: async () => {
      calls += 1
      return calls === 1 ? response(429, {}, { "retry-after": "2" }) : response(200, { ok: true })
    }
  })

  assert.equal(result.status, 200)
  assert.deepEqual(sleeps, [2000])
  assert.equal(calls, 2)
})

test("a very long retry-after is reported instead of slept through", async () => {
  const sleeps: number[] = []

  await assert.rejects(
    () =>
      requestJson({
        url: "https://example.com/x",
        deadlineMs: Date.now() + 10 * 60_000,
        sleep: async (ms) => {
          sleeps.push(ms)
        },
        fetchImpl: async () => response(429, {}, { "retry-after": String(MAX_RETRY_AFTER_MS / 1000 + 30) })
      }),
    (error: unknown) =>
      error instanceof LlmError && error.kind === "rate-limit" && (error.retryAfterMs ?? 0) > MAX_RETRY_AFTER_MS
  )

  assert.deepEqual(sleeps, [], "waiting minutes inside a run budget looks hung")
})

test("x-should-retry overrides the status code", async () => {
  // A 400 that the provider explicitly marks retryable is retried.
  let calls = 0
  const result = await requestJson({
    url: "https://example.com/x",
    deadlineMs: Date.now() + 60_000,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1
      return calls === 1
        ? response(400, { error: { message: "transient" } }, { "x-should-retry": "true" })
        : response(200, { ok: true })
    }
  })
  assert.equal(result.status, 200)
  assert.equal(calls, 2)

  // ...and a 500 the provider marks final is not.
  let second = 0
  await assert.rejects(() =>
    requestJson({
      url: "https://example.com/x",
      deadlineMs: Date.now() + 60_000,
      sleep: async () => {},
      fetchImpl: async () => {
        second += 1
        return response(500, {}, { "x-should-retry": "false" })
      }
    })
  )
  assert.equal(second, 1)
})

test("a transient failure is retried once and a settled one is not", async () => {
  let transient = 0
  const ok = await requestJson({
    url: "https://example.com/x",
    deadlineMs: Date.now() + 60_000,
    sleep: async () => {},
    fetchImpl: async () => {
      transient += 1
      return transient === 1 ? response(503, {}) : response(200, { ok: true })
    }
  })
  assert.equal(ok.status, 200)

  let settled = 0
  await assert.rejects(() =>
    requestJson({
      url: "https://example.com/x",
      deadlineMs: Date.now() + 60_000,
      sleep: async () => {},
      fetchImpl: async () => {
        settled += 1
        return response(401, {})
      }
    })
  )
  assert.equal(settled, 1, "a wrong key will not become right on the next attempt")
})

test("an unsupported parameter is dropped once and the request retried", async () => {
  const bodies: string[] = []
  let calls = 0

  const result = await requestJson({
    url: "https://example.com/x",
    deadlineMs: Date.now() + 60_000,
    sleep: async () => {},
    buildBody: (attempt) => ({ model: "m", temperature: attempt === 0 ? 0 : undefined }),
    onUnsupportedParam: () => true,
    fetchImpl: async (_url, init) => {
      bodies.push(String(init.body))
      calls += 1
      return calls === 1
        ? response(400, { error: { message: "unsupported parameter: temperature" } })
        : response(200, { ok: true })
    }
  })

  assert.equal(result.status, 200)
  assert.equal(calls, 2)
  assert.notEqual(bodies[0], bodies[1], "the retry has to be a different request")
})

test("a transport error is retried and carries the shared taxonomy", async () => {
  let calls = 0

  await assert.rejects(
    () =>
      requestJson({
        url: "https://example.com/x",
        deadlineMs: Date.now() + 60_000,
        sleep: async () => {},
        fetchImpl: async () => {
          calls += 1
          if (calls === 1) {
            throw new Error("socket hang up")
          }
          return response(200, { ok: true })
        }
      }),
    () => false
  ).catch(() => {})

  // Second attempt succeeds, so the call must resolve.
  assert.equal(calls, 2)
})

test("a fake Response without headers or text() still produces a verdict", async () => {
  await assert.rejects(
    () =>
      requestJson({
        url: "https://example.com/x",
        deadlineMs: Date.now() + 60_000,
        sleep: async () => {},
        fetchImpl: async () => bareResponse(401)
      }),
    (error: unknown) => error instanceof LlmError && error.message === "HTTP 401"
  )
})
