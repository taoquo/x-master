import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { getAllBookmarks, removeBookmarkSnapshot, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import {
  clearLlmAnalysis,
  createLlmAnalysisRecord,
  getAllLlmAnalysis,
  hashAnalyzedContent,
  isAnalysisReusable,
  LLM_PROMPT_VERSION,
  putLlmAnalysisRecords,
  removeLlmAnalysisForBookmark
} from "../../src/lib/storage/llmAnalysisStore.ts"
import type { BookmarkRecord } from "../../src/lib/types.ts"

function makeBookmark(tweetId: string, text = "hello"): BookmarkRecord {
  return {
    tweetId,
    tweetUrl: `https://x.com/alice/status/${tweetId}`,
    authorName: "Alice",
    authorHandle: "alice",
    text,
    createdAtOnX: "2026-01-01T00:00:00.000Z",
    savedAt: "2026-01-01T00:00:00.000Z"
  }
}

test("hashAnalyzedContent is stable per text and differs across texts", () => {
  assert.equal(hashAnalyzedContent("hello"), hashAnalyzedContent("hello"))
  assert.notEqual(hashAnalyzedContent("hello"), hashAnalyzedContent("hello "))
  assert.notEqual(hashAnalyzedContent("hello"), hashAnalyzedContent("world"))
  // Empty text still hashes, so a bookmark with no text is recorded like any
  // other instead of being re-analyzed forever.
  assert.equal(typeof hashAnalyzedContent(""), "string")
})

test("isAnalysisReusable rejects a verdict whose question changed", () => {
  const record = createLlmAnalysisRecord({
    bookmarkId: "t1",
    model: "gpt-4o-mini",
    contentHash: hashAnalyzedContent("hello"),
    outcome: "no-topic",
    tagCount: 0
  })

  const expected = { model: "gpt-4o-mini", contentHash: hashAnalyzedContent("hello") }

  assert.equal(isAnalysisReusable(record, expected), true)
  assert.equal(isAnalysisReusable(undefined, expected), false)
  assert.equal(isAnalysisReusable(record, { ...expected, model: "other-model" }), false)
  assert.equal(isAnalysisReusable(record, { ...expected, contentHash: hashAnalyzedContent("edited") }), false)
  assert.equal(isAnalysisReusable(record, { ...expected, promptVersion: LLM_PROMPT_VERSION + 1 }), false)
})

test("putLlmAnalysisRecords upserts by bookmark id", async () => {
  await resetBookmarksDb()

  await putLlmAnalysisRecords([
    createLlmAnalysisRecord({
      bookmarkId: "t1",
      model: "m",
      contentHash: "h1",
      outcome: "no-topic",
      tagCount: 0
    })
  ])
  await putLlmAnalysisRecords([
    createLlmAnalysisRecord({
      bookmarkId: "t1",
      model: "m",
      contentHash: "h2",
      outcome: "tagged",
      tagCount: 2
    })
  ])

  const records = await getAllLlmAnalysis()
  assert.equal(records.length, 1)
  assert.equal(records[0]?.contentHash, "h2")
  assert.equal(records[0]?.outcome, "tagged")
  assert.equal(records[0]?.tagCount, 2)

  assert.deepEqual(await putLlmAnalysisRecords([]), { writtenCount: 0 })
})

// A ledger row left behind after the bookmark is gone would claim a re-added
// bookmark was already analyzed and keep it out of the queue for good.
test("removing a bookmark removes its analysis row", async () => {
  await resetBookmarksDb()
  await upsertBookmarks([makeBookmark("t1"), makeBookmark("t2")])
  await putLlmAnalysisRecords([
    createLlmAnalysisRecord({ bookmarkId: "t1", model: "m", contentHash: "h", outcome: "tagged", tagCount: 1 }),
    createLlmAnalysisRecord({ bookmarkId: "t2", model: "m", contentHash: "h", outcome: "tagged", tagCount: 1 })
  ])

  await removeBookmarkSnapshot("t1")

  assert.deepEqual((await getAllBookmarks()).map((bookmark) => bookmark.tweetId), ["t2"])
  assert.deepEqual((await getAllLlmAnalysis()).map((record) => record.bookmarkId), ["t2"])
})

test("removeLlmAnalysisForBookmark and clearLlmAnalysis drop stored verdicts", async () => {
  await resetBookmarksDb()
  await putLlmAnalysisRecords([
    createLlmAnalysisRecord({ bookmarkId: "t1", model: "m", contentHash: "h", outcome: "tagged", tagCount: 1 }),
    createLlmAnalysisRecord({ bookmarkId: "t2", model: "m", contentHash: "h", outcome: "no-topic", tagCount: 0 })
  ])

  await removeLlmAnalysisForBookmark("t1")
  assert.deepEqual((await getAllLlmAnalysis()).map((record) => record.bookmarkId), ["t2"])

  await clearLlmAnalysis()
  assert.deepEqual(await getAllLlmAnalysis(), [])
})
