import type { KnowledgeCardDraftRecord, KnowledgeCardProvenanceRecord, SourceMaterialRecord } from "../types.ts"
import { getSourceMaterialFingerprint } from "./sourceFingerprint.ts"
import { createQualityIssue, issuesToWarnings } from "./qualityIssues.ts"

export const HEURISTIC_GENERATOR_VERSION = "heuristic-v1"

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeWhitespaceWithMap(value: string) {
  let normalized = ""
  let mapping: number[] = []
  let previousWasWhitespace = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const isWhitespace = /\s/.test(char)

    if (isWhitespace) {
      if (!normalized.length || previousWasWhitespace) {
        previousWasWhitespace = true
        continue
      }

      normalized += " "
      mapping.push(index)
      previousWasWhitespace = true
      continue
    }

    normalized += char
    mapping.push(index)
    previousWasWhitespace = false
  }

  const trimmed = normalized.trim()
  if (!trimmed) {
    return {
      text: "",
      indexMap: [] as number[]
    }
  }

  const leadingWhitespaceCount = normalized.length - normalized.trimStart().length
  const trailingWhitespaceCount = normalized.length - normalized.trimEnd().length
  mapping = mapping.slice(leadingWhitespaceCount, mapping.length - trailingWhitespaceCount)

  return {
    text: trimmed,
    indexMap: mapping
  }
}

function getSentences(text: string) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function takeExcerpt(text: string, start: number, maxLength: number) {
  const excerpt = text.slice(start, start + maxLength).trim()
  if (excerpt.length <= maxLength) {
    return excerpt
  }

  return `${excerpt.slice(0, maxLength - 3).trim()}...`
}

export function buildProvenance(field: KnowledgeCardProvenanceRecord["field"], sourceText: string, excerpt: string) {
  const normalizedExcerpt = excerpt || takeExcerpt(sourceText, 0, 140)
  const exactIndex = sourceText.indexOf(normalizedExcerpt)

  if (exactIndex >= 0) {
    return {
      field,
      excerpt: normalizedExcerpt,
      charStart: exactIndex,
      charEnd: exactIndex + normalizedExcerpt.length
    } satisfies KnowledgeCardProvenanceRecord
  }

  const normalizedSource = normalizeWhitespaceWithMap(sourceText)
  const compactExcerpt = normalizeWhitespace(normalizedExcerpt)
  const normalizedIndex = normalizedSource.text.indexOf(compactExcerpt)

  if (normalizedIndex >= 0) {
    const start = normalizedSource.indexMap[normalizedIndex]
    const end = normalizedSource.indexMap[normalizedIndex + compactExcerpt.length - 1]

    return {
      field,
      excerpt: sourceText.slice(start, end + 1),
      charStart: start,
      charEnd: end + 1
    } satisfies KnowledgeCardProvenanceRecord
  }

  return {
    field,
    excerpt: normalizedExcerpt
  } satisfies KnowledgeCardProvenanceRecord
}

function inferTheme(sentences: string[], sourceMaterial: SourceMaterialRecord) {
  const candidate = sentences[0] ?? sourceMaterial.text
  const normalized = normalizeWhitespace(candidate)
  if (!normalized) {
    return `Notes from @${sourceMaterial.authorHandle}`
  }

  return normalized.length > 72 ? `${normalized.slice(0, 69).trim()}...` : normalized
}

function inferSummary(sentences: string[], sourceMaterial: SourceMaterialRecord) {
  const summary = sentences.slice(0, 2).join(" ")
  const normalized = normalizeWhitespace(summary || sourceMaterial.text)
  if (!normalized) {
    return "No summary could be generated from this source material."
  }

  return normalized.length > 260 ? `${normalized.slice(0, 257).trim()}...` : normalized
}

function inferKeyExcerpt(sourceText: string) {
  const fencedCodeMatch = sourceText.match(/```[\s\S]*?```/)
  if (fencedCodeMatch) {
    return fencedCodeMatch[0]
  }

  const inlineCodeMatch = sourceText.match(/`[^`]+`/)
  if (inlineCodeMatch) {
    return inlineCodeMatch[0]
  }

  const sentences = getSentences(sourceText)
  const bestSentence = [...sentences].sort((left, right) => right.length - left.length)[0] ?? normalizeWhitespace(sourceText)
  return bestSentence.length > 180 ? `${bestSentence.slice(0, 177).trim()}...` : bestSentence
}

function inferApplicability(sourceText: string) {
  const normalized = sourceText.toLowerCase()

  if (normalized.includes("agent")) {
    return "Useful when designing or debugging agent workflows, orchestration loops, or tool-using assistants."
  }

  if (normalized.includes("architecture") || normalized.includes("system design")) {
    return "Useful when evaluating architecture tradeoffs, system boundaries, or implementation patterns."
  }

  if (normalized.includes("llm") || normalized.includes("prompt")) {
    return "Useful when building with LLM APIs, prompt pipelines, or AI-assisted product features."
  }

  return "Useful as a technical reference when revisiting the core idea or implementation pattern from this saved post."
}

function inferIssues(sourceMaterial: SourceMaterialRecord, keyExcerpt: string) {
  const issues = []

  if (normalizeWhitespace(sourceMaterial.text).length < 180) {
    issues.push(createQualityIssue({
      code: "short_source",
      message: "Short source material; review the draft before keeping it."
    }))
  }

  if (!keyExcerpt) {
    issues.push(createQualityIssue({
      code: "key_excerpt_not_verbatim",
      message: "No strong code or quote excerpt found.",
      field: "key_excerpt"
    }))
  }

  if (!sourceMaterial.authorHandle.trim()) {
    issues.push(createQualityIssue({
      code: "missing_author_metadata",
      message: "Missing author handle metadata."
    }))
  }

  return issues
}

export function generateKnowledgeCardDraft(sourceMaterial: SourceMaterialRecord): KnowledgeCardDraftRecord {
  const normalizedText = sourceMaterial.text.trim()
  const sentences = getSentences(normalizedText)
  const theme = inferTheme(sentences, sourceMaterial)
  const summary = inferSummary(sentences, sourceMaterial)
  const keyExcerpt = inferKeyExcerpt(normalizedText)
  const applicability = inferApplicability(normalizedText)
  const issues = inferIssues(sourceMaterial, keyExcerpt)
  const warnings = issuesToWarnings(issues)
  const generatedAt = new Date().toISOString()

  return {
    id: `card-${sourceMaterial.tweetId}`,
    sourceMaterialId: sourceMaterial.tweetId,
    status: "draft",
    title: theme,
    theme,
    summary,
    keyExcerpt,
    applicability,
    provenance: [
      buildProvenance("theme", normalizedText, sentences[0] ?? normalizedText),
      buildProvenance("summary", normalizedText, summary),
      buildProvenance("key_excerpt", normalizedText, keyExcerpt),
      buildProvenance("applicability", normalizedText, sentences[1] ?? sentences[0] ?? normalizedText)
    ],
    quality: {
      score: Math.max(40, 88 - warnings.length * 14),
      needsReview: warnings.length > 0,
      warnings,
      generatorVersion: HEURISTIC_GENERATOR_VERSION,
      issues
    },
    generatedAt,
    updatedAt: generatedAt,
    sourceFingerprint: getSourceMaterialFingerprint(sourceMaterial),
    lastGeneratedFromModel: HEURISTIC_GENERATOR_VERSION
  }
}
