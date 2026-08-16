import test from "node:test"
import assert from "node:assert/strict"
import "fake-indexeddb/auto"
import { resetBookmarksDb } from "../../src/lib/storage/db.ts"
import { getSettings } from "../../src/lib/storage/settings.ts"
import {
  createTagSuggestion,
  getAllTagSuggestions,
  insertNewTagSuggestions
} from "../../src/lib/storage/suggestionsStore.ts"
import { createTag, getAllTags } from "../../src/lib/storage/tagsStore.ts"
import { deleteTagPermanently, deleteTagsPermanently, unblockTagKey } from "../../src/lib/tags/tagActions.ts"

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

async function seedSuggestion(bookmarkId: string, tagName: string) {
  const suggestion = createTagSuggestion({ bookmarkId, tagName, source: "hashtag", confidence: 0.9 })
  assert.ok(suggestion)
  await insertNewTagSuggestions([suggestion])
}

test("deleteTagPermanently drops the tag, rejects its suggestions and blocks the key", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const tag = await createTag({ name: "AI Agents" })
  await seedSuggestion("tweet-1", "ai-agent")
  await seedSuggestion("tweet-2", "Rust")

  const result = await deleteTagPermanently({ tagId: tag.id })

  assert.equal(result.blockedTagKey, "aiagent")
  assert.deepEqual(await getAllTags(), [])

  const suggestions = await getAllTagSuggestions()
  const byBookmark = new Map(suggestions.map((suggestion) => [suggestion.bookmarkId, suggestion.status]))
  assert.equal(byBookmark.get("tweet-1"), "rejected")
  assert.equal(byBookmark.get("tweet-2"), "pending")

  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, ["aiagent"])
})

test("deleteTagPermanently is idempotent and tolerates a missing tag", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const tag = await createTag({ name: "LLM" })
  await deleteTagPermanently({ tagId: tag.id, tagName: "LLM" })
  await deleteTagPermanently({ tagId: tag.id, tagName: "llm" })

  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, ["llm"])

  const unknown = await deleteTagPermanently({ tagId: "tag-unknown" })
  assert.equal(unknown.blockedTagKey, null)
  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, ["llm"])
})

test("deleteTagsPermanently blocks every deleted name in a single pass", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const agents = await createTag({ name: "AI Agents" })
  const rust = await createTag({ name: "Rust" })
  const keeper = await createTag({ name: "Design" })
  await seedSuggestion("tweet-1", "ai-agent")
  await seedSuggestion("tweet-2", "rust")
  await seedSuggestion("tweet-3", "design")

  const result = await deleteTagsPermanently([{ tagId: agents.id }, { tagId: rust.id, tagName: "Rust" }])

  assert.deepEqual(result.deletedTagIds.sort(), [agents.id, rust.id].sort())
  assert.deepEqual(result.blockedTagKeys.sort(), ["aiagent", "rust"])
  assert.deepEqual((await getAllTags()).map((tag) => tag.id), [keeper.id])

  const statusByBookmark = new Map(
    (await getAllTagSuggestions()).map((suggestion) => [suggestion.bookmarkId, suggestion.status])
  )
  assert.equal(statusByBookmark.get("tweet-1"), "rejected")
  assert.equal(statusByBookmark.get("tweet-2"), "rejected")
  assert.equal(statusByBookmark.get("tweet-3"), "pending")

  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys.sort(), ["aiagent", "rust"])
})

test("deleteTagsPermanently ignores an empty target list", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const tag = await createTag({ name: "Keep" })
  const result = await deleteTagsPermanently([])

  assert.deepEqual(result, { deletedTagIds: [], blockedTagKeys: [] })
  assert.deepEqual((await getAllTags()).map((item) => item.id), [tag.id])
})

test("unblockTagKey lets a deleted name come back", async () => {
  installChromeStorageMock()
  await resetBookmarksDb()

  const tag = await createTag({ name: "Design Systems" })
  await deleteTagPermanently({ tagId: tag.id })
  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, ["designsystem"])

  await unblockTagKey("design-system")
  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, [])

  // Unknown or empty names are no-ops.
  await unblockTagKey("  ")
  await unblockTagKey("Rust")
  assert.deepEqual((await getSettings()).autoTag.blockedTagKeys, [])
})
