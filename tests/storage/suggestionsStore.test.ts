import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import {
  createTagSuggestion,
  createTagSuggestionId,
  getAllTagSuggestions,
  insertNewTagSuggestions,
  normalizeSuggestedTagName,
  resolveTagSuggestion
} from "../../src/lib/storage/suggestionsStore.ts"

test("normalizeSuggestedTagName strips hash prefixes and trims whitespace", () => {
  assert.equal(normalizeSuggestedTagName("#AI"), "AI")
  assert.equal(normalizeSuggestedTagName("  ##Machine Learning  "), "Machine Learning")
  assert.equal(normalizeSuggestedTagName("＃全角"), "全角")
  assert.equal(normalizeSuggestedTagName("   "), "")
})

test("createTagSuggestionId is case-insensitive on the tag name", () => {
  assert.equal(createTagSuggestionId("tweet-1", "AI"), "tweet-1::ai")
  assert.equal(createTagSuggestionId("tweet-1", "#ai"), "tweet-1::ai")
})

test("createTagSuggestion returns null for empty names", () => {
  assert.equal(createTagSuggestion({ bookmarkId: "tweet-1", tagName: "  # ", source: "hashtag", confidence: 0.9 }), null)
})

test("insertNewTagSuggestions skips duplicates and resolveTagSuggestion updates status", async () => {
  await resetBookmarksDb()

  const first = createTagSuggestion({ bookmarkId: "tweet-1", tagName: "AI", source: "hashtag", confidence: 0.9 })
  const duplicate = createTagSuggestion({ bookmarkId: "tweet-1", tagName: "#ai", source: "llm", confidence: 0.5 })
  const second = createTagSuggestion({ bookmarkId: "tweet-2", tagName: "Rust", source: "keyword", confidence: 0.7 })

  assert.ok(first && duplicate && second)

  const insertion = await insertNewTagSuggestions([first, duplicate, second])
  assert.equal(insertion.insertedCount, 2)

  const suggestions = await getAllTagSuggestions()
  assert.equal(suggestions.length, 2)
  assert.equal(suggestions.every((suggestion) => suggestion.status === "pending"), true)

  const resolved = await resolveTagSuggestion(first.id, "accepted")
  assert.equal(resolved?.status, "accepted")
  assert.match(String(resolved?.resolvedAt), /^\d{4}-\d{2}-\d{2}T/)

  const reinsertion = await insertNewTagSuggestions([{ ...first, status: "pending" }])
  assert.equal(reinsertion.insertedCount, 0)

  const missing = await resolveTagSuggestion("tweet-404::nope", "rejected")
  assert.equal(missing, null)
})

