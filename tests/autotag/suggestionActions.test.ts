import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import {
  acceptTagSuggestion,
  acceptTagSuggestionsBulk,
  rejectTagSuggestion
} from "../../src/lib/autotag/suggestionActions.ts"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import {
  createTagSuggestion,
  getAllTagSuggestions,
  insertNewTagSuggestions
} from "../../src/lib/storage/suggestionsStore.ts"
import { createTag, getAllBookmarkTags, getAllTags } from "../../src/lib/storage/tagsStore.ts"

async function seedSuggestion(bookmarkId: string, tagName: string) {
  const suggestion = createTagSuggestion({ bookmarkId, tagName, source: "hashtag", confidence: 0.9 })
  assert.ok(suggestion)
  await insertNewTagSuggestions([suggestion])
  return suggestion
}

test("acceptTagSuggestion reuses an existing tag case-insensitively", async () => {
  await resetBookmarksDb()

  const existingTag = await createTag({ name: "AI" })
  const suggestion = await seedSuggestion("t1", "ai")

  const accepted = await acceptTagSuggestion(suggestion.id)

  assert.equal(accepted?.status, "accepted")
  assert.equal((await getAllTags()).length, 1)
  assert.deepEqual(
    (await getAllBookmarkTags()).map((bookmarkTag) => [bookmarkTag.bookmarkId, bookmarkTag.tagId]),
    [["t1", existingTag.id]]
  )
})

test("acceptTagSuggestion creates the tag when it does not exist", async () => {
  await resetBookmarksDb()

  const suggestion = await seedSuggestion("t1", "Rust")
  await acceptTagSuggestion(suggestion.id)

  const tags = await getAllTags()
  assert.equal(tags.length, 1)
  assert.equal(tags[0]?.name, "Rust")
  assert.equal((await getAllBookmarkTags()).length, 1)
})

test("rejectTagSuggestion keeps the record as a negative cache", async () => {
  await resetBookmarksDb()

  const suggestion = await seedSuggestion("t1", "AI")
  const rejected = await rejectTagSuggestion(suggestion.id)

  assert.equal(rejected?.status, "rejected")
  assert.equal((await getAllBookmarkTags()).length, 0)
  assert.equal((await getAllTagSuggestions()).length, 1)
})

test("acceptTagSuggestionsBulk accepts every resolvable suggestion once", async () => {
  await resetBookmarksDb()

  const first = await seedSuggestion("t1", "AI")
  const second = await seedSuggestion("t2", "ai")
  const third = await seedSuggestion("t3", "Rust")

  const result = await acceptTagSuggestionsBulk([first.id, second.id, third.id, "missing::tag"])

  assert.equal(result.acceptedCount, 3)
  // "AI" is shared between t1 and t2; only two distinct tags exist.
  assert.equal((await getAllTags()).length, 2)
  assert.equal((await getAllBookmarkTags()).length, 3)
})
