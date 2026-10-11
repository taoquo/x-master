import test from "node:test"
import assert from "node:assert/strict"
import { formatSyncProgressLabel } from "../../src/lib/runtime/syncProgress.ts"
import { getOptionsCopy } from "../../src/options/i18n/copy.ts"

test("formatSyncProgressLabel substitutes the counters into the given template", () => {
  // The label is built from a copy template rather than a locale branch, so a new
  // locale only needs a translation, and the runtime module no longer owns
  // user-facing text.
  assert.equal(
    formatSyncProgressLabel("{pages} pages / {items} items", { pageCount: 3, fetchedCount: 12 }),
    "3 pages / 12 items"
  )
  assert.equal(formatSyncProgressLabel("only items: {items}", { pageCount: 0, fetchedCount: 7 }), "only items: 7")
})

test("both locales provide a progress template with the counters in place", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const template = getOptionsCopy(locale).syncingProgress
    assert.match(template, /\{pages\}/, `${locale} template must interpose the page count`)
    assert.match(template, /\{items\}/, `${locale} template must interpose the item count`)
    // And the template is what actually renders, so the numbers appear in it.
    assert.match(
      formatSyncProgressLabel(template, { pageCount: 4, fetchedCount: 9 }),
      /4[\s\S]*9/
    )
  }
})
