import test from "node:test"
import assert from "node:assert/strict"
import { generateKnowledgeCardDraftWithAi } from "../../src/lib/cards/generateKnowledgeCardDraftWithAi.ts"

const sourceMaterial = {
  tweetId: "tweet-1",
  tweetUrl: "https://x.com/alice/status/tweet-1",
  authorName: "Alice",
  authorHandle: "alice",
  text: "Agent systems need explicit tool calls. ```ts\\nawait runTool()\\n``` This pattern helps with observability.",
  createdAtOnX: "2026-03-15T00:00:00.000Z",
  savedAt: "2026-03-15T00:01:00.000Z",
  rawPayload: {},
  sourceKind: "x-bookmark" as const
}

test("generateKnowledgeCardDraftWithAi uses OpenAI structured output when configured", async () => {
  const card = await generateKnowledgeCardDraftWithAi({
    sourceMaterial,
    settings: {
      enabled: true,
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-5-mini"
    },
    fetchImpl: async () =>
      ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            title: "Agent observability pattern",
            theme: "Agent observability pattern",
            summary: "Explicit tool calls make agent systems easier to debug.",
            keyExcerpt: "```ts\\nawait runTool()\\n```",
            applicability: "Useful when building agent orchestration loops with better debugging.",
            supportingEvidence: {
              theme: "Agent systems need explicit tool calls.",
              summary: "Agent systems need explicit tool calls.",
              keyExcerpt: "```ts\\nawait runTool()\\n```",
              applicability: "This pattern helps with observability."
            },
            quality: {
              score: 92,
              warnings: []
            }
          })
        })
      }) as Response
  })

  assert.equal(card.title, "Agent observability pattern")
  assert.equal(card.quality.generatorVersion, "openai-responses-v1:gpt-5-mini")
  assert.equal(card.quality.needsReview, false)
  assert.equal(card.provenance.length, 4)
})

test("generateKnowledgeCardDraftWithAi falls back to heuristic output when the API fails", async () => {
  const card = await generateKnowledgeCardDraftWithAi({
    sourceMaterial,
    settings: {
      enabled: true,
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-5-mini"
    },
    fetchImpl: async () =>
      ({
        ok: false,
        status: 401,
        text: async () => "unauthorized"
      }) as Response
  })

  assert.equal(card.id, "card-tweet-1")
  assert.equal(card.quality.needsReview, true)
  assert.equal(card.quality.warnings.some((warning) => warning.includes("AI generation failed")), true)
})
