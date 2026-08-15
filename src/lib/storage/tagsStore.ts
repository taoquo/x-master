import type { BookmarkRecord, BookmarkTagRecord, TagRecord } from "../types.ts"
import { canonicalTagKey, normalizeTagDisplayName } from "../tags/canonical.ts"
import {
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  getBookmarksDb,
  requestToPromise,
  TAGS_STORE,
  transactionDone
} from "./db.ts"

function createBookmarkTagId(bookmarkId: string, tagId: string) {
  return `${bookmarkId}:${tagId}`
}

// Creating a tag whose canonical key already exists returns the existing tag
// instead of a near-duplicate. This is the single guard that keeps
// "AI Agent" / "ai-agents" / "AI_Agent" from becoming three tags.
export async function createTag({ name }: { name: string }): Promise<TagRecord> {
  const trimmedName = normalizeTagDisplayName(name)
  if (!trimmedName) {
    throw new Error("Tag name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const existingTags = (await requestToPromise(store.getAll())) as TagRecord[]
  const canonicalKey = canonicalTagKey(trimmedName)
  const duplicate = existingTags.find((tag) => canonicalTagKey(tag.name) === canonicalKey)

  if (duplicate) {
    await transactionDone(transaction)
    return duplicate
  }

  const tag = {
    id: `tag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: trimmedName,
    createdAt: new Date().toISOString()
  }

  store.put(tag)
  await transactionDone(transaction)
  return tag
}

export async function renameTag({
  tagId,
  name
}: {
  tagId: string
  name: string
}): Promise<TagRecord> {
  const trimmedName = normalizeTagDisplayName(name)
  if (!trimmedName) {
    throw new Error("Tag name is required")
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const existing = (await requestToPromise(store.get(tagId))) as TagRecord | undefined

  if (!existing) {
    throw new Error("Tag not found")
  }

  const updatedTag: TagRecord = {
    ...existing,
    name: trimmedName,
    updatedAt: new Date().toISOString()
  }

  store.put(updatedTag)
  await transactionDone(transaction)
  return updatedTag
}

export async function getAllTags(): Promise<TagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readonly")
  const store = transaction.objectStore(TAGS_STORE)
  const tags = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return (tags as TagRecord[]).sort((left, right) => left.name.localeCompare(right.name))
}

export async function getAllBookmarkTags(): Promise<BookmarkTagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readonly")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const bookmarkTags = await requestToPromise(store.getAll())
  await transactionDone(transaction)
  return bookmarkTags as BookmarkTagRecord[]
}

export async function attachBookmarkTags(relations: Array<{ bookmarkId: string; tagId: string }>) {
  if (!relations.length) {
    return 0
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  let createdCount = 0

  for (const relation of relations) {
    const id = createBookmarkTagId(relation.bookmarkId, relation.tagId)
    const existing = await requestToPromise(store.get(id))
    if (existing) {
      continue
    }

    store.put({
      id,
      bookmarkId: relation.bookmarkId,
      tagId: relation.tagId,
      createdAt: new Date().toISOString()
    } satisfies BookmarkTagRecord)
    createdCount += 1
  }

  await transactionDone(transaction)
  return createdCount
}

export async function attachTagToBookmark({
  bookmarkId,
  tagId
}: {
  bookmarkId: string
  tagId: string
}): Promise<BookmarkTagRecord> {
  await attachBookmarkTags([{ bookmarkId, tagId }])
  return {
    id: createBookmarkTagId(bookmarkId, tagId),
    bookmarkId,
    tagId,
    createdAt: new Date().toISOString()
  }
}

export async function attachTagToBookmarks({
  bookmarkIds,
  tagId
}: {
  bookmarkIds: string[]
  tagId: string
}): Promise<BookmarkTagRecord[]> {
  await attachBookmarkTags(bookmarkIds.map((bookmarkId) => ({ bookmarkId, tagId })))
  const createdAt = new Date().toISOString()
  return bookmarkIds.map((bookmarkId) => ({
    id: createBookmarkTagId(bookmarkId, tagId),
    bookmarkId,
    tagId,
    createdAt
  }))
}

export async function detachTagFromBookmark({
  bookmarkId,
  tagId
}: {
  bookmarkId: string
  tagId: string
}) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARK_TAGS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARK_TAGS_STORE)
  store.delete(createBookmarkTagId(bookmarkId, tagId))
  await transactionDone(transaction)
}

// Deleting a tag removes the tag definition and detaches it from every
// bookmark; the bookmarks themselves are untouched. Callers that want the tag
// to stay gone must also block its canonical key (see settings.blockedTagKeys),
// otherwise auto-tagging can suggest the same name again later.
export async function deleteTag(tagId: string) {
  const db = await getBookmarksDb()
  const transaction = db.transaction([TAGS_STORE, BOOKMARK_TAGS_STORE], "readwrite")
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const relatedBookmarkTags = (await requestToPromise(bookmarkTagsStore.index("tagId").getAll(tagId))) as BookmarkTagRecord[]

  for (const bookmarkTag of relatedBookmarkTags) {
    bookmarkTagsStore.delete(bookmarkTag.id)
  }

  tagsStore.delete(tagId)
  await transactionDone(transaction)
}

// Merges source tags into a target tag inside one transaction: bookmark
// relations are remapped (the `bookmarkId:tagId` primary key makes the remap
// idempotent), source names are kept as aliases so future suggestions resolve
// to the survivor, and the source tags are deleted.
export async function mergeTags({
  sourceTagIds,
  targetTagId
}: {
  sourceTagIds: string[]
  targetTagId: string
}): Promise<{ target: TagRecord; mergedTagIds: string[]; remappedCount: number }> {
  const uniqueSourceIds = [...new Set(sourceTagIds)].filter((tagId) => tagId && tagId !== targetTagId)

  const db = await getBookmarksDb()
  const transaction = db.transaction([TAGS_STORE, BOOKMARK_TAGS_STORE], "readwrite")
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const target = (await requestToPromise(tagsStore.get(targetTagId))) as TagRecord | undefined

  if (!target) {
    await transactionDone(transaction)
    throw new Error("Target tag not found")
  }

  const aliases = new Set(target.aliases ?? [])
  const mergedTagIds: string[] = []
  let remappedCount = 0

  for (const sourceTagId of uniqueSourceIds) {
    const source = (await requestToPromise(tagsStore.get(sourceTagId))) as TagRecord | undefined
    if (!source) {
      continue
    }

    const relations = (await requestToPromise(
      bookmarkTagsStore.index("tagId").getAll(sourceTagId)
    )) as BookmarkTagRecord[]

    for (const relation of relations) {
      const targetRelationId = createBookmarkTagId(relation.bookmarkId, targetTagId)
      const existing = await requestToPromise(bookmarkTagsStore.get(targetRelationId))

      if (!existing) {
        bookmarkTagsStore.put({
          id: targetRelationId,
          bookmarkId: relation.bookmarkId,
          tagId: targetTagId,
          createdAt: relation.createdAt
        } satisfies BookmarkTagRecord)
        remappedCount += 1
      }

      bookmarkTagsStore.delete(relation.id)
    }

    if (canonicalTagKey(source.name) !== canonicalTagKey(target.name)) {
      aliases.add(source.name)
    }

    for (const alias of source.aliases ?? []) {
      if (canonicalTagKey(alias) !== canonicalTagKey(target.name)) {
        aliases.add(alias)
      }
    }

    tagsStore.delete(sourceTagId)
    mergedTagIds.push(sourceTagId)
  }

  const updatedTarget: TagRecord = {
    ...target,
    updatedAt: new Date().toISOString()
  }

  if (aliases.size) {
    updatedTarget.aliases = [...aliases]
  }

  tagsStore.put(updatedTarget)
  await transactionDone(transaction)

  return { target: updatedTarget, mergedTagIds, remappedCount }
}

export async function listTagsForBookmark(bookmarkId: string): Promise<TagRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARK_TAGS_STORE, TAGS_STORE], "readonly")
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTags = (await requestToPromise(
    bookmarkTagsStore.index("bookmarkId").getAll(bookmarkId)
  )) as BookmarkTagRecord[]

  const tags = await Promise.all(bookmarkTags.map((bookmarkTag) => requestToPromise(tagsStore.get(bookmarkTag.tagId))))
  await transactionDone(transaction)

  return (tags.filter(Boolean) as TagRecord[]).sort((left, right) => left.name.localeCompare(right.name))
}

export async function listBookmarksByTag(tagId: string): Promise<BookmarkRecord[]> {
  const db = await getBookmarksDb()
  const transaction = db.transaction([BOOKMARK_TAGS_STORE, BOOKMARKS_STORE], "readonly")
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE)
  const bookmarkTags = (await requestToPromise(bookmarkTagsStore.index("tagId").getAll(tagId))) as BookmarkTagRecord[]

  const bookmarks = await Promise.all(
    bookmarkTags.map((bookmarkTag) => requestToPromise(bookmarksStore.get(bookmarkTag.bookmarkId)))
  )

  await transactionDone(transaction)
  return bookmarks.filter(Boolean) as BookmarkRecord[]
}
