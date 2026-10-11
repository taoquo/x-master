#!/usr/bin/env node
// Build-output guard. Two properties that no unit test can see:
//
//   1. The provider adapters (and therefore every wire-format string) must stay out
//      of the options page bundle. The options page only renders the provider
//      picker, so it needs the catalog data and nothing else; if an adapter leaks
//      into it, the "pure data vs HTTP code" split has been broken.
//   2. Credentials must never travel through Chrome Sync. Nothing in the source may
//      reference chrome.storage.sync, and this is the cheapest place to notice if
//      that ever changes.
//
// Run after `npm run build`.

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const OUT_DIR = "build/chrome-mv3"
const ADAPTER_MARKERS = ["chat/completions", "v1/messages", "generateContent", "openai/deployments"]
const UI_BUNDLES = ["options.js", "popup.js"]
const ALL_BUNDLES = ["background.js", "content.js", "options.js", "popup.js"]

const failures = []

function readBundle(name) {
  try {
    return readFileSync(join(OUT_DIR, name), "utf8")
  } catch {
    failures.push(`missing bundle: ${name}`)
    return ""
  }
}

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      found.push(...walk(path))
    } else {
      found.push(path)
    }
  }
  return found
}

for (const bundle of UI_BUNDLES) {
  const source = readBundle(bundle)
  for (const marker of ADAPTER_MARKERS) {
    if (source.includes(marker)) {
      failures.push(`${bundle} contains the adapter marker "${marker}": the UI must not ship HTTP code`)
    }
  }
}

for (const bundle of ALL_BUNDLES) {
  const source = readBundle(bundle)
  if (source.includes("storage.sync")) {
    failures.push(`${bundle} references storage.sync: credentials must never reach Chrome Sync`)
  }
}

const maps = walk(OUT_DIR).filter((path) => path.endsWith(".map"))
if (maps.length) {
  failures.push(`production build ships ${maps.length} source map(s): ${maps.join(", ")}`)
}

if (failures.length) {
  console.error("bundle check failed:")
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  process.exit(1)
}

console.log("bundle check passed: no adapter code in the UI bundles, no storage.sync, no source maps")
