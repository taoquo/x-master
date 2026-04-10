import test from "node:test"
import assert from "node:assert/strict"
import { collectRuleTagAssignments, ruleMatchesBookmark } from "../../src/lib/classification/rules.ts"

const sampleBookmark = {
  tweetId: "tweet-1",
  tweetUrl: "https://x.com/alice/status/tweet-1",
  authorName: "Alice",
  authorHandle: "alice",
  text: "Useful AI workflow with screenshots",
  createdAtOnX: "2026-03-15T00:00:00.000Z",
  savedAt: "2026-03-15T00:01:00.000Z",
  media: [{ type: "photo", url: "https://example.com/1.png" }],
  rawPayload: {}
}

test("ruleMatchesBookmark requires every configured condition group to match", () => {
  const matched = ruleMatchesBookmark(sampleBookmark, {
    id: "rule-1",
    name: "AI media",
    enabled: true,
    authorHandles: ["alice"],
    keywords: ["workflow", "prompt"],
    requireMedia: true,
    requireLongform: false,
    targetTagIds: ["tag-ai"]
  })

  const mismatched = ruleMatchesBookmark(sampleBookmark, {
    id: "rule-2",
    name: "Longform only",
    enabled: true,
    authorHandles: [],
    keywords: ["workflow"],
    requireMedia: true,
    requireLongform: true,
    targetTagIds: ["tag-longform"]
  })

  assert.equal(matched, true)
  assert.equal(mismatched, false)
})

test("collectRuleTagAssignments ignores disabled rules, existing tags, and duplicate outputs", () => {
  const assignments = collectRuleTagAssignments({
    bookmarks: [sampleBookmark],
    rules: [
      {
        id: "rule-1",
        name: "AI",
        enabled: true,
        authorHandles: ["alice"],
        keywords: ["workflow"],
        requireMedia: true,
        requireLongform: false,
        targetTagIds: ["tag-ai", "tag-ai"]
      },
      {
        id: "rule-2",
        name: "Disabled",
        enabled: false,
        authorHandles: [],
        keywords: ["workflow"],
        requireMedia: false,
        requireLongform: false,
        targetTagIds: ["tag-disabled"]
      }
    ],
    existingBookmarkTags: [
      {
        id: "tweet-1:tag-ai",
        bookmarkId: "tweet-1",
        tagId: "tag-ai",
        createdAt: "2026-03-15T00:00:00.000Z"
      }
    ],
    validTagIds: new Set(["tag-ai", "tag-other"])
  })

  assert.deepEqual(assignments, [])
})
