import { generateKnowledgeCardDraft } from "../cards/generateKnowledgeCardDraft.ts"
import { getSourceMaterialFingerprint } from "../cards/sourceFingerprint.ts"
import type { KnowledgeCardDraftRecord, SourceMaterialRecord } from "../types.ts"
import { getBookmarksDb, KNOWLEDGE_CARDS_STORE, requestToPromise, transactionDone } from "./db.ts"

export async function getAllKnowledgeCardDrafts(): Promise<KnowledgeCardDraftRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(KNOWLEDGE_CARDS_STORE, "readonly")
  const store = transaction.objectStore(KNOWLEDGE_CARDS_STORE)
  const cards = (await requestToPromise(store.getAll())) as KnowledgeCardDraftRecord[]
  await transactionDone(transaction)

  return cards.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export async function upsertKnowledgeCardDraftsForSourceMaterials(
  sourceMaterials: SourceMaterialRecord[],
  {
    generateDraft = async (sourceMaterial: SourceMaterialRecord) => generateKnowledgeCardDraft(sourceMaterial)
  }: {
    generateDraft?: (sourceMaterial: SourceMaterialRecord) => Promise<KnowledgeCardDraftRecord> | KnowledgeCardDraftRecord
  } = {}
) {
  if (!sourceMaterials.length) {
    return { createdCount: 0, updatedCount: 0 }
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(KNOWLEDGE_CARDS_STORE, "readwrite")
  const store = transaction.objectStore(KNOWLEDGE_CARDS_STORE)
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0

  for (const sourceMaterial of sourceMaterials) {
    const existing = (await requestToPromise(store.index("sourceMaterialId").get(sourceMaterial.tweetId))) as KnowledgeCardDraftRecord | undefined
    const fingerprint = getSourceMaterialFingerprint(sourceMaterial)

    if (existing?.sourceFingerprint === fingerprint) {
      skippedCount += 1
      continue
    }

    const nextDraft = await generateDraft({
      ...sourceMaterial,
      contentFingerprint: fingerprint
    })

    const nextRecord: KnowledgeCardDraftRecord =
      existing?.status === "reviewed"
        ? {
            ...existing,
            quality: nextDraft.quality,
            provenance: nextDraft.provenance,
            sourceFingerprint: fingerprint,
            lastGeneratedFromModel: nextDraft.lastGeneratedFromModel,
            updatedAt: new Date().toISOString()
          }
        : {
            ...existing,
            ...nextDraft,
            status: existing?.status ?? nextDraft.status,
            updatedAt: new Date().toISOString(),
            generatedAt: existing?.generatedAt ?? nextDraft.generatedAt
          }

    store.put(nextRecord)

    if (existing) {
      updatedCount += 1
    } else {
      createdCount += 1
    }
  }

  await transactionDone(transaction)
  return { createdCount, updatedCount, skippedCount }
}

export async function updateKnowledgeCardDraft(
  cardId: string,
  updates: Pick<KnowledgeCardDraftRecord, "title" | "theme" | "summary" | "keyExcerpt" | "applicability">
) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(KNOWLEDGE_CARDS_STORE, "readwrite")
  const store = transaction.objectStore(KNOWLEDGE_CARDS_STORE)
  const existing = (await requestToPromise(store.get(cardId))) as KnowledgeCardDraftRecord | undefined

  if (!existing) {
    throw new Error("Knowledge card draft not found")
  }

  const updatedCard: KnowledgeCardDraftRecord = {
    ...existing,
    ...updates,
    status: "reviewed",
    updatedAt: new Date().toISOString(),
    quality: {
      ...existing.quality,
      needsReview: false,
      warnings: existing.quality.warnings.filter((warning) => !warning.toLowerCase().includes("review"))
    }
  }

  store.put(updatedCard)
  await transactionDone(transaction)
  return updatedCard
}

export async function regenerateKnowledgeCardDraft(
  sourceMaterial: SourceMaterialRecord,
  {
    generateDraft = async (nextSourceMaterial: SourceMaterialRecord) => generateKnowledgeCardDraft(nextSourceMaterial)
  }: {
    generateDraft?: (sourceMaterial: SourceMaterialRecord) => Promise<KnowledgeCardDraftRecord> | KnowledgeCardDraftRecord
  } = {}
) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(KNOWLEDGE_CARDS_STORE, "readwrite")
  const store = transaction.objectStore(KNOWLEDGE_CARDS_STORE)
  const existing = (await requestToPromise(store.index("sourceMaterialId").get(sourceMaterial.tweetId))) as KnowledgeCardDraftRecord | undefined

  if (!existing) {
    throw new Error("Knowledge card draft not found")
  }

  const nextDraft = await generateDraft({
    ...sourceMaterial,
    contentFingerprint: getSourceMaterialFingerprint(sourceMaterial)
  })
  const regeneratedCard: KnowledgeCardDraftRecord = {
    ...existing,
    ...nextDraft,
    status: "draft",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  store.put(regeneratedCard)
  await transactionDone(transaction)
  return regeneratedCard
}
