import { requestChatJson, type LlmVocabularyEntry } from "./llmProvider.ts"
import { canonicalTagKey, normalizeTagDisplayName } from "../tags/canonical.ts"
import type { AutoTagLlmSettings, BookmarkTagRecord, TagRecord } from "../types.ts"

// A tag library grows one suggestion at a time and drifts into near-synonyms
// ("ai agent", "agentic workflow", "llm agents"). This module asks the model to
// review the whole vocabulary once and propose merges / renames, which the user
// then applies selectively. Nothing here mutates storage.

export interface VocabularyMergeProposal {
  from: string[]
  into: string
  reason?: string
}

export interface VocabularyRenameProposal {
  from: string
  to: string
  reason?: string
}

export interface VocabularyReview {
  merges: VocabularyMergeProposal[]
  renames: VocabularyRenameProposal[]
}

export interface TagMergePlan {
  targetTagId: string
  targetName: string
  sourceTagIds: string[]
  sourceNames: string[]
  reason?: string
}

export interface TagRenamePlan {
  tagId: string
  from: string
  to: string
  reason?: string
}

export interface TagVocabularyReviewResult {
  ok: boolean
  error?: string
  merges: TagMergePlan[]
  renames: TagRenamePlan[]
}

// Stable identity for a proposal, used as the checkbox key in the review panel.
export function mergePlanKey(plan: TagMergePlan) {
  return `merge:${plan.targetTagId}:${[...plan.sourceTagIds].sort().join(",")}`
}

export function renamePlanKey(plan: TagRenamePlan) {
  return `rename:${plan.tagId}:${plan.to}`
}

const TARGET_TAG_COUNT_MIN = 30
const TARGET_TAG_COUNT_MAX = 50
const MAX_REVIEW_VOCABULARY_ENTRIES = 300
const MAX_PROPOSALS = 60
const MAX_TAG_NAME_LENGTH = 40

export function buildVocabularyReviewPrompt(input: { vocabulary: LlmVocabularyEntry[] }): string {
  const vocabulary = [...input.vocabulary]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, MAX_REVIEW_VOCABULARY_ENTRIES)
    .map((entry) => `${entry.name} (${entry.count})`)

  return [
    "You are a librarian consolidating the tag taxonomy of a bookmark library. The library has drifted: many tags are near-synonyms or one-off labels.",
    [
      "Goal:",
      `- The healthy taxonomy size is ${TARGET_TAG_COUNT_MIN}-${TARGET_TAG_COUNT_MAX} durable subject tags. Propose the merges needed to move towards that size.`,
      "- Merge only tags that describe the same durable subject area. Never merge across different domains just to reduce the count.",
      "- Prefer the broader, most established name (highest usage count) as the surviving tag.",
      "- Rename a tag when its name breaks the naming rules but no other tag covers the same concept.",
      "- Leave a tag untouched when you are unsure. Silence is better than a wrong merge."
    ].join("\n"),
    [
      "Naming rules for the surviving tag:",
      "- English only, lowercase, singular.",
      "- One or two words, words separated by a single space.",
      "- No leading '#', no emoji, no punctuation, no author handles."
    ].join("\n"),
    [
      "Output rules:",
      "- Every name in \"from\" must be copied exactly from the vocabulary below.",
      "- \"into\" is the surviving tag name. \"reason\" is one short English clause.",
      "- Do not repeat a tag in more than one merge group."
    ].join("\n"),
    `Current vocabulary, most used first (name and usage count): ${
      vocabulary.length ? vocabulary.join(", ") : "(empty)"
    }`,
    'Respond with JSON only: {"merges":[{"from":["ai agents","agentic ai"],"into":"ai agent","reason":"same concept"}],"renames":[{"from":"LLMs","to":"llm","reason":"naming"}]}'
  ].join("\n\n")
}

function sanitizeTargetName(value: unknown): string {
  const name = normalizeTagDisplayName(String(value ?? ""))
  if (!name || name.length > MAX_TAG_NAME_LENGTH) {
    return ""
  }

  return name
}

// Maps a model-supplied name back to the exact display name stored locally, so
// that "AI Agents" resolves to the existing "ai agent" tag instead of creating
// a second one.
function buildKnownNameIndex(knownTagNames: string[]) {
  const index = new Map<string, string>()
  for (const name of knownTagNames) {
    const key = canonicalTagKey(name)
    if (key && !index.has(key)) {
      index.set(key, name)
    }
  }

  return index
}

