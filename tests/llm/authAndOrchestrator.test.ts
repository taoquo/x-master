import test from "node:test"
import assert from "node:assert/strict"
import {
  clearProviderApiKey,
  isProviderConfigured,
  providerAuth,
  resolveAuth,
  saveProviderApiKey
} from "../../src/lib/llm/auth/index.ts"
import { LLM_PROVIDERS, resolveProvider } from "../../src/lib/llm/providers.ts"
import { createAutoTagLlmProvider, testLlmConnectionFor } from "../../src/lib/llm/orchestrator.ts"
import { getSecrets, modifySecrets } from "../../src/lib/storage/secrets.ts"
import type { AutoTagLlmSettings } from "../../src/lib/types.ts"

function installStorage(): { read: () => Record<string, unknown> } {
  let stored: Record<string, unknown> = {}
  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async (key?: string) => (typeof key === "string" ? { [key]: stored[key] } : { ...stored }),
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
        },
        setAccessLevel: async () => {}
      }
    }
  }
  return { read: () => stored }
}

function llmSettings(overrides: Partial<AutoTagLlmSettings> = {}): AutoTagLlmSettings {
  return {
    enabled: true,
    activeProviderId: "custom",
    baseUrl: "https://local.example/v1",
    model: "test-model",
    batchSize: 5,
    maxBookmarksPerRun: 50,
    tagVocabularyMode: "guarded",
    ...overrides
  }
}

const chatResponse = (content: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
  }) as unknown as Response

test("v1 ships no OAuth implementation, and no provider advertises one", () => {
  for (const provider of LLM_PROVIDERS) {
    const auth = providerAuth(resolveProvider(provider.id))
    assert.ok(auth.apiKey, `${provider.id} must declare api-key auth`)
    assert.equal(auth.oauth, undefined, `${provider.id} must not declare an OAuth flow in v1`)
  }
})

test("a keyless provider counts as configured, a keyed one does not", async () => {
  installStorage()

  // `custom` is api-key-or-none: a local server needs no credential.
  assert.equal(await isProviderConfigured("custom"), true)
  assert.equal(await isProviderConfigured("openai"), false)

  await saveProviderApiKey("openai", "  sk-openai  ")
  assert.equal(await isProviderConfigured("openai"), true)
  // The key is trimmed and stored per provider.
  assert.deepEqual((await getSecrets()).llmProfiles?.openai, { kind: "api-key", apiKey: "sk-openai" })
  assert.equal((await getSecrets()).llmApiKey, undefined, "the legacy field is never written")
})

test("resolveAuth prefers the provider profile and only falls back to the legacy key when allowed", async () => {
  installStorage()
  await modifySecrets(() => ({ llmApiKey: "sk-legacy" }))

  // Legacy install: one key, belonging to whichever provider is active.
  assert.deepEqual(await resolveAuth("openai", { allowLegacy: true }), { apiKey: "sk-legacy" })
  // ...but not for a provider that is not the active one.
  assert.equal(await resolveAuth("anthropic", { allowLegacy: false }), undefined)

  await saveProviderApiKey("anthropic", "sk-anthropic")
  assert.deepEqual(await resolveAuth("anthropic", { allowLegacy: true }), { apiKey: "sk-anthropic" })

  await clearProviderApiKey("anthropic")
  assert.equal((await getSecrets()).llmProfiles?.anthropic, undefined)
})

test("concurrent credential writes cannot lose an update", async () => {
  installStorage()

  await Promise.all(
    Array.from({ length: 10 }, (_, index) => saveProviderApiKey(`provider-${index}`, `sk-${index}`))
  )

  const profiles = (await getSecrets()).llmProfiles ?? {}
  assert.equal(Object.keys(profiles).length, 10, "a serialised read-modify-write must keep every write")
  for (let index = 0; index < 10; index += 1) {
    assert.equal(profiles[`provider-${index}`]?.apiKey, `sk-${index}`)
  }
})

test("the orchestrator puts the schema in the prompt when the provider cannot enforce it", async () => {
  installStorage()
  const bodies: Array<Record<string, unknown>> = []

  const provider = createAutoTagLlmProvider({
    settings: llmSettings({ capabilityOverrides: { jsonStrategy: "prompt-only" } }),
    credential: { apiKey: "sk-x" },
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return chatResponse(JSON.stringify({ results: [{ tweetId: "t1", tags: [{ name: "ai", confidence: 0.9 }] }] }))
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "agents" }],
    vocabulary: [],
    allowNewTags: true
  })

  assert.deepEqual(suggestions, [{ tweetId: "t1", tags: [{ name: "ai", confidence: 0.9 }] }])
  const messages = bodies[0].messages as Array<{ role: string; content: string }>
  assert.equal(messages[0].role, "system")
  assert.match(messages[0].content, /single JSON object matching this schema/)
  // No response_format at all in prompt-only mode.
  assert.equal("response_format" in bodies[0], false)
})

test("a prose answer is retried once and then accepted", async () => {
  installStorage()
  let calls = 0

  const provider = createAutoTagLlmProvider({
    settings: llmSettings(),
    credential: { apiKey: "sk-x" },
    fetchImpl: async () => {
      calls += 1
      return calls === 1
        ? chatResponse("I am not sure how to tag these.")
        : chatResponse(JSON.stringify({ results: [{ tweetId: "t1", tags: [{ name: "ai", confidence: 0.8 }] }] }))
    }
  })

  const suggestions = await provider.suggestTags({
    bookmarks: [{ tweetId: "t1", authorHandle: "alice", text: "agents" }],
    vocabulary: [],
    allowNewTags: true
  })

  assert.equal(calls, 2, "an unparsable answer is worth exactly one more attempt")
  assert.equal(suggestions.length, 1)
})

test("test connection reports the strategy, the dropped parameters and a missing credential", async () => {
  installStorage()

  const missing = await testLlmConnectionFor({ settings: llmSettings({ activeProviderId: "openai" }) })
  assert.equal(missing.ok, false)
  assert.equal(missing.message, "missing-credentials")
  assert.equal(missing.strategy, "json-schema-strict")

  const settings = llmSettings({
    activeProviderId: "openai",
    baseUrl: "",
    model: "o3-mini"
  })
  const result = await testLlmConnectionFor({
    settings,
    credential: { apiKey: "sk-x" },
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) } as unknown as Response)
  })

  assert.equal(result.ok, true)
  assert.equal(result.providerId, "openai")
  assert.equal(result.model, "o3-mini")
  assert.ok(result.droppedOptions?.includes("temperature"), "a reasoning model cannot take temperature")
})

test("test connection never returns the credential", async () => {
  installStorage()
  const result = await testLlmConnectionFor({
    settings: llmSettings({ activeProviderId: "openai", baseUrl: "" }),
    credential: { apiKey: "sk-super-secret" },
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "" } as unknown as Response)
  })

  assert.equal(JSON.stringify(result).includes("sk-super-secret"), false)
})
