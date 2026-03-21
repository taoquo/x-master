import { buildProvenance, generateKnowledgeCardDraft } from "./generateKnowledgeCardDraft.ts"
import { getSourceMaterialFingerprint } from "./sourceFingerprint.ts"
import type { AiGenerationSettings, KnowledgeCardDraftRecord, SourceMaterialRecord } from "../types.ts"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const OPENAI_GENERATOR_VERSION = "openai-responses-v1"

interface AiDraftResponse {
  title: string
  theme: string
  summary: string
  keyExcerpt: string
  applicability: string
  supportingEvidence: {
    theme: string
    summary: string
    keyExcerpt: string
    applicability: string
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

function buildPrompt(sourceMaterial: SourceMaterialRecord) {
  return `Generate a reusable technical learning card draft from this X thread.

Source metadata:
- Author: @${sourceMaterial.authorHandle || "unknown"}
- URL: ${sourceMaterial.tweetUrl}
- Created on X: ${sourceMaterial.createdAtOnX}

Source text:
${sourceMaterial.text}
`
}

function extractOutputText(responsePayload: any) {
  if (typeof responsePayload?.output_text === "string" && responsePayload.output_text.trim()) {
    return responsePayload.output_text
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
          theme: { type: "string" },
          summary: { type: "string" },
          keyExcerpt: { type: "string" },
          applicability: { type: "string" }
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

function appendFallbackWarning(card: KnowledgeCardDraftRecord, warning: string) {
  return {
    ...card,
    quality: {
      ...card.quality,
      needsReview: true,
      warnings: [...card.quality.warnings, warning]
    },
    updatedAt: new Date().toISOString()
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
        "You convert saved technical X threads into reusable learning card drafts for developers. Be concrete, technical, and faithful to the source. Keep the key excerpt verbatim when possible and include review warnings when the source is ambiguous.",
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
    return appendFallbackWarning(generateKnowledgeCardDraft(sourceMaterial), "AI generation is disabled; using heuristic draft generator.")
  }

  try {
    const aiDraft = await callOpenAiForDraft({
      sourceMaterial,
      settings,
      fetchImpl
    })
    const generatedAt = new Date().toISOString()

    return {
      id: `card-${sourceMaterial.tweetId}`,
      sourceMaterialId: sourceMaterial.tweetId,
      status: "draft",
      title: aiDraft.title.trim(),
      theme: aiDraft.theme.trim(),
      summary: aiDraft.summary.trim(),
      keyExcerpt: aiDraft.keyExcerpt.trim(),
      applicability: aiDraft.applicability.trim(),
      provenance: [
        buildProvenance("theme", sourceMaterial.text, aiDraft.supportingEvidence.theme),
        buildProvenance("summary", sourceMaterial.text, aiDraft.supportingEvidence.summary),
        buildProvenance("key_excerpt", sourceMaterial.text, aiDraft.supportingEvidence.keyExcerpt),
        buildProvenance("applicability", sourceMaterial.text, aiDraft.supportingEvidence.applicability)
      ],
      quality: {
        score: clampScore(aiDraft.quality.score),
        needsReview: aiDraft.quality.warnings.length > 0,
        warnings: aiDraft.quality.warnings,
        generatorVersion: `${OPENAI_GENERATOR_VERSION}:${settings.model}`
      },
      generatedAt,
      updatedAt: generatedAt,
      sourceFingerprint: getSourceMaterialFingerprint(sourceMaterial),
      lastGeneratedFromModel: settings.model
    }
  } catch (error) {
    const fallback = generateKnowledgeCardDraft(sourceMaterial)
    return appendFallbackWarning(
      fallback,
      error instanceof Error ? `AI generation failed: ${error.message}` : "AI generation failed; using heuristic fallback."
    )
  }
}