export function parseVocabularyReview(content: string, knownTagNames: string[]): VocabularyReview {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { merges: [], renames: [] }
  }

  const known = buildKnownNameIndex(knownTagNames)
  const merges: VocabularyMergeProposal[] = []
  const renames: VocabularyRenameProposal[] = []
  // A tag may only appear in one proposal; later duplicates are dropped.
  const claimedKeys = new Set<string>()

  const rawMerges = (parsed as { merges?: unknown })?.merges
  if (Array.isArray(rawMerges)) {
    for (const entry of rawMerges) {
      if (merges.length >= MAX_PROPOSALS) {
        break
      }

      const rawFrom = (entry as { from?: unknown })?.from
      const intoName = sanitizeTargetName((entry as { into?: unknown })?.into)
      if (!Array.isArray(rawFrom) || !intoName) {
        continue
      }

      const intoKey = canonicalTagKey(intoName)
      const sources: string[] = []
      const seenSourceKeys = new Set<string>()

      for (const candidate of rawFrom) {
        const key = canonicalTagKey(String(candidate ?? ""))
        const localName = key ? known.get(key) : undefined
        if (!localName || key === intoKey || seenSourceKeys.has(key) || claimedKeys.has(key)) {
          continue
        }

        seenSourceKeys.add(key)
        sources.push(localName)
      }

      if (!sources.length) {
        continue
      }

      const target = known.get(intoKey)
      const reason = sanitizeReason((entry as { reason?: unknown })?.reason)

      if (target) {
        if (claimedKeys.has(intoKey)) {
          continue
        }

        claimedKeys.add(intoKey)
        for (const key of seenSourceKeys) {
          claimedKeys.add(key)
        }

        merges.push({ from: sources, into: target, reason })
        continue
      }

      // The surviving name does not exist yet: keep the most established source
      // as the target and rename it afterwards.
      const survivor = sources[0]
      for (const key of seenSourceKeys) {
        claimedKeys.add(key)
      }

      if (sources.length > 1) {
        merges.push({ from: sources.slice(1), into: survivor, reason })
      }

      renames.push({ from: survivor, to: intoName, reason })
    }
  }

  const rawRenames = (parsed as { renames?: unknown })?.renames
  if (Array.isArray(rawRenames)) {
    for (const entry of rawRenames) {
      if (renames.length >= MAX_PROPOSALS) {
        break
      }

      const fromKey = canonicalTagKey(String((entry as { from?: unknown })?.from ?? ""))
      const localName = fromKey ? known.get(fromKey) : undefined
      const toName = sanitizeTargetName((entry as { to?: unknown })?.to)
      if (!localName || !toName || claimedKeys.has(fromKey)) {
        continue
      }

      const toKey = canonicalTagKey(toName)
      if (toKey === fromKey) {
        continue
      }

      const reason = sanitizeReason((entry as { reason?: unknown })?.reason)
      const existingTarget = known.get(toKey)

      // Renaming onto an existing tag is a merge in disguise.
      if (existingTarget) {
        if (claimedKeys.has(toKey)) {
          continue
        }

        claimedKeys.add(fromKey)
        claimedKeys.add(toKey)
        merges.push({ from: [localName], into: existingTarget, reason })
        continue
      }

      claimedKeys.add(fromKey)
      renames.push({ from: localName, to: toName, reason })
    }
  }

  return { merges, renames }
}

function sanitizeReason(value: unknown): string | undefined {
  const reason = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return reason || undefined
}

export function buildVocabularyEntries(tags: TagRecord[], bookmarkTags: BookmarkTagRecord[]): LlmVocabularyEntry[] {
  const countByTagId = new Map<string, number>()
  for (const relation of bookmarkTags) {
    countByTagId.set(relation.tagId, (countByTagId.get(relation.tagId) ?? 0) + 1)
  }

  return tags.map((tag) => ({ name: tag.name, count: countByTagId.get(tag.id) ?? 0 }))
}

function resolveReview(review: VocabularyReview, tags: TagRecord[]): { merges: TagMergePlan[]; renames: TagRenamePlan[] } {
  const tagByKey = new Map<string, TagRecord>()
  for (const tag of tags) {
    const key = canonicalTagKey(tag.name)
    if (key && !tagByKey.has(key)) {
      tagByKey.set(key, tag)
    }
  }

  const merges: TagMergePlan[] = []
  for (const proposal of review.merges) {
    const target = tagByKey.get(canonicalTagKey(proposal.into))
    if (!target) {
      continue
    }

    const sources: TagRecord[] = []
    for (const name of proposal.from) {
      const source = tagByKey.get(canonicalTagKey(name))
      if (source && source.id !== target.id) {
        sources.push(source)
      }
    }

    if (!sources.length) {
      continue
    }

    merges.push({
      targetTagId: target.id,
      targetName: target.name,
      sourceTagIds: sources.map((tag) => tag.id),
      sourceNames: sources.map((tag) => tag.name),
      reason: proposal.reason
    })
  }

  const renames: TagRenamePlan[] = []
  for (const proposal of review.renames) {
    const tag = tagByKey.get(canonicalTagKey(proposal.from))
    if (!tag) {
      continue
    }

    renames.push({ tagId: tag.id, from: tag.name, to: proposal.to, reason: proposal.reason })
  }

  return { merges, renames }
}

export async function reviewTagVocabulary(options: {
  settings: Pick<AutoTagLlmSettings, "baseUrl" | "model">
  apiKey: string
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
}): Promise<TagVocabularyReviewResult> {
  if (options.tags.length < 2) {
    return { ok: true, merges: [], renames: [] }
  }

  const vocabulary = buildVocabularyEntries(options.tags, options.bookmarkTags)
  const result = await requestChatJson({
    settings: options.settings,
    apiKey: options.apiKey,
    prompt: buildVocabularyReviewPrompt({ vocabulary }),
    fetchImpl: options.fetchImpl,
    sleep: options.sleep
  })

  if (!result.ok) {
    return { ok: false, error: result.error ?? "request-failed", merges: [], renames: [] }
  }

  const review = parseVocabularyReview(
    result.content,
    options.tags.map((tag) => tag.name)
  )

  return { ok: true, ...resolveReview(review, options.tags) }
}
