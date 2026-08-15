// Canonical identity for tag names. Everything that decides "is this the same
// tag?" must go through canonicalTagKey so that "AI Agent", "ai-agents" and
// "AI_Agent" collapse into one concept instead of three real tags.
//
// Display names keep their original casing and spacing; only the key is
// normalized.

// Words that end in "s" but are not plural. Without this list the naive plural
// stripping below would turn "devops" into "devop" and "news" into "new".
const NEVER_DEPLURALIZE = new Set([
  "news",
  "devops",
  "ops",
  "ios",
  "macos",
  "aws",
  "gcs",
  "kubernetes",
  "series",
  "redis",
  "nextjs",
  "nodejs",
  "nestjs",
  "threejs",
  "js",
  "ts",
  "os",
  "saas",
  "paas",
  "iaas",
  "cms",
  "dns",
  "gis",
  "aigc"
])

function depluralize(value: string) {
  if (value.length < 4 || NEVER_DEPLURALIZE.has(value) || !/^[a-z]+$/.test(value)) {
    return value
  }

  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`
  }

  if (/(?:s|x|z|ch|sh)es$/.test(value)) {
    return value.slice(0, -2)
  }

  if (value.endsWith("s") && !/(?:ss|us|is|os)$/.test(value)) {
    return value.slice(0, -1)
  }

  return value
}

// Strips the leading hash marks and collapses whitespace, keeping the human
// readable form intact.
export function normalizeTagDisplayName(tagName: string) {
  return tagName.normalize("NFKC").trim().replace(/^#+/, "").replace(/\s+/g, " ").trim()
}

export function canonicalTagKey(tagName: string) {
  const display = normalizeTagDisplayName(tagName).toLowerCase()
  const compact = display.replace(/[\s\-_/.]+/g, "")
  return depluralize(compact)
}

export function isSameTagName(left: string, right: string) {
  const leftKey = canonicalTagKey(left)
  return leftKey.length > 0 && leftKey === canonicalTagKey(right)
}

// Alias-aware lookup: a tag absorbed by a merge keeps the old name as an alias
// so later suggestions of that name resolve to the surviving tag.
export function findTagByName<T extends { name: string; aliases?: string[] }>(
  tags: T[],
  tagName: string
): T | undefined {
  const key = canonicalTagKey(tagName)
  if (!key) {
    return undefined
  }

  return (
    tags.find((tag) => canonicalTagKey(tag.name) === key) ??
    tags.find((tag) => (tag.aliases ?? []).some((alias) => canonicalTagKey(alias) === key))
  )
}
