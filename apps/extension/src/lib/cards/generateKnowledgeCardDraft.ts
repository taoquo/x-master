import type { KnowledgeCardDraftRecord, KnowledgeCardProvenanceRecord, SourceMaterialRecord } from "../types.ts"
import { getSourceMaterialFingerprint } from "./sourceFingerprint.ts"

export const HEURISTIC_GENERATOR_VERSION = "heuristic-v1"

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
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
  const index = sourceText.indexOf(excerpt)
  const normalizedExcerpt = excerpt || takeExcerpt(sourceText, 0, 140)

  if (index < 0) {
    return {
      field,
      excerpt: normalizedExcerpt
    } satisfies KnowledgeCardProvenanceRecord
  }

  return {
    field,
    excerpt: normalizedExcerpt,
    charStart: index,
    charEnd: index + normalizedExcerpt.length
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

  return "Useful as a technical reference when revisiting the core idea or implementation pattern from this thread."
}

function inferWarnings(sourceMaterial: SourceMaterialRecord, keyExcerpt: string) {
  const warnings: string[] = []

  if (normalizeWhitespace(sourceMaterial.text).length < 180) {
    warnings.push("Short source material; review the draft before keeping it.")
  }

  if (!keyExcerpt) {
    warnings.push("No strong code or quote excerpt found.")
  }

  if (!sourceMaterial.authorHandle.trim()) {
    warnings.push("Missing author handle metadata.")
  }

  return warnings
}

export function generateKnowledgeCardDraft(sourceMaterial: SourceMaterialRecord): KnowledgeCardDraftRecord {
  const normalizedText = sourceMaterial.text.trim()
  const sentences = getSentences(normalizedText)
  const theme = inferTheme(sentences, sourceMaterial)
  const summary = inferSummary(sentences, sourceMaterial)
  const keyExcerpt = inferKeyExcerpt(normalizedText)
  const applicability = inferApplicability(normalizedText)
  const warnings = inferWarnings(sourceMaterial, keyExcerpt)
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
      generatorVersion: HEURISTIC_GENERATOR_VERSION
    },
    generatedAt,
    updatedAt: generatedAt,
    sourceFingerprint: getSourceMaterialFingerprint(sourceMaterial),
    lastGeneratedFromModel: HEURISTIC_GENERATOR_VERSION
  }
}
