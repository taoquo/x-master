import type { SourceMaterialRecord } from "../types.ts"

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function getSourceMaterialFingerprint(sourceMaterial: SourceMaterialRecord) {
  return JSON.stringify({
    authorHandle: sourceMaterial.authorHandle,
    text: normalizeWhitespace(sourceMaterial.text),
    createdAtOnX: sourceMaterial.createdAtOnX,
    tweetUrl: sourceMaterial.tweetUrl
  })
}
