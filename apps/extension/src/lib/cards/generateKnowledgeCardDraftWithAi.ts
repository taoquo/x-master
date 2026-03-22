import { buildProvenance, generateKnowledgeCardDraft, normalizeWhitespace } from "./generateKnowledgeCardDraft.ts"
import { getSourceMaterialFingerprint } from "./sourceFingerprint.ts"
import type { AiGenerationSettings, KnowledgeCardDraftRecord, SourceMaterialRecord } from "../types.ts"
import { createQualityIssue, dedupeQualityIssues, issuesToWarnings } from "./qualityIssues.ts"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const OPENAI_GENERATOR_VERSION = "openai-responses-v2"
const MAX_TITLE_LENGTH = 96
const MAX_THEME_LENGTH = 120
const MAX_SUMMARY_LENGTH = 420
const MAX_APPLICABILITY_LENGTH = 220
const MAX_EXCERPT_LENGTH = 480

interface AiDraftResponse {
  title: string
  theme: string
  summary: string
  keyExcerpt: string
  applicability: string
  supportingEvidence: {
    theme: string[] | string
    summary: string[] | string
    keyExcerpt: string[] | string
    applicability: string[] | string
  }
  quality: {
    score: number
    warnings: string[]
  }
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 60
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`
}

function clampMultilineText(value: string, maxLength: number) {
  const normalized = value.trim()
  if (!normalized) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0
}

function analyzeSource(sourceText: string) {
  const codeBlocks = sourceText.match(/```[\s\S]*?```/g) ?? []
  const inlineCodeSnippets = sourceText.match(/`[^`\n]+`/g) ?? []
  const numberedListItems = countMatches(sourceText, /(^|\n)\s*\d+\.\s+/g)
  const bulletItems = countMatches(sourceText, /(^|\n)\s*[-*•]\s+/g)
  const urlCount = countMatches(sourceText, /https?:\/\/\S+/g)
  const technicalKeywords = countMatches(
    sourceText.toLowerCase(),
    /\b(agent|llm|prompt|tool|sdk|api|architecture|system|typescript|python|javascript|latency|observability|database|queue|retrieval|embedding|model|eval)\b/g
  )

  return {
    codeBlocks,
    inlineCodeSnippets,
    numberedListItems,
    bulletItems,
    urlCount,
    technicalKeywords
  }
}

function buildPrompt(sourceMaterial: SourceMaterialRecord) {
  const sourceSignals = analyzeSource(sourceMaterial.text)

  return `Generate a reusable technical learning card draft from this saved X post or note.

Your job:
- Focus on the single most reusable technical idea in the source.
- Stay faithful to the source. Do not invent tools, APIs, libraries, metrics, or implementation details.
- Prefer concrete engineering language over generic summaries.
- If the source includes code, prefer a verbatim code block or inline code as keyExcerpt.
- supportingEvidence values must be copied verbatim from the source text.
- For each supportingEvidence field, return 1 to 3 short evidence snippets, ordered strongest first.
- Use quality.warnings for ambiguity, weak evidence, multi-topic material, or missing context.

Field expectations:
- title: short, clear, and reusable as a note title
- theme: the technical topic or pattern
- summary: 2-4 sentences, grounded in the source
- keyExcerpt: verbatim code or quote from the source
- applicability: 1-2 concrete sentences explaining when a developer should reuse this

Source metadata:
- Author: @${sourceMaterial.authorHandle || "unknown"}
- URL: ${sourceMaterial.tweetUrl}
- Created on X: ${sourceMaterial.createdAtOnX}

Source signals:
- Characters: ${sourceMaterial.text.length}
- Code blocks: ${sourceSignals.codeBlocks.length}
- Inline code snippets: ${sourceSignals.inlineCodeSnippets.length}
- Numbered list items: ${sourceSignals.numberedListItems}
- Bullet items: ${sourceSignals.bulletItems}
- URLs: ${sourceSignals.urlCount}
- Technical keyword hits: ${sourceSignals.technicalKeywords}

Source text:
${sourceMaterial.text}
`
}

