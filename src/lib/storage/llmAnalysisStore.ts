import type { LlmAnalysisOutcome, LlmAnalysisRecord } from "../types.ts"
import { LLM_ANALYSIS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"

// Bumped whenever buildPrompt changes in a way that could change a verdict.
// Every stored answer was given to a specific question; changing the question
// invalidates the answers, and re-analysis is how a prompt fix reaches the
// bookmarks that were judged under the old one.
export const LLM_PROMPT_VERSION = 1

// Cheap, stable, dependency-free digest of the text the model was shown. This
// is not a security hash: it only has to change when the analyzed content
// changes, which is what makes an edited or backfilled bookmark eligible again.
export function hashAnalyzedContent(text: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

export function createLlmAnalysisRecord(input: {
  bookmarkId: string
  model: string
  contentHash: string
  outcome: LlmAnalysisOutcome
  tagCount: number
  promptVersion?: number
}): LlmAnalysisRecord {
  return {
    bookmarkId: input.bookmarkId,
    analyzedAt: new Date().toISOString(),
    promptVersion: input.promptVersion ?? LLM_PROMPT_VERSION,
    model: input.model,
    contentHash: input.contentHash,
    outcome: input.outcome,
    tagCount: input.tagCount
  }
}

// A verdict is reusable only while every input that produced it still matches.
// Anything else means the stored answer belongs to a question nobody is asking
// any more, so the bookmark goes back into the queue.
export function isAnalysisReusable(
  record: LlmAnalysisRecord | undefined,
  expected: { model: string; contentHash: string; promptVersion?: number }
): record is LlmAnalysisRecord {
  if (!record) {
    return false
  }

  return (
    record.promptVersion === (expected.promptVersion ?? LLM_PROMPT_VERSION) &&
    record.model === expected.model &&
    record.contentHash === expected.contentHash
  )
}

export async function getAllLlmAnalysis(): Promise<LlmAnalysisRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(LLM_ANALYSIS_STORE, "readonly")
  const records = (await requestToPromise(
    transaction.objectStore(LLM_ANALYSIS_STORE).getAll()
  )) as LlmAnalysisRecord[]
  await transactionDone(transaction)

  return records
}

// Written after every batch, including batches that produced no suggestions at
// all: recording only the productive ones is what left the zero-result
// bookmarks pinned to the head of the queue forever.
export async function putLlmAnalysisRecords(records: LlmAnalysisRecord[]) {
  if (!records.length) {
    return { writtenCount: 0 }
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(LLM_ANALYSIS_STORE, "readwrite")
  const store = transaction.objectStore(LLM_ANALYSIS_STORE)

  for (const record of records) {
    store.put(record)
  }

  await transactionDone(transaction)
  return { writtenCount: records.length }
}

export async function removeLlmAnalysisForBookmark(bookmarkId: string) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(LLM_ANALYSIS_STORE, "readwrite")
  transaction.objectStore(LLM_ANALYSIS_STORE).delete(bookmarkId)
  await transactionDone(transaction)
}

// Used when the user wants the LLM to look at everything again.
export async function clearLlmAnalysis() {
  const db = await getBookmarksDb()
  const transaction = db.transaction(LLM_ANALYSIS_STORE, "readwrite")
  transaction.objectStore(LLM_ANALYSIS_STORE).clear()
  await transactionDone(transaction)
}
