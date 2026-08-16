import assert from "node:assert/strict"
import test from "node:test"
import {
  buildVocabularyEntries,
  buildVocabularyReviewPrompt,
  mergePlanKey,
  parseVocabularyReview,
  renamePlanKey,
  reviewTagVocabulary
} from "../../src/lib/autotag/vocabularyReview.ts"
import type { BookmarkTagRecord, TagRecord } from "../../src/lib/types.ts"

const SETTINGS = { baseUrl: "https://api.example.com/v1/", model: "test-model" }

function makeTag(id: string, name: string): TagRecord {
  return { id, name, createdAt: "2026-01-01T00:00:00.000Z" }
}

function makeRelation(bookmarkId: string, tagId: string): BookmarkTagRecord {
  return { id: `${bookmarkId}:${tagId}`, bookmarkId, tagId, createdAt: "2026-01-01T00:00:00.000Z" }
}

function chatResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    text: async () => ""
  } as unknown as Response
}

test("buildVocabularyReviewPrompt states the target size and naming rules", () => {
  const prompt = buildVocabularyReviewPrompt({
    vocabulary: [
      { name: "llm", count: 40 },
      { name: "ai agents", count: 3 }
    ]
  })

  assert.match(prompt, /30-50 durable subject tags/)
  assert.match(prompt, /English only, lowercase, singular/)
  assert.match(prompt, /Never merge across different domains/)
  // Most used first, with counts.
  assert.ok(prompt.includes("llm (40), ai agents (3)"))
  assert.match(prompt, /"merges"/)
})

test("buildVocabularyReviewPrompt handles an empty vocabulary", () => {
  const prompt = buildVocabularyReviewPrompt({ vocabulary: [] })
  assert.match(prompt, /\(empty\)/)
})

test("buildVocabularyEntries counts bookmarks per tag", () => {
  const entries = buildVocabularyEntries(
    [makeTag("t1", "llm"), makeTag("t2", "design")],
    [makeRelation("b1", "t1"), makeRelation("b2", "t1")]
  )

  assert.deepEqual(entries, [
    { name: "llm", count: 2 },
    { name: "design", count: 0 }
  ])
})

test("parseVocabularyReview keeps only proposals that reference existing tags", () => {
  const review = parseVocabularyReview(
    JSON.stringify({
      merges: [
        { from: ["AI Agents", "unknown tag"], into: "llm", reason: "  same   concept " },
        { from: ["ghost"], into: "llm" }
      ],
      renames: [
        { from: "Design ", to: "design system" },
        { from: "missing", to: "whatever" }
      ]
    }),
    ["llm", "ai agent", "design"]
  )

  assert.deepEqual(review.merges, [{ from: ["ai agent"], into: "llm", reason: "same concept" }])
  assert.deepEqual(review.renames, [{ from: "design", to: "design system", reason: undefined }])
})

test("parseVocabularyReview drops self-merges and repeated tags", () => {
  const review = parseVocabularyReview(
    JSON.stringify({
      merges: [
        { from: ["llms", "ai agent"], into: "llm" },
        { from: ["ai agent"], into: "design" }
      ]
    }),
    ["llm", "ai agent", "design"]
  )

  // "llms" collapses onto "llm" canonically, so only "ai agent" survives as a source.
  assert.deepEqual(review.merges, [{ from: ["ai agent"], into: "llm", reason: undefined }])
})

test("parseVocabularyReview turns a merge into an unknown name into merge plus rename", () => {
  const review = parseVocabularyReview(
    JSON.stringify({
      merges: [{ from: ["ai agent", "agentic ai"], into: "agent framework" }]
    }),
    ["ai agent", "agentic ai"]
  )

  assert.deepEqual(review.merges, [{ from: ["agentic ai"], into: "ai agent", reason: undefined }])
  assert.deepEqual(review.renames, [{ from: "ai agent", to: "agent framework", reason: undefined }])
})

test("parseVocabularyReview treats a rename onto an existing tag as a merge", () => {
  const review = parseVocabularyReview(
    JSON.stringify({ renames: [{ from: "agentic ai", to: "ai agent" }] }),
    ["ai agent", "agentic ai"]
  )

  assert.deepEqual(review.merges, [{ from: ["agentic ai"], into: "ai agent", reason: undefined }])
  assert.deepEqual(review.renames, [])
})

test("parseVocabularyReview returns nothing for invalid JSON", () => {
  assert.deepEqual(parseVocabularyReview("not json", ["llm"]), { merges: [], renames: [] })
})

test("reviewTagVocabulary resolves proposals to tag ids", async () => {
  const tags = [makeTag("t1", "llm"), makeTag("t2", "ai agents"), makeTag("t3", "Design")]
  const result = await reviewTagVocabulary({
    settings: SETTINGS,
    apiKey: "key",
    tags,
    bookmarkTags: [makeRelation("b1", "t1"), makeRelation("b1", "t2")],
    fetchImpl: async () =>
      chatResponse({
        merges: [{ from: ["ai agents"], into: "llm", reason: "same concept" }],
        renames: [{ from: "Design", to: "design system" }]
      })
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.merges, [
    {
      targetTagId: "t1",
      targetName: "llm",
      sourceTagIds: ["t2"],
      sourceNames: ["ai agents"],
      reason: "same concept"
    }
  ])
  assert.deepEqual(result.renames, [{ tagId: "t3", from: "Design", to: "design system", reason: undefined }])
  assert.equal(mergePlanKey(result.merges[0]), "merge:t1:t2")
  assert.equal(renamePlanKey(result.renames[0]), "rename:t3:design system")
})

test("reviewTagVocabulary skips the request for a tiny vocabulary", async () => {
  let calls = 0
  const result = await reviewTagVocabulary({
    settings: SETTINGS,
    apiKey: "key",
    tags: [makeTag("t1", "llm")],
    bookmarkTags: [],
    fetchImpl: async () => {
      calls += 1
      return chatResponse({})
    }
  })

  assert.equal(calls, 0)
  assert.deepEqual(result, { ok: true, merges: [], renames: [] })
})

test("reviewTagVocabulary surfaces provider failures", async () => {
  const result = await reviewTagVocabulary({
    settings: SETTINGS,
    apiKey: "key",
    tags: [makeTag("t1", "llm"), makeTag("t2", "design")],
    bookmarkTags: [],
    sleep: async () => {},
    fetchImpl: async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => JSON.stringify({ error: { message: "boom" } })
      }) as unknown as Response
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, "HTTP 500: boom")
  assert.deepEqual(result.merges, [])
})
