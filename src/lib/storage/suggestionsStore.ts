import type { TagSuggestionRecord, TagSuggestionSource } from "../types.ts"
import { TAG_SUGGESTIONS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"

export function normalizeSuggestedTagName(tagName: string) {
  return tagName.normalize("NFKC").trim().replace(/^#+/, "").trim()
}

export function createTagSuggestionId(bookmarkId: string, tagName: string) {
  return `${bookmarkId}::${normalizeSuggestedTagName(tagName).toLowerCase()}`
}

export function createTagSuggestion(input: {
  bookmarkId: string
  tagName: string
  source: TagSuggestionSource
  confidence: number
}): TagSuggestionRecord | null {
  const tagName = normalizeSuggestedTagName(input.tagName)

  if (!tagName) {
    return null
  }

  return {
    id: createTagSuggestionId(input.bookmarkId, tagName),
    bookmarkId: input.bookmarkId,
    tagName,
    source: input.source,
    confidence: input.confidence,
    status: "pending",
    createdAt: new Date().toISOString()
  }
}

export async function getAllTagSuggestions(): Promise<TagSuggestionRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAG_SUGGESTIONS_STORE, "readonly")
  const suggestions = (await requestToPromise(
    transaction.objectStore(TAG_SUGGESTIONS_STORE).getAll()
  )) as TagSuggestionRecord[]
  await transactionDone(transaction)

  return suggestions
}

export async function insertNewTagSuggestions(suggestions: TagSuggestionRecord[]) {
  if (!suggestions.length) {
    return { insertedCount: 0 }
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(TAG_SUGGESTIONS_STORE, "readwrite")
  const store = transaction.objectStore(TAG_SUGGESTIONS_STORE)
  const existingIds = new Set((await requestToPromise(store.getAllKeys())).map(String))
  let insertedCount = 0

  for (const suggestion of suggestions) {
    if (existingIds.has(suggestion.id)) {
      continue
    }

    existingIds.add(suggestion.id)
    store.put(suggestion)
    insertedCount += 1
  }

  await transactionDone(transaction)
  return { insertedCount }
}

export async function resolveTagSuggestion(suggestionId: string, status: "accepted" | "rejected") {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAG_SUGGESTIONS_STORE, "readwrite")
  const store = transaction.objectStore(TAG_SUGGESTIONS_STORE)
  const suggestion = (await requestToPromise(store.get(suggestionId))) as TagSuggestionRecord | undefined

  if (!suggestion) {
    await transactionDone(transaction)
    return null
  }

  const resolved: TagSuggestionRecord = {
    ...suggestion,
    status,
    resolvedAt: new Date().toISOString()
  }

  store.put(resolved)
  await transactionDone(transaction)
  return resolved
}

export async function removeSuggestionsForBookmark(bookmarkId: string) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAG_SUGGESTIONS_STORE, "readwrite")
  const store = transaction.objectStore(TAG_SUGGESTIONS_STORE)
  const index = store.index("bookmarkId")
  const keys = await requestToPromise(index.getAllKeys(bookmarkId))

  for (const key of keys) {
    store.delete(key)
  }

  await transactionDone(transaction)
}
