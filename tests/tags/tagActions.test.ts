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
import { deleteTagPermanently, unblockTagKey } from "../../src/lib/tags/tagActions.ts"

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
