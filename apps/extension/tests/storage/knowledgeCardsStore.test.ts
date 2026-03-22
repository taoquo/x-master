import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { getAllKnowledgeCardDrafts, regenerateKnowledgeCardDraft, updateKnowledgeCardDraft, upsertKnowledgeCardDraftsForSourceMaterials } from "../../src/lib/storage/knowledgeCardsStore.ts"

test("upsertKnowledgeCardDraftsForSourceMaterials creates one card per source material with provenance and quality", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents are easiest to debug when every tool call is explicit. ```ts\\nawait runTool()\\n``` Use this when building orchestration loops.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {}
    }
  ])

  const result = await upsertKnowledgeCardDraftsForSourceMaterials([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Agents are easiest to debug when every tool call is explicit. ```ts\\nawait runTool()\\n``` Use this when building orchestration loops.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    }
  ])

  const cards = await getAllKnowledgeCardDrafts()

  assert.equal(result.createdCount, 1)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].sourceMaterialId, "tweet-1")
  assert.equal(cards[0].status, "draft")
  assert.equal(cards[0].provenance.length >= 4, true)
  assert.equal(cards[0].quality.generatorVersion, "heuristic-v1")
  assert.equal(cards[0].keyExcerpt.includes("runTool"), true)
})

test("updateKnowledgeCardDraft marks the card as reviewed and stores edits", async () => {
  await resetBookmarksDb()

  await upsertKnowledgeCardDraftsForSourceMaterials([
    {
      tweetId: "tweet-2",
      tweetUrl: "https://x.com/bob/status/tweet-2",
      authorName: "Bob",
      authorHandle: "bob",
      text: "Prompt pipelines work better when the final schema is explicit.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    }
  ])

  const updated = await updateKnowledgeCardDraft("card-tweet-2", {
    title: "Prompt pipeline schema discipline",
    theme: "Prompt pipeline schema discipline",
    summary: "Explicit output schemas reduce ambiguity in prompt pipelines.",
    keyExcerpt: "Prompt pipelines work better when the final schema is explicit.",
    applicability: "Useful when designing structured LLM workflows."
  })

  assert.equal(updated.status, "reviewed")
  assert.equal(updated.title, "Prompt pipeline schema discipline")
  assert.equal(updated.quality.needsReview, false)
})

test("upsertKnowledgeCardDraftsForSourceMaterials skips regeneration when the source fingerprint is unchanged", async () => {
  await resetBookmarksDb()

  let generatedCount = 0
  const sourceMaterial = {
    tweetId: "tweet-3",
    tweetUrl: "https://x.com/cara/status/tweet-3",
    authorName: "Cara",
    authorHandle: "cara",
    text: "A stable source thread.",
    createdAtOnX: "2026-03-15T00:00:00.000Z",
    savedAt: "2026-03-15T00:01:00.000Z",
    rawPayload: {},
    sourceKind: "x-bookmark" as const
  }

  await upsertKnowledgeCardDraftsForSourceMaterials([sourceMaterial], {
    generateDraft: async (source) => {
      generatedCount += 1
      return {
        id: `card-${source.tweetId}`,
        sourceMaterialId: source.tweetId,
        status: "draft",
        title: "Stable card",
        theme: "Stable card",
        summary: "Stable card",
        keyExcerpt: "Stable card",
        applicability: "Stable card",
        provenance: [],
        quality: {
          score: 80,
          needsReview: false,
          warnings: [],
          generatorVersion: "test"
        },
        generatedAt: "2026-03-15T01:00:00.000Z",
        updatedAt: "2026-03-15T01:00:00.000Z",
        sourceFingerprint: source.contentFingerprint ?? "",
        lastGeneratedFromModel: "test"
      }
    }
  })

  const result = await upsertKnowledgeCardDraftsForSourceMaterials([sourceMaterial], {
    generateDraft: async (source) => {
      generatedCount += 1
      return {
        id: `card-${source.tweetId}`,
        sourceMaterialId: source.tweetId,
        status: "draft",
        title: "Stable card",
        theme: "Stable card",
        summary: "Stable card",
        keyExcerpt: "Stable card",
        applicability: "Stable card",
        provenance: [],
        quality: {
          score: 80,
          needsReview: false,
          warnings: [],
          generatorVersion: "test"
        },
        generatedAt: "2026-03-15T01:00:00.000Z",
        updatedAt: "2026-03-15T01:00:00.000Z",
        sourceFingerprint: source.contentFingerprint ?? "",
        lastGeneratedFromModel: "test"
      }
    }
  })

  assert.equal(generatedCount, 1)
  assert.equal(result.skippedCount, 1)
})

test("reviewed cards keep manual edits when the source material changes, but quality metadata refreshes", async () => {
  await resetBookmarksDb()

  await upsertKnowledgeCardDraftsForSourceMaterials([
    {
      tweetId: "tweet-4",
      tweetUrl: "https://x.com/dan/status/tweet-4",
      authorName: "Dan",
      authorHandle: "dan",
      text: "Original source text.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    }
  ])

  await updateKnowledgeCardDraft("card-tweet-4", {
    title: "Manually reviewed card",
    theme: "Manually reviewed card",
    summary: "Manual summary",
    keyExcerpt: "Manual excerpt",
    applicability: "Manual applicability"
  })

  await upsertKnowledgeCardDraftsForSourceMaterials(
    [
      {
        tweetId: "tweet-4",
        tweetUrl: "https://x.com/dan/status/tweet-4",
        authorName: "Dan",
        authorHandle: "dan",
        text: "Original source text with updated context.",
        createdAtOnX: "2026-03-15T00:00:00.000Z",
        savedAt: "2026-03-15T00:01:00.000Z",
        rawPayload: {},
        sourceKind: "x-bookmark"
      }
    ],
    {
      generateDraft: async (source) => ({
        id: `card-${source.tweetId}`,
        sourceMaterialId: source.tweetId,
        status: "draft",
        title: "Generated title",
        theme: "Generated theme",
        summary: "Generated summary",
        keyExcerpt: "Generated excerpt",
        applicability: "Generated applicability",
        provenance: [{ field: "summary", excerpt: "updated context" }],
        quality: {
          score: 61,
          needsReview: true,
          warnings: ["Source changed significantly."],
          generatorVersion: "test-v2"
        },
        generatedAt: "2026-03-15T02:00:00.000Z",
        updatedAt: "2026-03-15T02:00:00.000Z",
        sourceFingerprint: source.contentFingerprint ?? "",
        lastGeneratedFromModel: "test-v2"
      })
    }
  )

  const cards = await getAllKnowledgeCardDrafts()

  assert.equal(cards[0].status, "reviewed")
  assert.equal(cards[0].title, "Manually reviewed card")
  assert.equal(cards[0].summary, "Manual summary")
  assert.equal(cards[0].quality.needsReview, true)
  assert.equal(cards[0].quality.warnings[0], "Source changed significantly.")
})

test("regenerateKnowledgeCardDraft resets a reviewed card back to draft with regenerated content", async () => {
  await resetBookmarksDb()

  await upsertKnowledgeCardDraftsForSourceMaterials([
    {
      tweetId: "tweet-5",
      tweetUrl: "https://x.com/emma/status/tweet-5",
      authorName: "Emma",
      authorHandle: "emma",
      text: "First source text.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    }
  ])

  await updateKnowledgeCardDraft("card-tweet-5", {
    title: "Manual title",
    theme: "Manual theme",
    summary: "Manual summary",
    keyExcerpt: "Manual excerpt",
    applicability: "Manual applicability"
  })

  const regenerated = await regenerateKnowledgeCardDraft(
    {
      tweetId: "tweet-5",
      tweetUrl: "https://x.com/emma/status/tweet-5",
      authorName: "Emma",
      authorHandle: "emma",
      text: "Updated source text.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    },
    {
      generateDraft: async (source) => ({
        id: `card-${source.tweetId}`,
        sourceMaterialId: source.tweetId,
        status: "draft",
        title: "Regenerated title",
        theme: "Regenerated theme",
        summary: "Regenerated summary",
        keyExcerpt: "Regenerated excerpt",
        applicability: "Regenerated applicability",
        provenance: [],
        quality: {
          score: 88,
          needsReview: false,
          warnings: [],
          generatorVersion: "regenerated"
        },
        generatedAt: "2026-03-15T02:00:00.000Z",
        updatedAt: "2026-03-15T02:00:00.000Z",
        sourceFingerprint: source.contentFingerprint ?? "",
        lastGeneratedFromModel: "regenerated"
      })
    }
  )

  assert.equal(regenerated.status, "draft")
  assert.equal(regenerated.title, "Regenerated title")
  assert.equal(regenerated.summary, "Regenerated summary")
})

test("upsertKnowledgeCardDraftsForSourceMaterials persists async generated drafts outside the write transaction", async () => {
  await resetBookmarksDb()

  const sourceMaterial = {
    tweetId: "tweet-6",
    tweetUrl: "https://x.com/faye/status/tweet-6",
    authorName: "Faye",
    authorHandle: "faye",
    text: "Async generated source text.",
    createdAtOnX: "2026-03-15T00:00:00.000Z",
    savedAt: "2026-03-15T00:01:00.000Z",
    rawPayload: {},
    sourceKind: "x-bookmark" as const
  }

  const result = await upsertKnowledgeCardDraftsForSourceMaterials([sourceMaterial], {
    generateDraft: async (source) => {
      await new Promise((resolve) => setTimeout(resolve, 0))

      return {
        id: `card-${source.tweetId}`,
        sourceMaterialId: source.tweetId,
        status: "draft",
        title: "Async title",
        theme: "Async title",
        summary: "Async summary",
        keyExcerpt: "Async excerpt",
        applicability: "Async applicability",
        provenance: [],
        quality: {
          score: 84,
          needsReview: false,
          warnings: [],
          generatorVersion: "async-test"
        },
        generatedAt: "2026-03-15T03:00:00.000Z",
        updatedAt: "2026-03-15T03:00:00.000Z",
        sourceFingerprint: source.contentFingerprint ?? "",
        lastGeneratedFromModel: "async-test"
      }
    }
  })

  const cards = await getAllKnowledgeCardDrafts()

  assert.equal(result.createdCount, 1)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].title, "Async title")
})

test("regenerateKnowledgeCardDraft supports async generators without holding the write transaction open", async () => {
  await resetBookmarksDb()

  await upsertKnowledgeCardDraftsForSourceMaterials([
    {
      tweetId: "tweet-7",
      tweetUrl: "https://x.com/gia/status/tweet-7",
      authorName: "Gia",
      authorHandle: "gia",
      text: "Original source text for async regeneration.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    }
  ])

  const regenerated = await regenerateKnowledgeCardDraft(
    {
      tweetId: "tweet-7",
      tweetUrl: "https://x.com/gia/status/tweet-7",
      authorName: "Gia",
      authorHandle: "gia",
      text: "Updated async source text.",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T00:01:00.000Z",
      rawPayload: {},
      sourceKind: "x-bookmark"
    },
    {
      generateDraft: async (source) => {
        await new Promise((resolve) => setTimeout(resolve, 0))

        return {
          id: `card-${source.tweetId}`,
          sourceMaterialId: source.tweetId,
          status: "draft",
          title: "Async regenerated title",
          theme: "Async regenerated theme",
          summary: "Async regenerated summary",
          keyExcerpt: "Async regenerated excerpt",
          applicability: "Async regenerated applicability",
          provenance: [],
          quality: {
            score: 88,
            needsReview: false,
            warnings: [],
            generatorVersion: "async-regenerated"
          },
          generatedAt: "2026-03-15T04:00:00.000Z",
          updatedAt: "2026-03-15T04:00:00.000Z",
          sourceFingerprint: source.contentFingerprint ?? "",
          lastGeneratedFromModel: "async-regenerated"
        }
      }
    }
  )

  assert.equal(regenerated.title, "Async regenerated title")
  assert.equal(regenerated.status, "draft")
})
