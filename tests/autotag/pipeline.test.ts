import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import type { AutoTagLlmProvider } from "../../src/lib/autotag/llmProvider.ts"
import { resolveNewTagBudget, runAutoTagPipeline } from "../../src/lib/autotag/pipeline.ts"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { saveSecrets } from "../../src/lib/storage/secrets.ts"
import { createDefaultAutoTagSettings, getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { getAllTagSuggestions } from "../../src/lib/storage/suggestionsStore.ts"
import { attachTagToBookmark, createTag } from "../../src/lib/storage/tagsStore.ts"
import type { BookmarkRecord } from "../../src/lib/types.ts"

function installChromeStorageMock() {
  let stored: Record<string, unknown> = {}

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: stored[key] }),
        set: async (value: Record<string, unknown>) => {
          stored = { ...stored, ...value }
        }
      }
    }
  }
}

function makeBookmark(tweetId: string, overrides: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    tweetId,
    tweetUrl: `https://x.com/alice/status/${tweetId}`,
    authorName: "Alice",
    authorHandle: "alice",
    text: "hello",
    createdAtOnX: "2026-01-01T00:00:00.000Z",
    savedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

async function enableAutoTag() {
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    hashtagBackfillDone: true,
    autoTag: { ...createDefaultAutoTagSettings(), enabled: true }
  })
}

test("runAutoTagPipeline is a no-op when auto-tagging is disabled", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const result = await runAutoTagPipeline()

  assert.deepEqual(result, {
    ran: false,
    outcome: "disabled",
    suggestedCount: 0,
    llmProcessedCount: 0,
    skippedCount: 0,
    candidateCount: 0,
    llmBatchCount: 0,
    llmFailedBatchCount: 0,
    newTagBudget: 0,
    vocabularySize: 0,
    blockedTagKeyCount: 0,
    blockedDroppedCount: 0
  })
  assert.equal((await getAllTagSuggestions()).length, 0)
})

test("runAutoTagPipeline persists heuristic suggestions and is idempotent", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTag()
  // An existing tag with the same name lifts the hashtag over the frequency threshold.
  await createTag({ name: "AI" })
  await upsertBookmarks([makeBookmark("t1", { hashtags: ["AI"] }), makeBookmark("t2")])

  const firstRun = await runAutoTagPipeline()

  assert.equal(firstRun.ran, true)
  assert.equal(firstRun.suggestedCount, 1)

  const suggestions = await getAllTagSuggestions()
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0]?.tagName, "AI")
  assert.equal(suggestions[0]?.status, "pending")

  const secondRun = await runAutoTagPipeline()
  assert.equal(secondRun.suggestedCount, 0)
  assert.equal((await getAllTagSuggestions()).length, 1)
})

test("runAutoTagPipeline backfills hashtags before running heuristics", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const settings = await getSettings()
  await saveSettings({
    ...settings,
    hashtagBackfillDone: false,
    autoTag: { ...createDefaultAutoTagSettings(), enabled: true }
  })
  await upsertBookmarks([makeBookmark("t1")])

  await runAutoTagPipeline()

  const [bookmark] = await getAllBookmarks()
  assert.deepEqual(bookmark?.hashtags, [])
  assert.equal((await getSettings()).hashtagBackfillDone, true)
})

async function enableAutoTagWithLlm(overrides: Partial<ReturnType<typeof createDefaultAutoTagSettings>["llm"]> = {}) {
  const settings = await getSettings()
  const defaults = createDefaultAutoTagSettings()
  await saveSettings({
    ...settings,
    hashtagBackfillDone: true,
    autoTag: {
      ...defaults,
      enabled: true,
      llm: { ...defaults.llm, enabled: true, batchSize: 2, ...overrides }
    }
  })
}

