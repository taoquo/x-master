import test from "node:test"
import assert from "node:assert/strict"
import { buildTagNamesByBookmarkId } from "../../src/options/utils.ts"
import type { BookmarkTagRecord, TagRecord } from "../../src/lib/types.ts"

function tag(id: string, name: string): TagRecord {
  return { id, name, createdAt: "2026-03-15T00:00:00.000Z" }
}

function relation(bookmarkId: string, tagId: string): BookmarkTagRecord {
  return { id: bookmarkId + ":" + tagId, bookmarkId, tagId, createdAt: "2026-03-15T00:00:00.000Z" }
}

test("buildTagNamesByBookmarkId groups tag names per bookmark and skips unknown tags", () => {
  const tagsById = new Map([tag("tag-ai", "ai"), tag("tag-rust", "rust")].map((item) => [item.id, item]))
  const names = buildTagNamesByBookmarkId(
    [
      relation("tweet-1", "tag-ai"),
      relation("tweet-1", "tag-rust"),
      relation("tweet-2", "tag-rust"),
      relation("tweet-2", "tag-missing")
    ],
    tagsById
  )

  assert.deepEqual(names.get("tweet-1"), ["ai", "rust"])
  assert.deepEqual(names.get("tweet-2"), ["rust"])
  assert.equal(names.has("tweet-3"), false)
})

test("buildTagNamesByBookmarkId returns an empty map without relations", () => {
  assert.equal(buildTagNamesByBookmarkId([], new Map()).size, 0)
})
