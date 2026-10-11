import test from "node:test"
import assert from "node:assert/strict"
import { anthropicMessagesAdapter } from "../../src/lib/llm/adapters/anthropicMessages.ts"
import { azureOpenAiChatAdapter } from "../../src/lib/llm/adapters/azureOpenAiChat.ts"
import { googleGenerativeAiAdapter } from "../../src/lib/llm/adapters/googleGenerativeAi.ts"
import { openAiChatAdapter } from "../../src/lib/llm/adapters/openaiChat.ts"
import { LlmError } from "../../src/lib/llm/errors.ts"
import { resolveCapabilities } from "../../src/lib/llm/capabilities.ts"
import type { AdapterContext, ChatJsonRequest } from "../../src/lib/llm/types.ts"

interface Captured {
  url: string
  headers: Record<string, string>
  body: unknown
}

function makeContext(
  overrides: Partial<AdapterContext> = {},
  captured: Captured[] = [],
  responder?: (captured: Captured) => Response
): AdapterContext {
  return {
    apiKey: "sk-secret",
    baseUrl: "https://api.example.com",
    timeoutMs: 5_000,
    // Same clock as the deadlines in this file: a fixed fake clock next to a real
    // epoch deadline makes the budget meaningless.
    now: () => Date.now(),
    capabilities: { jsonStrategy: "json-schema-strict", temperature: true },
    fetchImpl: async (url, init) => {
      const entry: Captured = {
        url,
        headers: (init.headers ?? {}) as Record<string, string>,
        body: init.body === undefined ? undefined : JSON.parse(String(init.body))
      }
      captured.push(entry)
      return responder
        ? responder(entry)
        : ({ ok: true, status: 200, json: async () => ({}) } as unknown as Response)
    },
    ...overrides
  }
}

const request = (overrides: Partial<ChatJsonRequest> = {}): ChatJsonRequest => ({
  model: "test-model",
  system: "SYSTEM",
  user: "USER",
  schemaName: "tag_suggestions",
  jsonSchema: { type: "object", properties: { results: { type: "array" } } },
  jsonMode: "prefer",
  temperature: 0,
  deadlineMs: Date.now() + 60_000,
  ...overrides
})

test("openai-chat sends the schema in strict mode and reports o-series temperature as dropped", async () => {
  const captured: Captured[] = []
  const context = makeContext({}, captured, () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: '{"results":[]}' }, finish_reason: "stop" }] })
  } as unknown as Response))

  const result = await openAiChatAdapter.chatJson(request(), context)

  assert.equal(captured.length, 1)
  assert.equal(captured[0].url, "https://api.example.com/v1/chat/completions")
  const body = captured[0].body as Record<string, unknown>
  assert.equal(body.model, "test-model")
  assert.equal((body.messages as Array<{ role: string }>)[0].role, "system")
  assert.deepEqual(body.response_format, {
    type: "json_schema",
    json_schema: { name: "tag_suggestions", strict: true, schema: request().jsonSchema }
  })
  assert.equal(result.text, '{"results":[]}')

  // A reasoning model rejects temperature, so it must not be sent — and the caller
  // has to be told it was not.
  const oSeries: Captured[] = []
  const oContext = makeContext(
    { capabilities: resolveCapabilities({ providerId: "openai", model: "o3-mini" }) },
    oSeries,
    () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) } as unknown as Response)
  )
  const oResult = await openAiChatAdapter.chatJson(request({ model: "o3-mini" }), oContext)

  assert.equal("temperature" in (oSeries[0].body as Record<string, unknown>), false)
  assert.ok(oResult.droppedOptions.includes("temperature"))
})

test("openai-chat sends no Authorization header for a keyless local endpoint", async () => {
  const captured: Captured[] = []
  const context = makeContext(
    { apiKey: undefined, capabilities: { jsonStrategy: "json-object", temperature: true } },
    captured,
    () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) } as unknown as Response)
  )

  await openAiChatAdapter.chatJson(request(), context)

  assert.equal("Authorization" in captured[0].headers, false)
  assert.deepEqual((captured[0].body as Record<string, unknown>).response_format, { type: "json_object" })
})

test("openai-chat maps engine errors onto the shared taxonomy", async () => {
  const context = makeContext({}, [], () => ({
    ok: false,
    status: 401,
    headers: { get: () => null },
    text: async () => ""
  } as unknown as Response))

  await assert.rejects(
    () => openAiChatAdapter.chatJson(request(), context),
    (error: unknown) => error instanceof LlmError && error.kind === "unauthorized"
  )
})