function makeStubProvider(responses: Array<Array<{ tweetId: string; tags: Array<{ name: string; confidence: number }> }>>) {
  const calls: Array<{
    tweetIds: string[]
    vocabulary: Array<{ name: string; count: number }>
    allowNewTags: boolean
    newTagBudget?: number
  }> = []
  const provider: AutoTagLlmProvider = {
    async suggestTags(input) {
      calls.push({
        tweetIds: input.bookmarks.map((bookmark) => bookmark.tweetId),
        vocabulary: input.vocabulary.map((entry) => ({ ...entry })),
        allowNewTags: input.allowNewTags,
        newTagBudget: input.newTagBudget
      })
      return responses[calls.length - 1] ?? []
    }
  }
  return { provider, calls }
}

test("runAutoTagPipeline skips the LLM step when no API key is stored", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm()
  await upsertBookmarks([makeBookmark("t1")])

  const { provider, calls } = makeStubProvider([])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(calls.length, 0)
  assert.equal(result.llmProcessedCount, 0)
})

test("runAutoTagPipeline sends untagged bookmarks to the LLM and persists suggestions", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "closed" })
  await saveSecrets({ llmApiKey: "sk-test" })

  const tag = await createTag({ name: "AI" })
  await upsertBookmarks([
    makeBookmark("tagged"),
    makeBookmark("t1"),
    makeBookmark("t2"),
    makeBookmark("t3")
  ])
  await attachTagToBookmark({ bookmarkId: "tagged", tagId: tag.id })

  const { provider, calls } = makeStubProvider([
    [{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.8 }] }],
    [{ tweetId: "t3", tags: [{ name: "AI", confidence: 0.7 }] }]
  ])

  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0]?.tweetIds, ["t1", "t2"])
  assert.deepEqual(calls[1]?.tweetIds, ["t3"])
  assert.deepEqual(calls[0]?.vocabulary, [{ name: "AI", count: 1 }])
  assert.equal(calls[0]?.allowNewTags, false)
  assert.equal(result.llmProcessedCount, 3)

  const suggestions = await getAllTagSuggestions()
  const llmSuggestions = suggestions.filter((suggestion) => suggestion.source === "llm")
  assert.equal(llmSuggestions.length, 2)
  assert.ok(llmSuggestions.every((suggestion) => suggestion.status === "pending"))
})

test("runAutoTagPipeline still sends rule-covered bookmarks to the LLM, but last", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "closed" })
  await saveSecrets({ llmApiKey: "sk-test" })
  await createTag({ name: "News" })
  // "AI" already exists as a tag, so the hashtag clears the frequency threshold.
  await createTag({ name: "AI" })
  await upsertBookmarks([makeBookmark("t1", { hashtags: ["AI"] }), makeBookmark("t2")])

  const { provider, calls } = makeStubProvider([[{ tweetId: "t2", tags: [{ name: "News", confidence: 0.6 }] }]])
  await runAutoTagPipeline({ createLlmProvider: () => provider })

  // t1 got a pending hashtag suggestion from heuristics. It stays eligible for
  // the LLM (rules must not starve it) but is queued behind untouched t2.
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0]?.tweetIds, ["t2", "t1"])
})

test("runAutoTagPipeline honors the open vocabulary mode", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "open" })
  await saveSecrets({ llmApiKey: "sk-test" })
  await upsertBookmarks([makeBookmark("t1")])

  const { provider, calls } = makeStubProvider([[{ tweetId: "t1", tags: [{ name: "Fresh", confidence: 0.9 }] }]])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(calls[0]?.allowNewTags, true)
  assert.equal(result.suggestedCount, 1)
})

