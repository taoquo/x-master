import test from "node:test"
import assert from "node:assert/strict"
import { buildProvenance } from "../../src/lib/cards/generateKnowledgeCardDraft.ts"

test("buildProvenance finds excerpts even when whitespace is normalized", () => {
  const sourceText = "Agent systems need explicit tool calls.\n\n```ts\nawait runTool()\n```"
  const provenance = buildProvenance("key_excerpt", sourceText, "Agent systems need explicit tool calls. ```ts await runTool() ```")

  assert.equal(provenance.charStart !== undefined, true)
  assert.equal(provenance.charEnd !== undefined, true)
  assert.match(provenance.excerpt, /Agent systems need explicit tool calls/)
})
