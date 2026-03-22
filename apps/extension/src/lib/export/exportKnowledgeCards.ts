import JSZip from "jszip"
import type { BookmarkTagRecord, KnowledgeCardDraftRecord, SourceMaterialRecord, TagRecord } from "../types.ts"

function toFrontmatterValue(value: string) {
  return JSON.stringify(value)
}

function sanitizeFileName(value: string) {
  const invalidChars = new Set(["<", ">", ":", "\"", "/", "\\", "|", "?", "*"])
  return value
    .split("")
    .map((character) => (invalidChars.has(character) || character.charCodeAt(0) < 32 ? " " : character))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Untitled"
}

function getPrimaryTagFolder(sourceTagNames: string[]) {
  const primaryTag = [...sourceTagNames].sort((left, right) => left.localeCompare(right))[0]
  return sanitizeFileName(primaryTag || "Untagged")
}

function getThemeFolder(theme?: string) {
  return sanitizeFileName(theme || "Misc")
}

function formatCardMarkdown({
  card,
  sourceMaterial,
  sourceTagNames
}: {
  card: KnowledgeCardDraftRecord
  sourceMaterial?: SourceMaterialRecord
  sourceTagNames: string[]
}) {
  const frontmatter = [
    "---",
    `title: ${toFrontmatterValue(card.title)}`,
    `theme: ${toFrontmatterValue(card.theme)}`,
    `status: ${card.status}`,
    `source_material_id: ${toFrontmatterValue(card.sourceMaterialId)}`,
    `source_url: ${toFrontmatterValue(sourceMaterial?.tweetUrl ?? "")}`,
    `source_author: ${toFrontmatterValue(sourceMaterial?.authorHandle ?? "")}`,
    `tags: [${sourceTagNames.map((tagName) => toFrontmatterValue(tagName)).join(", ")}]`,
    `quality_score: ${card.quality.score}`,
    `needs_review: ${card.quality.needsReview}`,
    `quality_issue_codes: [${(card.quality.issues ?? []).map((issue) => toFrontmatterValue(issue.code)).join(", ")}]`,
    `generator: ${toFrontmatterValue(card.quality.generatorVersion)}`,
    `generated_at: ${toFrontmatterValue(card.generatedAt)}`,
    `updated_at: ${toFrontmatterValue(card.updatedAt)}`,
    "---"
  ].join("\n")

  const provenanceGroups = new Map<string, string[]>()
  for (const item of card.provenance) {
    const current = provenanceGroups.get(item.field) ?? []
    if (!current.includes(item.excerpt)) {
      current.push(item.excerpt)
    }
    provenanceGroups.set(item.field, current)
  }

  const provenance = provenanceGroups.size
    ? Array.from(provenanceGroups.entries())
        .map(([field, excerpts]) => [`- ${field}:`, ...excerpts.map((excerpt) => `  - ${excerpt}`)].join("\n"))
        .join("\n")
    : "- No provenance captured"

  const warnings = card.quality.warnings.length ? card.quality.warnings.map((warning) => `- ${warning}`).join("\n") : "- None"

  return `${frontmatter}

# ${card.title}

## Summary
${card.summary}

## Key Excerpt
${card.keyExcerpt}

## Applicability
${card.applicability}

## Quality Warnings
${warnings}

## Provenance
${provenance}

## Source
${sourceMaterial?.tweetUrl ?? ""}
`
}

function formatSourceMarkdown(sourceMaterial: SourceMaterialRecord, sourceTagNames: string[]) {
  const frontmatter = [
    "---",
    `title: ${toFrontmatterValue(sourceMaterial.authorName || sourceMaterial.tweetId)}`,
    `source_kind: ${toFrontmatterValue(sourceMaterial.sourceKind ?? "x-bookmark")}`,
    `tweet_id: ${toFrontmatterValue(sourceMaterial.tweetId)}`,
    `source_url: ${toFrontmatterValue(sourceMaterial.tweetUrl)}`,
    `author_handle: ${toFrontmatterValue(sourceMaterial.authorHandle)}`,
    `saved_at: ${toFrontmatterValue(sourceMaterial.savedAt)}`,
    `created_at_on_x: ${toFrontmatterValue(sourceMaterial.createdAtOnX)}`,
    `tags: [${sourceTagNames.map((tagName) => toFrontmatterValue(tagName)).join(", ")}]`,
    "---"
  ].join("\n")

  return `${frontmatter}

# Source Material

${sourceMaterial.text}
`
}