test("guarded mode accumulates the vocabulary across batches and caps new tags", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "guarded", batchSize: 1 })
  await saveSecrets({ llmApiKey: "sk-test" })
  await upsertBookmarks([makeBookmark("t1"), makeBookmark("t2")])

  const { provider, calls } = makeStubProvider([
    [{ tweetId: "t1", tags: [{ name: "ai agents", confidence: 0.9 }] }],
    [{ tweetId: "t2", tags: [{ name: "AI Agent", confidence: 0.8 }] }]
  ])

  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  // Batch 1 introduces the tag, batch 2 sees it in the vocabulary.
  assert.deepEqual(calls[0]?.vocabulary, [])
  assert.deepEqual(calls[1]?.vocabulary, [{ name: "ai agents", count: 1 }])
  assert.equal(calls[0]?.newTagBudget, 1)

  const suggestions = (await getAllTagSuggestions()).filter((suggestion) => suggestion.source === "llm")
  // "AI Agent" collapses onto the spelling already introduced in batch 1.
  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.tagName).sort(),
    ["ai agents", "ai agents"]
  )
  assert.equal(result.suggestedCount, 2)
})

test("guarded mode stops inventing tags once the budget is spent", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "guarded", batchSize: 10 })
  await saveSecrets({ llmApiKey: "sk-test" })
  await upsertBookmarks([makeBookmark("t1"), makeBookmark("t2"), makeBookmark("t3"), makeBookmark("t4")])

  const { provider } = makeStubProvider([
    [
      { tweetId: "t1", tags: [{ name: "one", confidence: 0.9 }] },
      { tweetId: "t2", tags: [{ name: "two", confidence: 0.9 }] },
      { tweetId: "t3", tags: [{ name: "three", confidence: 0.9 }] },
      { tweetId: "t4", tags: [{ name: "four", confidence: 0.9 }] }
    ]
  ])

  await runAutoTagPipeline({ createLlmProvider: () => provider })

  const suggestions = (await getAllTagSuggestions()).filter((suggestion) => suggestion.source === "llm")
  // Budget floor is 1 new tag per run, so every later invention is dropped.
  assert.deepEqual(suggestions.map((suggestion) => suggestion.tagName).sort(), ["one"])
})

test("resolveNewTagBudget scales with the run and stops at the healthy library size", () => {
  assert.equal(resolveNewTagBudget("open", 10, 0), Number.POSITIVE_INFINITY)
  assert.equal(resolveNewTagBudget("closed", 10_000, 0), 0)
  // Floor of 1 for a small run, ~1 per 150 candidates above that.
  assert.equal(resolveNewTagBudget("guarded", 10, 0), 1)
  assert.equal(resolveNewTagBudget("guarded", 450, 0), 3)
  // Only the headroom left before the healthy ceiling is spendable.
  assert.equal(resolveNewTagBudget("guarded", 450, 48), 2)
  assert.equal(resolveNewTagBudget("guarded", 450, 50), 0)
  assert.equal(resolveNewTagBudget("guarded", 450, 900), 0)
})

test("blocked tag keys are never suggested again", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "open" })
  const settings = await getSettings()
  await saveSettings({ ...settings, autoTag: { ...settings.autoTag, blockedTagKeys: ["aiagent"] } })
  await saveSecrets({ llmApiKey: "sk-test" })
  await upsertBookmarks([makeBookmark("t1")])

  const { provider } = makeStubProvider([[{ tweetId: "t1", tags: [{ name: "AI Agents", confidence: 0.9 }] }]])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(result.suggestedCount, 0)
  assert.equal((await getAllTagSuggestions()).length, 0)
})

test("a run whose every suggestion is blocked reports all-blocked, not ok", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "open" })
  const settings = await getSettings()
  await saveSettings({
    ...settings,
    autoTag: { ...settings.autoTag, blockedTagKeys: ["ai", "design"] }
  })
  await saveSecrets({ llmApiKey: "sk-test" })
  await upsertBookmarks([makeBookmark("t1")])

  const { provider } = makeStubProvider([
    [{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.9 }, { name: "Design", confidence: 0.8 }] }]
  ])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  // Reporting this as "ok, 0 suggestions" is what made a poisoned block list
  // look like a broken feature.
  assert.equal(result.outcome, "all-blocked")
  assert.equal(result.blockedDroppedCount, 2)
  assert.equal(result.suggestedCount, 0)
  const stored = await getSettings()
  assert.equal(stored.lastAutoTagRun?.outcome, "all-blocked")
  assert.equal(stored.lastAutoTagRun?.blockedDroppedCount, 2)
})

