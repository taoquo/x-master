// Sorting helpers shared by the options views.
//
// `String.prototype.localeCompare(x, undefined, { numeric, sensitivity })`
// rebuilds a collator on every call, which measured ~15x slower than reusing a
// single `Intl.Collator`. With a few thousand tags that difference dominates
// every re-sort, so all display-name comparisons go through here.
const naturalNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function compareNaturalNames(left: string, right: string) {
  return naturalNameCollator.compare(left, right)
}