function buildIndexMarkdown({
  cards,
  sourceMaterials
}: {
  cards: KnowledgeCardDraftRecord[]
  sourceMaterials: SourceMaterialRecord[]
}) {
  const staleCount = cards.filter((card) => card.status === "reviewed" && card.quality.needsReview).length
  const reviewedCount = cards.filter((card) => card.status === "reviewed" && !card.quality.needsReview).length
  const draftCount = cards.filter((card) => card.status === "draft").length

  return `# Knowledge Cards Export

- Exported cards: ${cards.length}
- Source materials: ${sourceMaterials.length}
- Draft cards: ${draftCount}
- Reviewed cards: ${reviewedCount}
- Stale cards: ${staleCount}

## Structure

- \`Cards/<Primary Tag>/<Theme>/\` contains one markdown file per knowledge card draft
- \`Sources/<Primary Tag>/<Theme>/\` contains the source material the cards were generated from
- \`_meta/\` contains this index file
`
}

export async function exportKnowledgeCardsAsObsidianVault({
  cards,
  sourceMaterials,
  bookmarkTags,
  tags
}: {
  cards: KnowledgeCardDraftRecord[]
  sourceMaterials: SourceMaterialRecord[]
  bookmarkTags: BookmarkTagRecord[]
  tags: TagRecord[]
}) {
  const zip = new JSZip()
  const cardsFolder = zip.folder("Cards")
  const sourcesFolder = zip.folder("Sources")
  const metaFolder = zip.folder("_meta")
  const exportedSourceIds = new Set(cards.map((card) => card.sourceMaterialId))
  const exportedSourceMaterials = sourceMaterials.filter((sourceMaterial) => exportedSourceIds.has(sourceMaterial.tweetId))
  const sourceById = new Map(exportedSourceMaterials.map((sourceMaterial) => [sourceMaterial.tweetId, sourceMaterial]))
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const sourceTagNamesById = new Map<string, string[]>()

  for (const bookmarkTag of bookmarkTags) {
    const names = sourceTagNamesById.get(bookmarkTag.bookmarkId) ?? []
    const tagName = tagNameById.get(bookmarkTag.tagId)
    if (tagName) {
      names.push(tagName)
    }
    sourceTagNamesById.set(bookmarkTag.bookmarkId, names)
  }

  for (const card of cards) {
    const sourceMaterial = sourceById.get(card.sourceMaterialId)
    const sourceTagNames = sourceTagNamesById.get(card.sourceMaterialId) ?? []
    const primaryTagFolder = getPrimaryTagFolder(sourceTagNames)
    const themeFolder = getThemeFolder(card.theme)
    const fileName = `${sanitizeFileName(card.title)}-${card.sourceMaterialId}.md`
    cardsFolder?.folder(primaryTagFolder)?.folder(themeFolder)?.file(
      fileName,
      formatCardMarkdown({
        card,
        sourceMaterial,
        sourceTagNames
      })
    )
  }

  for (const sourceMaterial of exportedSourceMaterials) {
    const sourceTagNames = sourceTagNamesById.get(sourceMaterial.tweetId) ?? []
    const relatedCard = cards.find((card) => card.sourceMaterialId === sourceMaterial.tweetId)
    const primaryTagFolder = getPrimaryTagFolder(sourceTagNames)
    const themeFolder = getThemeFolder(relatedCard?.theme)
    const fileName = `${sanitizeFileName(sourceMaterial.authorHandle || sourceMaterial.tweetId)}-${sourceMaterial.tweetId}.md`
    sourcesFolder?.folder(primaryTagFolder)?.folder(themeFolder)?.file(fileName, formatSourceMarkdown(sourceMaterial, sourceTagNames))
  }

  metaFolder?.file(
    "index.md",
    buildIndexMarkdown({
      cards,
      sourceMaterials: exportedSourceMaterials
    })
  )

  return zip.generateAsync({ type: "blob" })
}
