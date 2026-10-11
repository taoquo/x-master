import test from "node:test"
import assert from "node:assert/strict"
import { runLlmSuggestionStep } from "../../src/lib/autotag/pipeline.ts"
import type { LlmStepInput } from "../../src/lib/autotag/pipeline.ts"
import { LlmError } from "../../src/lib/llm/errors.ts"
import type { LlmTagSuggestion } from "../../src/lib/autotag/llmProvider.ts"
import type { BookmarkRecord } from "../../src/lib/types.ts"

function makeBookmark(tweetId: string): BookmarkRecord {
  return {
    tweetId,
    tweetUrl: `https://x.com/alice/status/${tweetId}`,
    authorName: "Alice",
    authorHandle: "alice",
    text: "hello",
    createdAtOnX: "2026-01-01T00:00:00.000Z",
    savedAt: "2026-01-01T00:00:00.000Z"
  }
}

interface ProviderBehavior {
  inFlight?: { current: number; max: number }
  fail?: (batchIndex: number) => unknown
  delayMs?: number
}

function makeStepInput(
  bookmarkCount: number,
  batchSize: number,
  behavior: ProviderBehavior = {}
): { input: LlmStepInput; getCallCount: () => number } {
  const bookmarks = Array.from({ length: bookmarkCount }, (_, index) => makeBookmark(`t${index + 1}`))
  let callIndex = 0

  const input: LlmStepInput = {
      bookmarks,
      taggedBookmarkIds: new Set<string>(),
      llmAnalyzedBookmarkIds: new Set<string>(),
      vocabulary: [],
      allowNewTags: true,
      batchSize,
      concurrency: 3,
      maxBookmarksPerRun: bookmarkCount,
      provider: {
        suggestTags: async ({ bookmarks: batch }: { bookmarks: Array<{ tweetId: string }> }) => {
          const index = callIndex
          callIndex += 1

          if (behavior.inFlight) {
            behavior.inFlight.current += 1
            behavior.inFlight.max = Math.max(behavior.inFlight.max, behavior.inFlight.current)
          }

          try {
            if (behavior.delayMs) {
              await new Promise((resolve) => setTimeout(resolve, behavior.delayMs))
            }

            if (behavior.fail) {
              const failure = behavior.fail(index)
              if (failure) {
                throw failure
              }
            }

            return batch.map((bookmark) => ({
              tweetId: bookmark.tweetId,
              tags: [{ name: "ai", confidence: 0.8 }]
            })) satisfies LlmTagSuggestion[]
          } finally {
            if (behavior.inFlight) {
              behavior.inFlight.current -= 1
            }
          }
        }
      }
  }

  return { input, getCallCount: () => callIndex }
}

// The unit of parallelism is the batch, never the bookmark: the instruction block and
// the vocabulary are a fixed prefix, so merging tweets into a request is what makes the
// per-request overhead worth paying at all.
test("batches in a wave are issued concurrently", async () => {
  const inFlight = { current: 0, max: 0 }
  const { input, getCallCount } = makeStepInput(12, 2, { inFlight, delayMs: 20 })

  const result = await runLlmSuggestionStep(input)

  assert.equal(getCallCount(), 6, "twelve bookmarks in batches of two is six requests")
  assert.equal(inFlight.max, 3, "three batches should overlap")
  assert.equal(result.processedCount, 12)
  assert.equal(result.batchCount, 6)
})

test("concurrency 1 keeps runs strictly serial", async () => {
  const inFlight = { current: 0, max: 0 }
  const { input } = makeStepInput(6, 2, { inFlight, delayMs: 5 })
  input.concurrency = 1

  await runLlmSuggestionStep(input)

  assert.equal(inFlight.max, 1)
})

test("one failing batch does not lose the rest of its wave", async () => {
  // The second request fails; the first and third still have to land.
  const { input } = makeStepInput(6, 2, {
    fail: (index) => (index === 1 ? new LlmError("server", "HTTP 500") : undefined)
  })

  const result = await runLlmSuggestionStep(input)

  assert.equal(result.batchCount, 3)
  assert.equal(result.failedBatchCount, 1)
  assert.equal(result.processedCount, 4, "the two healthy batches still counted")
  assert.equal(result.suggestions.length, 4)
})

test("a rate limit shrinks the wave for the rest of the run", async () => {
  const inFlight = { current: 0, max: 0 }
  // Fail the first wave with a rate limit, then behave normally.
  const { input } = makeStepInput(18, 2, {
    inFlight,
    delayMs: 5,
    fail: (index) => (index < 3 ? new LlmError("rate-limit", "HTTP 429") : undefined)
  })

  // The pipeline announces exactly one in-flight event per wave, so counting them
  // makes the number of WAVES observable — batchCount alone cannot tell 3+3+3 from
  // 3+1+1+1+1+1+1.
  let waves = 0
  input.onProgress = (progress) => {
    if (progress.inFlight) {
      waves += 1
    }
  }

  const result = await runLlmSuggestionStep(input)

  assert.equal(inFlight.max, 3, "the first wave overlaps three batches")
  assert.equal(result.batchCount, 9)
  assert.equal(result.failedBatchCount, 3)
  // One overlapping wave, then the remaining six batches one at a time: 7 waves. With
  // no shrink it would be 3 waves of 3, and advancing by the shrunk step instead of the
  // issued wave would re-send batches and raise both the wave and batch counts.
  assert.equal(waves, 7)
})

test("a deadline stops the run at a wave boundary and reports what is left", async () => {
  let clock = 0
  const { input } = makeStepInput(12, 2, { delayMs: 1 })
  input.now = () => clock
  input.budgetMs = 5
  input.batchBudgetMs = 5
  // Every wave advances the clock past the budget.
  const originalProvider = input.provider
  input.provider = {
    suggestTags: async (payload) => {
      clock += 10
      return originalProvider.suggestTags(payload)
    }
  }

  const result = await runLlmSuggestionStep(input)

  assert.equal(result.stoppedReason, "deadline")
  assert.ok(result.unprocessedCount > 0)
})

test("a cancel stops the run at a wave boundary", async () => {
  let waves = 0
  const { input } = makeStepInput(12, 2)
  input.shouldCancel = async () => {
    waves += 1
    return waves > 1
  }

  const result = await runLlmSuggestionStep(input)

  assert.equal(result.stoppedReason, "cancelled")
  assert.equal(result.batchCount, 3, "the first wave completes before the cancel is seen")
})
