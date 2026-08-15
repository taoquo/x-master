import test from "node:test"
import assert from "node:assert/strict"
import {
  canonicalTagKey,
  findTagByName,
  isSameTagName,
  normalizeTagDisplayName
} from "../../src/lib/tags/canonical.ts"

test("normalizeTagDisplayName keeps casing but strips hashes and collapses whitespace", () => {
  assert.equal(normalizeTagDisplayName("  ##AI   Agents  "), "AI Agents")
  assert.equal(normalizeTagDisplayName("Design"), "Design")
  assert.equal(normalizeTagDisplayName("   "), "")
  assert.equal(normalizeTagDisplayName("#"), "")
})

test("canonicalTagKey collapses casing, separators and plurals into one key", () => {
  const variants = ["AI Agent", "ai-agents", "AI_Agent", "#ai.agent", "Ai   Agents"]
  const keys = new Set(variants.map(canonicalTagKey))

  assert.deepEqual([...keys], ["aiagent"])
  assert.equal(canonicalTagKey("Companies"), "company")
  assert.equal(canonicalTagKey("Watches"), "watch")
  assert.equal(canonicalTagKey(""), "")
})

test("canonicalTagKey never depluralizes known tech words", () => {
  for (const word of ["news", "devops", "iOS", "macOS", "AWS", "Kubernetes", "NextJS", "SaaS", "AIGC"]) {
    assert.equal(canonicalTagKey(word), word.toLowerCase(), word)
  }

  // Short words and non-ascii names are left alone as well.
  assert.equal(canonicalTagKey("ops"), "ops")
  assert.equal(canonicalTagKey("设计"), "设计")
})

test("isSameTagName ignores empty names", () => {
  assert.equal(isSameTagName("AI Agents", "ai-agent"), true)
  assert.equal(isSameTagName("AI", "Rust"), false)
  assert.equal(isSameTagName("", ""), false)
})

test("findTagByName prefers a name match and falls back to aliases", () => {
  const tags = [
    { id: "tag-ai", name: "AI Agents" },
    { id: "tag-llm", name: "LLM", aliases: ["Large Language Model", "GPT"] }
  ]

  assert.equal(findTagByName(tags, "ai-agent")?.id, "tag-ai")
  assert.equal(findTagByName(tags, "large language models")?.id, "tag-llm")
  assert.equal(findTagByName(tags, "gpt")?.id, "tag-llm")
  assert.equal(findTagByName(tags, "Rust"), undefined)
  assert.equal(findTagByName(tags, "  "), undefined)
})
