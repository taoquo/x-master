import test from "node:test"
import assert from "node:assert/strict"
import { buildAuthorSidebarItems, getVisibleAuthorSidebarItems } from "../../src/options/authorSidebar.ts"
import type { BookmarkRecord } from "../../src/lib/types.ts"

function createBookmark(authorHandle: string, authorName: string, suffix: string): BookmarkRecord {
  return {
    tweetId: `tweet-${authorHandle}-${suffix}`,
    tweetUrl: `https://x.com/${authorHandle}/status/${suffix}`,
    authorName,
    authorHandle,
    text: `${authorName} ${suffix}`,
    createdAtOnX: "2026-03-15T00:00:00.000Z",
    savedAt: "2026-03-15T01:00:00.000Z",
    rawPayload: {}
  }
}

test("buildAuthorSidebarItems groups bookmarks by handle and sorts by count", () => {
  const items = buildAuthorSidebarItems([
    createBookmark("alice", "Alice", "1"),
    createBookmark("bob", "Bob", "1"),
    createBookmark("alice", "Alice", "2")
  ])

  assert.deepEqual(items.map((item) => [item.authorHandle, item.count]), [
    ["alice", 2],
    ["bob", 1]
  ])
})

test("getVisibleAuthorSidebarItems applies default limit, expansion, and search filtering", () => {
  const authorItems = buildAuthorSidebarItems(
    Array.from({ length: 11 }, (_, index) => createBookmark(`user${index + 1}`, `User ${index + 1}`, "1"))
  )

  const collapsed = getVisibleAuthorSidebarItems({
    authorItems,
    searchQuery: "",
    expanded: false
  })
  assert.equal(collapsed.items.length, 6)
  assert.equal(collapsed.items.some((item) => item.authorHandle === "user11"), false)
  assert.equal(collapsed.shouldShowToggle, true)

  const expanded = getVisibleAuthorSidebarItems({
    authorItems,
    searchQuery: "",
    expanded: true
  })
  assert.equal(expanded.items.some((item) => item.authorHandle === "user11"), true)
  assert.equal(expanded.shouldShowToggle, true)

  const searched = getVisibleAuthorSidebarItems({
    authorItems,
    searchQuery: "user11",
    expanded: true
  })
  assert.deepEqual(searched.items.map((item) => item.authorHandle), ["user11"])
  assert.equal(searched.shouldShowToggle, false)
})
