import test from "node:test"
import assert from "node:assert/strict"
import { assembleRequest, resolveCapabilities } from "../../src/lib/llm/capabilities.ts"
import { LlmError } from "../../src/lib/llm/errors.ts"
import {
  UnsupportedSchemaError,
  degradeStrategy,
  parseJsonLoose,
  toStrictJsonSchema
} from "../../src/lib/llm/json.ts"
import {
  LLM_PROVIDERS,
  joinUrl,
  permissionOrigin,
  resolveBaseUrl,
  resolveProvider,
  validateBaseUrl
} from "../../src/lib/llm/providers.ts"
import { KNOWN_API_IDS, apiFor } from "../../src/lib/llm/registry.ts"

const UNSUPPORTED = [
  "$ref",
  "$defs",
  "definitions",
  "allOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "patternProperties",
  "dependentSchemas",
  "dependencies",
  "unevaluatedProperties",
  "propertyNames",
  "contains",
  "prefixItems"
]

test("strict JSON schema mode rejects every keyword the hosted endpoints refuse", () => {
  for (const keyword of UNSUPPORTED) {
    assert.throws(
      () => toStrictJsonSchema({ type: "object", [keyword]: {} }),
      (error: unknown) => error instanceof UnsupportedSchemaError,
      `${keyword} must be rejected before it reaches the provider`
    )
  }

  assert.throws(() => toStrictJsonSchema({ type: "object", items: [{ type: "string" }] }), UnsupportedSchemaError)
})

test("strict JSON schema mode forces required, closed objects and nullable optionals", () => {
  const strict = toStrictJsonSchema({
    type: "object",
    properties: {
      requiredField: { type: "string" },
      optionalField: { type: "number" },
      list: { type: "array", items: { type: "object", properties: { id: { type: "string" } } } }
    },
    required: ["requiredField"]
  })

  assert.equal(strict.additionalProperties, false)
  assert.deepEqual(strict.required, ["requiredField", "optionalField", "list"])
  assert.deepEqual(strict.properties, {
    requiredField: { type: "string" },
    // Strict mode cannot express "optional", so the type gains null instead.
    optionalField: { anyOf: [{ type: "number" }, { type: "null" }] },
    // Also not in `required`, so it is wrapped the same way.
    list: {
      anyOf: [
        {
          type: "array",
          items: {
            type: "object",
            // `id` is optional in the source schema, so it is wrapped here too.
            properties: { id: { anyOf: [{ type: "string" }, { type: "null" }] } },
            required: ["id"],
            additionalProperties: false
          }
        },
        { type: "null" }
      ]
    }
  })
})

test("degradeStrategy walks down towards prompt-only and stops there", () => {
  assert.equal(degradeStrategy("json-schema-strict"), "json-schema")
  assert.equal(degradeStrategy("json-schema-strict", 2), "json-object")
  assert.equal(degradeStrategy("tool"), "prompt-only")
  assert.equal(degradeStrategy("prompt-only", 5), "prompt-only")
})

test("parseJsonLoose recovers a payload from prose, fences and bare arrays", () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonLoose('Here you go:\n```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseJsonLoose('noise {"a":1} trailing'), { a: 1 })
  assert.deepEqual(parseJsonLoose("[1,2]"), [1, 2])

  assert.throws(
    () => parseJsonLoose("I could not decide"),
    (error: unknown) => error instanceof LlmError && error.kind === "invalid-json"
  )
})

test("capabilities resolve in the documented order", () => {
  // 4. provider default
  assert.equal(resolveCapabilities({ providerId: "anthropic", model: "whatever" }).jsonStrategy, "tool")
  // 3. documented model-name prefix
  assert.equal(resolveCapabilities({ providerId: "openai", model: "o3-mini" }).temperature, false)
  assert.equal(resolveCapabilities({ providerId: "openai", model: "gpt-4o-mini" }).temperature, true)
  // 2. what a previous run learned beats the prefix table
  assert.equal(
    resolveCapabilities({ providerId: "openai", model: "o3-mini", learned: { temperature: true } }).temperature,
    true
  )
  // 1. the user's explicit override beats everything
  assert.equal(
    resolveCapabilities({
      providerId: "openai",
      model: "o3-mini",
      learned: { temperature: true },
      overrides: { temperature: false }
    }).temperature,
    false
  )
  // An unknown provider id falls back to the default provider rather than throwing.
  assert.equal(resolveCapabilities({ providerId: "nope", model: "m" }).jsonStrategy, "json-schema-strict")
})

