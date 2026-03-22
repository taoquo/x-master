import test from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { exportKnowledgeCardsAsObsidianVault } from "../../src/lib/export/exportKnowledgeCards.ts"

test("exportKnowledgeCardsAsObsidianVault creates an Obsidian-style zip with cards, sources, and index", async () => {
  const blob = await exportKnowledgeCardsAsObsidianVault({
    cards: [
      {
        id: "card-1",
        sourceMaterialId: "tweet-1",
        status: "reviewed",
        title: "Agent observability pattern",
        theme: "Agent observability pattern",
        summary: "Explicit tool calls make agent systems easier to debug.",
        keyExcerpt: "```ts\\nawait runTool()\\n```",
        applicability: "Useful when building agent orchestration loops.",
        provenance: [{ field: "summary", excerpt: "Explicit tool calls make agent systems easier to debug." }],
        quality: {
          score: 91,
          needsReview: false,
          warnings: [],
          generatorVersion: "openai-responses-v1:gpt-5-mini"
        },
        generatedAt: "2026-03-15T01:00:00.000Z",
        updatedAt: "2026-03-15T02:00:00.000Z",
        sourceFingerprint: "fp-1",
        lastGeneratedFromModel: "gpt-5-mini"
      }
    ],
    sourceMaterials: [
      {
        tweetId: "tweet-1",
        tweetUrl: "https://x.com/alice/status/tweet-1",
        authorName: "Alice",
        authorHandle: "alice",
        text: "Agent systems need explicit tool calls.",
        createdAtOnX: "2026-03-15T00:00:00.000Z",
        savedAt: "2026-03-15T00:01:00.000Z",
        rawPayload: {},
        sourceKind: "x-bookmark"
      },
      {
        tweetId: "tweet-2",
        tweetUrl: "https://x.com/bob/status/tweet-2",
        authorName: "Bob",
        authorHandle: "bob",
        text: "Unrelated source material that should not leak into the export.",
        createdAtOnX: "2026-03-15T00:00:00.000Z",
        savedAt: "2026-03-15T00:05:00.000Z",
        rawPayload: {},
        sourceKind: "x-bookmark"
      }
    ],
    bookmarkTags: [{ id: "bookmark-tag-1", bookmarkId: "tweet-1", tagId: "tag-1", createdAt: "2026-03-15T00:02:00.000Z" }],
    tags: [{ id: "tag-1", name: "agent", createdAt: "2026-03-15T00:01:30.000Z" }]
  })

  const arrayBuffer = await blob.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const fileNames = Object.keys(zip.files).sort()

  assert.equal(fileNames.includes("Cards/agent/Agent observability pattern/Agent observability pattern-tweet-1.md"), true)
  assert.equal(fileNames.includes("Sources/agent/Agent observability pattern/alice-tweet-1.md"), true)
  assert.equal(fileNames.includes("Sources/Untagged/Misc/bob-tweet-2.md"), false)
  assert.equal(fileNames.includes("_meta/index.md"), true)

  const cardMarkdown = await zip.file("Cards/agent/Agent observability pattern/Agent observability pattern-tweet-1.md")?.async("string")
  const sourceMarkdown = await zip.file("Sources/agent/Agent observability pattern/alice-tweet-1.md")?.async("string")
  const indexMarkdown = await zip.file("_meta/index.md")?.async("string")

  assert.match(cardMarkdown ?? "", /Agent observability pattern/)
  assert.match(cardMarkdown ?? "", /quality_score: 91/)
  assert.match(sourceMarkdown ?? "", /Agent systems need explicit tool calls/)
  assert.match(indexMarkdown ?? "", /Exported cards: 1/)
  assert.match(indexMarkdown ?? "", /Source materials: 1/)
  assert.match(indexMarkdown ?? "", /Cards\/<Primary Tag>\/<Theme>\//)
})