test("anthropic-messages uses the tool path, the required headers and a top-level system field", async () => {
  const captured: Captured[] = []
  const context = makeContext(
    {
      baseUrl: "https://api.anthropic.com",
      capabilities: { jsonStrategy: "tool", temperature: true }
    },
    captured,
    () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "tool_use", name: "emit_tags", input: { results: [{ tweetId: "t1", tags: [] }] } }],
        stop_reason: "tool_use",
        usage: { input_tokens: 11, output_tokens: 22 }
      })
    } as unknown as Response)
  )

  const result = await anthropicMessagesAdapter.chatJson(request(), context)

  assert.equal(captured[0].url, "https://api.anthropic.com/v1/messages")
  assert.equal(captured[0].headers["x-api-key"], "sk-secret")
  assert.equal(captured[0].headers["anthropic-version"], "2023-06-01")
  // Without this header Anthropic refuses a browser-origin request outright.
  assert.equal(captured[0].headers["anthropic-dangerous-direct-browser-access"], "true")

  const body = captured[0].body as Record<string, unknown>
  assert.equal(body.system, "SYSTEM")
  assert.equal(typeof body.max_tokens, "number")
  assert.equal((body.tool_choice as { name: string }).name, "emit_tags")
  assert.deepEqual(result.parsed, { results: [{ tweetId: "t1", tags: [] }] })
  assert.equal(result.usage?.inputTokens, 11)
})

test("anthropic-messages reports a missing tool call as unparsable output", async () => {
  const context = makeContext(
    { capabilities: { jsonStrategy: "tool", temperature: true } },
    [],
    () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "sorry" }] }) } as unknown as Response)
  )

  await assert.rejects(
    () => anthropicMessagesAdapter.chatJson(request(), context),
    (error: unknown) => error instanceof LlmError && error.kind === "invalid-json"
  )
})

test("google-generative-ai shapes the URL, the system instruction and the JSON mime type", async () => {
  const captured: Captured[] = []
  const context = makeContext(
    {
      baseUrl: "https://generativelanguage.googleapis.com",
      capabilities: { jsonStrategy: "json-object", temperature: true }
    },
    captured,
    () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"results":[]}' }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 }
      })
    } as unknown as Response)
  )

  const result = await googleGenerativeAiAdapter.chatJson(request({ model: "gemini-2.0-flash" }), context)

  assert.equal(
    captured[0].url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=sk-secret"
  )
  const body = captured[0].body as Record<string, unknown>
  assert.deepEqual(body.systemInstruction, { parts: [{ text: "SYSTEM" }] })
  assert.equal(
    ((body.generationConfig as Record<string, unknown>).responseMimeType as string),
    "application/json"
  )
  assert.equal(result.text, '{"results":[]}')
  assert.equal(result.usage?.outputTokens, 4)
})

test("google-generative-ai never lets the key escape through an error message", async () => {
  const context = makeContext(
    { baseUrl: "https://generativelanguage.googleapis.com", capabilities: { jsonStrategy: "json-object", temperature: true } },
    [],
    () => {
      throw new Error("fetch failed for https://generativelanguage.googleapis.com/v1beta/models?key=sk-secret")
    }
  )

  await assert.rejects(
    () => googleGenerativeAiAdapter.chatJson(request(), context),
    (error: unknown) => error instanceof LlmError && !error.message.includes("sk-secret")
  )
})

test("azure-openai-chat routes by deployment and authenticates with the api-key header", async () => {
  const captured: Captured[] = []
  const context = makeContext(
    {
      baseUrl: "https://my-resource.openai.azure.com",
      deploymentName: "my-deployment",
      apiVersion: "2024-10-21",
      capabilities: { jsonStrategy: "json-object", temperature: true }
    },
    captured,
    () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) } as unknown as Response)
  )

  await azureOpenAiChatAdapter.chatJson(request(), context)

  assert.equal(
    captured[0].url,
    "https://my-resource.openai.azure.com/openai/deployments/my-deployment/chat/completions?api-version=2024-10-21"
  )
  assert.equal(captured[0].headers["api-key"], "sk-secret")
  assert.equal("authorization" in captured[0].headers, false)
})

test("azure-openai-chat refuses to send a request without a deployment", async () => {
  const captured: Captured[] = []
  const context = makeContext({ deploymentName: "" }, captured)

  await assert.rejects(
    () => azureOpenAiChatAdapter.chatJson(request(), context),
    (error: unknown) => error instanceof LlmError && error.kind === "bad-request"
  )
  assert.equal(captured.length, 0, "an impossible request must not reach the network")
})

test("every adapter refuses to start a request once the budget is spent", async () => {
  const past = request({ deadlineMs: Date.now() - 1 })

  for (const adapter of [openAiChatAdapter, anthropicMessagesAdapter, googleGenerativeAiAdapter, azureOpenAiChatAdapter]) {
    const captured: Captured[] = []
    const context = makeContext(
      { deploymentName: "d", apiVersion: "2024-10-21", capabilities: { jsonStrategy: "json-object", temperature: true } },
      captured
    )

    await assert.rejects(() => adapter.chatJson(past, context), (error: unknown) => error instanceof LlmError)
    assert.equal(captured.length, 0, `${adapter.id} must check the budget before its first attempt`)
  }
})
