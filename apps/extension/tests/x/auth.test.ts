import test from "node:test"
import assert from "node:assert/strict"
import { extractCsrfToken } from "../../src/lib/x/auth.ts"

test("extractCsrfToken extracts ct0 from cookie header", () => {
  assert.equal(extractCsrfToken("foo=bar; ct0=token123; baz=1"), "token123")
})