function extractOutputText(responsePayload: any) {
  if (typeof responsePayload?.output_text === "string" && responsePayload.output_text.trim()) {
    return responsePayload.output_text
  }

  if (typeof responsePayload?.text?.output === "string" && responsePayload.text.output.trim()) {
    return responsePayload.text.output
  }

  const output = Array.isArray(responsePayload?.output) ? responsePayload.output : []
  const textParts: string[] = []

  for (const item of output) {
    if (item?.type !== "message") {
      continue
    }

    const contents = Array.isArray(item.content) ? item.content : []
    for (const content of contents) {
      if (typeof content?.text === "string") {
        textParts.push(content.text)
      } else if (typeof content?.text?.value === "string") {
        textParts.push(content.text.value)
      }
    }
  }

  return textParts.join("\n").trim()
}

function createSchema() {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      theme: { type: "string" },
      summary: { type: "string" },
      keyExcerpt: { type: "string" },
      applicability: { type: "string" },
      supportingEvidence: {
        type: "object",
        properties: {
          theme: { type: "array", items: { type: "string" } },
          summary: { type: "array", items: { type: "string" } },
          keyExcerpt: { type: "array", items: { type: "string" } },
          applicability: { type: "array", items: { type: "string" } }
        },
        required: ["theme", "summary", "keyExcerpt", "applicability"],
        additionalProperties: false
      },
      quality: {
        type: "object",
        properties: {
          score: { type: "number" },
          warnings: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["score", "warnings"],
        additionalProperties: false
      }
    },
    required: ["title", "theme", "summary", "keyExcerpt", "applicability", "supportingEvidence", "quality"],
    additionalProperties: false
  }
}

function appendFallbackWarning(card: KnowledgeCardDraftRecord, warning: string, code: "ai_generation_disabled" | "ai_generation_failed") {
  const issues = dedupeQualityIssues([
    ...(card.quality.issues ?? []),
    createQualityIssue({
      code,
      message: warning
    })
  ])

  return {
    ...card,
    quality: {
      ...card.quality,
      needsReview: true,
      warnings: issuesToWarnings(issues),
      issues
    },
    updatedAt: new Date().toISOString()
  }
}

function toEvidenceList(value: string[] | string) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean)
  }

  return value.trim() ? [value.trim()] : []
}

function resolveEvidenceList({
  sourceText,
  candidates,
  fallback,
  field,
  issues,
  issueCode,
  issueMessage
}: {
  sourceText: string
  candidates: string[]
  fallback: string
  field: "theme" | "summary" | "key_excerpt" | "applicability"
  issues: ReturnType<typeof dedupeQualityIssues>
  issueCode: "theme_evidence_missing" | "summary_evidence_missing" | "applicability_evidence_missing" | "key_excerpt_evidence_missing"
  issueMessage: string
}) {
  const resolved: string[] = []

  for (const candidate of candidates) {
    const candidateText = candidate.trim()
    if (!candidateText) {
      continue
    }

    const candidateProvenance = buildProvenance(field, sourceText, candidateText)
    if (candidateProvenance.charStart !== undefined && !resolved.includes(candidateProvenance.excerpt)) {
      resolved.push(candidateProvenance.excerpt)
    }
  }

  if (resolved.length) {
    return resolved
  }

  issues.push(
    createQualityIssue({
      code: issueCode,
      message: issueMessage,
      field
    })
  )
  return [buildProvenance(field, sourceText, fallback).excerpt]
}

