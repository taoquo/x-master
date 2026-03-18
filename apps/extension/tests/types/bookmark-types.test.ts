import test from "node:test"
import assert from "node:assert/strict"
import { createEmptySyncSummary } from "../../src/lib/types.ts"

test("createEmptySyncSummary creates an idle sync summary object", () => {
  assert.deepEqual(createEmptySyncSummary(), {
    status: "idle",
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 0
  })
})