test("request assembly decides interacting capabilities together", () => {
  const withSchema = { type: "object", properties: {} }

  const plain = assembleRequest({
    capabilities: { jsonStrategy: "prompt-only", temperature: true },
    temperature: 0,
    jsonSchema: withSchema,
    requireSchema: false
  })
  assert.equal(plain.strategy, "prompt-only")
  assert.equal(plain.promptIncludesSchema, true, "the schema has to travel in the prompt instead")
  assert.equal(plain.jsonSchema, undefined)
  assert.ok(plain.droppedOptions.includes("jsonSchema"))

  const noTemp = assembleRequest({
    capabilities: { jsonStrategy: "json-object", temperature: false },
    temperature: 0,
    requireSchema: false
  })
  assert.equal(noTemp.temperature, undefined)
  assert.deepEqual(noTemp.droppedOptions, ["temperature"])

  const clamped = assembleRequest({
    capabilities: { jsonStrategy: "json-object", temperature: true, contextWindow: 100 },
    maxOutputTokens: 500,
    requireSchema: false
  })
  assert.equal(clamped.maxOutputTokens, 100)
  assert.ok(clamped.droppedOptions.includes("maxOutputTokens"))
})

test("the provider catalog is internally consistent", () => {
  const ids = LLM_PROVIDERS.map((provider) => provider.id)
  assert.equal(new Set(ids).size, ids.length, "provider ids must be unique")

  for (const provider of LLM_PROVIDERS) {
    assert.ok(KNOWN_API_IDS.includes(provider.api), `${provider.id} points at an unknown api: ${provider.api}`)
    if (provider.defaultBaseUrl) {
      assert.ok(provider.defaultBaseUrl.startsWith("https://"), `${provider.id} must default to https`)
      assert.equal(
        provider.originPattern,
        `${new URL(provider.defaultBaseUrl).origin}/*`,
        `${provider.id} origin pattern must match its endpoint`
      )
    }
    // v1 ships API keys only: no provider may advertise an OAuth flow.
    assert.equal("oauth" in provider, false)
  }
})

test("a user-supplied endpoint is validated before it is ever used", () => {
  assert.equal(validateBaseUrl("https://api.example.com/v1").ok, true)
  assert.equal(validateBaseUrl("http://localhost:11434/v1").ok, true)
  assert.equal(validateBaseUrl("http://127.0.0.1:1234").ok, true)

  assert.deepEqual(validateBaseUrl("   ").error, "empty")
  assert.deepEqual(validateBaseUrl("not a url").error, "invalid")
  // Anything that is not https (or loopback http) is refused.
  assert.deepEqual(validateBaseUrl("http://example.com").error, "protocol")
  assert.deepEqual(validateBaseUrl("javascript:alert(1)").error, "protocol")
  assert.deepEqual(validateBaseUrl("file:///etc/passwd").error, "protocol")
})

test("permission origin and URL joining behave", () => {
  assert.equal(permissionOrigin("https://api.example.com/v1"), "https://api.example.com/*")
  assert.equal(permissionOrigin(""), undefined)
  assert.equal(permissionOrigin("javascript:alert(1)"), undefined)

  assert.equal(joinUrl("https://x.example/", "/v1/messages"), "https://x.example/v1/messages")
  assert.equal(joinUrl("https://x.example", "v1/messages"), "https://x.example/v1/messages")

  assert.equal(resolveProvider("anthropic").id, "anthropic")
  assert.equal(resolveProvider("unknown").id, "openai")
  assert.equal(resolveBaseUrl(resolveProvider("openai"), ""), "https://api.openai.com/v1")
  assert.equal(resolveBaseUrl(resolveProvider("openai"), "https://mine.example/v1"), "https://mine.example/v1")
})

test("adapter dispatch is a data lookup and fails loudly on an unknown api", () => {
  assert.equal(apiFor("openai-chat", "m").id, "openai-chat")
  assert.equal(apiFor("anthropic-messages", "m").id, "anthropic-messages")
  // A per-model map is supported for vendors that speak different protocols.
  assert.equal(apiFor({ "gpt-4o": "openai-chat", "claude-x": "anthropic-messages" }, "claude-x").id, "anthropic-messages")

  assert.throws(
    () => apiFor("nope", "m"),
    (error: unknown) => error instanceof LlmError && error.message.includes("nope")
  )
})