function looksLikeCodeSnippet(value: string) {
  return /```[\s\S]*?```/.test(value) || /`[^`]+`/.test(value)
}

function buildValidatedDraft({
  sourceMaterial,
  aiDraft,
  settings
}: {
  sourceMaterial: SourceMaterialRecord
  aiDraft: AiDraftResponse
  settings: AiGenerationSettings
}): KnowledgeCardDraftRecord {
  const fallback = generateKnowledgeCardDraft(sourceMaterial)
  const sourceSignals = analyzeSource(sourceMaterial.text)
  const issues = aiDraft.quality.warnings.map((warning) =>
    createQualityIssue({
      code: "model_warning",
      message: warning
    })
  )

  const themeEvidence = resolveEvidenceList({
    sourceText: sourceMaterial.text,
    candidates: toEvidenceList(aiDraft.supportingEvidence.theme),
    fallback: fallback.provenance.find((item) => item.field === "theme")?.excerpt ?? sourceMaterial.text,
    field: "theme",
    issues,
    issueCode: "theme_evidence_missing",
    issueMessage: "Theme evidence was not found verbatim in the source; fallback evidence applied."
  })
  const summaryEvidence = resolveEvidenceList({
    sourceText: sourceMaterial.text,
    candidates: toEvidenceList(aiDraft.supportingEvidence.summary),
    fallback: fallback.provenance.find((item) => item.field === "summary")?.excerpt ?? fallback.summary,
    field: "summary",
    issues,
    issueCode: "summary_evidence_missing",
    issueMessage: "Summary evidence was not found verbatim in the source; fallback evidence applied."
  })
  const applicabilityEvidence = resolveEvidenceList({
    sourceText: sourceMaterial.text,
    candidates: toEvidenceList(aiDraft.supportingEvidence.applicability),
    fallback: fallback.provenance.find((item) => item.field === "applicability")?.excerpt ?? fallback.applicability,
    field: "applicability",
    issues,
    issueCode: "applicability_evidence_missing",
    issueMessage: "Applicability evidence was not found verbatim in the source; fallback evidence applied."
  })

  let keyExcerpt = clampMultilineText(aiDraft.keyExcerpt, MAX_EXCERPT_LENGTH)
  const candidateKeyProvenance = buildProvenance("key_excerpt", sourceMaterial.text, keyExcerpt)
  if (!keyExcerpt || candidateKeyProvenance.charStart === undefined) {
    issues.push(
      createQualityIssue({
        code: "key_excerpt_not_verbatim",
        message: "Key excerpt was not found verbatim in the source; heuristic excerpt applied.",
        field: "key_excerpt"
      })
    )
    keyExcerpt = fallback.keyExcerpt
  }

  if (sourceSignals.codeBlocks.length && !looksLikeCodeSnippet(keyExcerpt)) {
    issues.push(
      createQualityIssue({
        code: "key_excerpt_not_code_focused",
        message: "Source contains code, but the excerpt is not code-focused; heuristic code excerpt applied.",
        field: "key_excerpt"
      })
    )
    keyExcerpt = fallback.keyExcerpt
  }

  const title = clampText(aiDraft.title, MAX_TITLE_LENGTH) || fallback.title
  const theme = clampText(aiDraft.theme, MAX_THEME_LENGTH) || fallback.theme
  const summary = clampText(aiDraft.summary, MAX_SUMMARY_LENGTH) || fallback.summary
  const applicability = clampText(aiDraft.applicability, MAX_APPLICABILITY_LENGTH) || fallback.applicability
  const generatedAt = new Date().toISOString()
  const keyEvidence = resolveEvidenceList({
    sourceText: sourceMaterial.text,
    candidates: [keyExcerpt, ...toEvidenceList(aiDraft.supportingEvidence.keyExcerpt)],
    fallback: fallback.keyExcerpt,
    field: "key_excerpt",
    issues,
    issueCode: "key_excerpt_evidence_missing",
    issueMessage: "Key excerpt evidence was not found verbatim in the source; fallback evidence applied."
  })
  const dedupedIssues = dedupeQualityIssues(issues)
  const warnings = issuesToWarnings(dedupedIssues)
  const hasStrongEvidence = [...themeEvidence, ...summaryEvidence, ...keyEvidence, ...applicabilityEvidence].every(
    (value) => buildProvenance("summary", sourceMaterial.text, value).charStart !== undefined
  )
  const evidenceCount = themeEvidence.length + summaryEvidence.length + keyEvidence.length + applicabilityEvidence.length
  const scorePenalty = dedupedIssues.length * 7 + (hasStrongEvidence ? 0 : 8)
  const evidenceBonus = Math.min(8, Math.max(0, evidenceCount - 4) * 2)
  const qualityScore = clampScore(
    aiDraft.quality.score - scorePenalty + evidenceBonus + (sourceSignals.codeBlocks.length && looksLikeCodeSnippet(keyExcerpt) ? 4 : 0)
  )

  return {
    id: `card-${sourceMaterial.tweetId}`,
    sourceMaterialId: sourceMaterial.tweetId,
    status: "draft",
    title,
    theme,
    summary,
    keyExcerpt,
    applicability,
    provenance: [
      ...themeEvidence.map((excerpt) => buildProvenance("theme", sourceMaterial.text, excerpt)),
      ...summaryEvidence.map((excerpt) => buildProvenance("summary", sourceMaterial.text, excerpt)),
      ...keyEvidence.map((excerpt) => buildProvenance("key_excerpt", sourceMaterial.text, excerpt)),
      ...applicabilityEvidence.map((excerpt) => buildProvenance("applicability", sourceMaterial.text, excerpt))
    ],
    quality: {
      score: qualityScore,
      needsReview: dedupedIssues.length > 0,
      warnings,
      generatorVersion: `${OPENAI_GENERATOR_VERSION}:${settings.model}`,
      issues: dedupedIssues
    },
    generatedAt,
    updatedAt: generatedAt,
    sourceFingerprint: getSourceMaterialFingerprint(sourceMaterial),
    lastGeneratedFromModel: settings.model
  }
}

async function callOpenAiForDraft({
  sourceMaterial,
  settings,
  fetchImpl = fetch
}: {
  sourceMaterial: SourceMaterialRecord
  settings: AiGenerationSettings
  fetchImpl?: typeof fetch
}) {
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      store: false,
      instructions:
        "You convert saved technical X posts and note_tweets into reusable learning card drafts for developers. Be concrete, technical, source-faithful, and skeptical about unsupported claims. supportingEvidence must stay verbatim to the source whenever possible.",
      input: buildPrompt(sourceMaterial),
      text: {
        format: {
          type: "json_schema",
          name: "knowledge_card_draft",
          strict: true,
          schema: createSchema()
        }
      }
    })
  })

  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 300)
    throw new Error(`OpenAI Responses API error ${response.status}: ${responseText}`)
  }

  const payload = await response.json()
  const outputText = extractOutputText(payload)

  if (!outputText) {
    throw new Error("OpenAI Responses API returned no structured text output")
  }

  return JSON.parse(outputText) as AiDraftResponse
}

export async function generateKnowledgeCardDraftWithAi({
  sourceMaterial,
  settings,
  fetchImpl = fetch
}: {
  sourceMaterial: SourceMaterialRecord
  settings: AiGenerationSettings
  fetchImpl?: typeof fetch
}): Promise<KnowledgeCardDraftRecord> {
  if (!settings.enabled || !settings.apiKey.trim()) {
    return appendFallbackWarning(generateKnowledgeCardDraft(sourceMaterial), "AI generation is disabled; using heuristic draft generator.", "ai_generation_disabled")
  }

  try {
    const aiDraft = await callOpenAiForDraft({
      sourceMaterial,
      settings,
      fetchImpl
    })
    return buildValidatedDraft({
      sourceMaterial,
      aiDraft,
      settings
    })
  } catch (error) {
    const fallback = generateKnowledgeCardDraft(sourceMaterial)
    return appendFallbackWarning(
      fallback,
      error instanceof Error ? `AI generation failed: ${error.message}` : "AI generation failed; using heuristic fallback.",
      "ai_generation_failed"
    )
  }
}
