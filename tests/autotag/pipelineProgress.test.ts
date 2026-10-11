import test from "node:test"
import assert from "node:assert/strict"
import { runLlmSuggestionStep } from "../../src/lib/autotag/pipeline.ts"
import type { AutoTagProgress } from "../../src/lib/runtime/autotagProgress.ts"
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

// The persisted run state is refreshed from these events. A batch is a single
// request that may take a minute plus a backoff, so an update only at batch end
// left the UI with nothing to show for that whole window — indistinguishable from
// a wedged run, and invisible entirely after a refresh.
test("progress is reported at batch start as well as batch end", async () => {
  const events: AutoTagProgress[] = []

  await runLlmSuggestionStep({
    bookmarks: [makeBookmark("t1"), makeBookmark("t2"), makeBookmark("t3")],
    taggedBookmarkIds: new Set(),
    llmAnalyzedBookmarkIds: new Set(),
    vocabulary: [],
    allowNewTags: true,
    batchSize: 2,
    maxBookmarksPerRun: 10,
    provider: { suggestTags: async () => [] },
    onProgress: (progress) => events.push(progress)
  })

  // Batch one starts before anything is processed...
  assert.ok(
    events.some((event) => event.inFlight === true && event.processed === 0),
    "the first batch must announce itself before it completes"
  )
  // ...finishes...
  assert.ok(
    events.some((event) => event.inFlight === false && event.processed === 2),
    "the end of the first batch must clear the in-flight marker"
  )
  // ...and the second batch starts with the first batch already counted.
  assert.ok(
    events.some((event) => event.inFlight === true && event.processed === 2),
    "a later batch must announce itself with the running count"
  )
})

test("a provider backoff is surfaced as a waiting state", async () => {
  const events: AutoTagProgress[] = []

  await runLlmSuggestionStep({
    bookmarks: [makeBookmark("t1")],
    taggedBookmarkIds: new Set(),
    llmAnalyzedBookmarkIds: new Set(),
    vocabulary: [],
    allowNewTags: true,
    batchSize: 1,
    maxBookmarksPerRun: 10,
    provider: {
      suggestTags: async (input) => {
        // Stand in for the transport telling the run it was rate limited.
        input.onWait?.({ waitMs: 2_000, reason: "rate-limit" })
        return []
      }
    },
    onProgress: (progress) => events.push(progress)
  })

  const waiting = events.find((event) => event.status === "waiting")
  assert.ok(waiting, "a rate limit must be published as waiting")
  assert.ok((waiting?.waitingUntilMs ?? 0) > Date.now() - 1_000)
  assert.equal(waiting?.waitingReason, "rate-limit")
})
