import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { runAutoTagPipeline } from "../../src/lib/autotag/pipeline.ts"
import { getAllBookmarks, upsertBookmarks } from "../../src/lib/storage/bookmarksStore.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { createDefaultAutoTagSettings, getSettings, saveSettings } from "../../src/lib/storage/settings.ts"
import { getAllTagSuggestions } from "../../src/lib/storage/suggestionsStore.ts"
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

  assert.deepEqual(result, { ran: false, suggestedCount: 0, llmProcessedCount: 0, skippedCount: 0 })
  assert.equal((await getAllTagSuggestions()).length, 0)
})

test("runAutoTagPipeline persists heuristic suggestions and is idempotent", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()
  await enableAutoTag()
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