test("a failing batch is isolated and reported, earlier batches stay persisted", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "closed", batchSize: 1 })
  await saveSecrets({ llmApiKey: "sk-test" })
  await createTag({ name: "News" })
  await upsertBookmarks([makeBookmark("t1"), makeBookmark("t2")])

  let calls = 0
  const provider: AutoTagLlmProvider = {
    async suggestTags(input) {
      calls += 1
      if (calls === 2) {
        throw new Error("HTTP 500")
      }
      return input.bookmarks.map((bookmark) => ({
        tweetId: bookmark.tweetId,
        tags: [{ name: "News", confidence: 0.7 }]
      }))
    }
  }

  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(calls, 2)
  assert.equal(result.llmBatchCount, 2)
  assert.equal(result.llmFailedBatchCount, 1)
  assert.equal(result.outcome, "ok")
  assert.equal((await getAllTagSuggestions()).filter((item) => item.source === "llm").length, 1)
})

test("rule suggestions never starve the LLM step and the run is reported", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "closed", batchSize: 5 })
  await saveSecrets({ llmApiKey: "sk-test" })
  await createTag({ name: "AI" })
  await upsertBookmarks([
    makeBookmark("t1", { hashtags: ["AI"] }),
    makeBookmark("t2", { hashtags: ["AI"] }),
    makeBookmark("t3", { hashtags: ["AI"] })
  ])

  const { provider, calls } = makeStubProvider([[]])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  // Every bookmark got a hashtag suggestion, yet the LLM still receives them.
  assert.equal(calls.length, 1)
  assert.equal(result.candidateCount, 3)
  assert.equal(result.outcome, "ok")

  const summary = (await getSettings()).lastAutoTagRun
  assert.equal(summary?.outcome, "ok")
  assert.equal(summary?.candidateCount, 3)
  assert.equal(summary?.pendingCount, 3)
  assert.ok(summary?.finishedAt)
})

test("a run without an api key is reported as missing-api-key", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm()
  await upsertBookmarks([makeBookmark("t1")])

  const result = await runAutoTagPipeline()

  assert.equal(result.outcome, "missing-api-key")
  assert.equal((await getSettings()).lastAutoTagRun?.outcome, "missing-api-key")
})

// Regression: an empty tag library plus "existing tags only" left the LLM with
// nothing to pick from, so the step returned before issuing a request and the
// run was still reported as a successful "0 suggestions" pass.
test("closed vocabulary with an empty tag library reports empty-vocabulary instead of ok", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "closed" })
  await saveSecrets({ llmApiKey: "sk-test" })
  await upsertBookmarks([makeBookmark("t1"), makeBookmark("t2")])

  const { provider, calls } = makeStubProvider([])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(calls.length, 0)
  assert.equal(result.outcome, "empty-vocabulary")
  assert.equal(result.candidateCount, 2)
  assert.equal((await getSettings()).lastAutoTagRun?.outcome, "empty-vocabulary")
})

test("closed vocabulary runs normally once the library has a tag", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTagWithLlm({ tagVocabularyMode: "closed" })
  await saveSecrets({ llmApiKey: "sk-test" })
  await createTag({ name: "AI" })
  await upsertBookmarks([makeBookmark("t1")])

  const { provider, calls } = makeStubProvider([[{ tweetId: "t1", tags: [{ name: "AI", confidence: 0.8 }] }]])
  const result = await runAutoTagPipeline({ createLlmProvider: () => provider })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.allowNewTags, false)
  assert.equal(result.outcome, "ok")
  assert.equal(result.suggestedCount, 1)
})
