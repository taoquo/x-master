import type { BookmarkRecord, BookmarkTagRecord, TagRecord, TagSuggestionRecord } from "../types.ts"
import { canonicalTagKey, normalizeTagDisplayName } from "../tags/canonical.ts"
import {
  BOOKMARKS_STORE,
  BOOKMARK_TAGS_STORE,
  getBookmarksDb,
  requestToPromise,
  TAG_SUGGESTIONS_STORE,
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
  const transaction = db.transaction([TAGS_STORE, TAG_SUGGESTIONS_STORE], "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const existing = (await requestToPromise(store.get(tagId))) as TagRecord | undefined

  if (!existing) {
    throw new Error("Tag not found")
  }

  // createTag and updateTagAliases both refuse to let two tags share a canonical
  // identity; rename did not, so it could produce two tags named "rust" and
  // "Rust" — after which every name lookup (accepting a suggestion, auto-creating
  // a tag) silently picked whichever row IndexedDB returned first. Aliases count
  // too: turning a tag into another tag's alias splits the concept, because
  // findTagByName prefers a real name over an alias.
  const canonicalKey = canonicalTagKey(trimmedName)
  const allTags = (await requestToPromise(store.getAll())) as TagRecord[]
  const collision = allTags.find((tag) => {
    if (tag.id === tagId) {
      return false
    }

    return (
      canonicalTagKey(tag.name) === canonicalKey ||
      (tag.aliases ?? []).some((alias) => canonicalTagKey(alias) === canonicalKey)
    )
  })

  if (collision) {
    await transactionDone(transaction)
    throw new Error(`Another tag already uses "${collision.name}" as its name or alias`)
  }

  // Pending suggestions are keyed and labelled by the tag's name, so they have to
  // move with it. Left behind they stayed pending under the old name, and
  // accepting one later found no match and created a SECOND tag for the concept
  // the user had just renamed.
  const previousKeys = new Set(
    [existing.name, ...(existing.aliases ?? [])].map((name) => canonicalTagKey(name)).filter(Boolean)
  )
  previousKeys.delete(canonicalKey)

  if (previousKeys.size) {
    const suggestionsStore = transaction.objectStore(TAG_SUGGESTIONS_STORE)
    const suggestions = (await requestToPromise(suggestionsStore.getAll())) as TagSuggestionRecord[]
    const existingIds = new Set(suggestions.map((suggestion) => suggestion.id))

    for (const suggestion of suggestions) {
      if (suggestion.status !== "pending" || !previousKeys.has(canonicalTagKey(suggestion.tagName))) {
        continue
      }

      const nextId = `${suggestion.bookmarkId}::${canonicalKey}`
      suggestionsStore.delete(suggestion.id)

      // A suggestion for the new name may already exist; that one is the same
      // proposal, so the old row is simply dropped rather than duplicated.
      if (!existingIds.has(nextId)) {
        suggestionsStore.put({ ...suggestion, id: nextId, tagName: trimmedName })
        existingIds.add(nextId)
      }
    }
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

// The taxonomy is deliberately capped at two levels (theme -> tag). A flat-ish
// tree keeps the sidebar, the tag library and the future relation graph
// readable, and it makes parent cycles structurally impossible.
export async function setTagParent({
  tagId,
  parentId
}: {
  tagId: string
  parentId?: string
}): Promise<TagRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const allTags = (await requestToPromise(store.getAll())) as TagRecord[]
  const existing = allTags.find((tag) => tag.id === tagId)

  if (!existing) {
    await transactionDone(transaction)
    throw new Error("Tag not found")
  }

  const nextParentId = parentId?.trim() ? parentId.trim() : undefined

  if (nextParentId === tagId) {
    await transactionDone(transaction)
    throw new Error("A tag cannot be its own parent")
  }

  if (nextParentId) {
    const parent = allTags.find((tag) => tag.id === nextParentId)

    if (!parent) {
      await transactionDone(transaction)
      throw new Error("Parent tag not found")
    }

    if (parent.parentId) {
      await transactionDone(transaction)
      throw new Error("Tag hierarchy is limited to two levels")
    }

    if (allTags.some((tag) => tag.parentId === tagId)) {
      await transactionDone(transaction)
      throw new Error("Tag hierarchy is limited to two levels")
    }
  }

  const { parentId: _previousParentId, ...rest } = existing
  const updatedTag: TagRecord = { ...rest, updatedAt: new Date().toISOString() }

  if (nextParentId) {
    updatedTag.parentId = nextParentId
  }

  store.put(updatedTag)
  await transactionDone(transaction)
  return updatedTag
}

// Aliases are the manual counterpart of a merge: they let a tag absorb wording
// variants without creating records. Anything that would collide with the tag
// itself or with another tag is dropped instead of throwing, so a paste-heavy
// edit still saves the useful part.
export async function updateTagAliases({
  tagId,
  aliases
}: {
  tagId: string
  aliases: string[]
}): Promise<TagRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const allTags = (await requestToPromise(store.getAll())) as TagRecord[]
  const existing = allTags.find((tag) => tag.id === tagId)

  if (!existing) {
    await transactionDone(transaction)
    throw new Error("Tag not found")
  }

  // Every canonical identity another tag already claims: its name and its own
  // aliases. Blocking only names let two tags advertise the same alias, after
  // which which one wins a suggestion depended on the order IndexedDB returned.
  const blockedKeys = new Set<string>()
  for (const tag of allTags) {
    if (tag.id === tagId) {
      continue
    }

    blockedKeys.add(canonicalTagKey(tag.name))
    for (const alias of tag.aliases ?? []) {
      blockedKeys.add(canonicalTagKey(alias))
    }
  }

  blockedKeys.add(canonicalTagKey(existing.name))

  const nextAliases: string[] = []
  const seenKeys = new Set<string>()

  for (const alias of aliases) {
    const normalized = normalizeTagDisplayName(alias)
    if (!normalized) {
      continue
    }

    const key = canonicalTagKey(normalized)
    if (!key || blockedKeys.has(key) || seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    nextAliases.push(normalized)
  }

  const { aliases: _previousAliases, ...rest } = existing
  const updatedTag: TagRecord = { ...rest, updatedAt: new Date().toISOString() }

  if (nextAliases.length) {
    updatedTag.aliases = nextAliases
  }

  store.put(updatedTag)
  await transactionDone(transaction)
  return updatedTag
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
  await deleteTags([tagId])
}

// Batch version of deleteTag. Bulk deletion in the tag manager used to call
// deleteTag once per tag, which meant one transaction plus one full tags scan
// each time; deleting 20 tags now costs a single transaction.
export async function deleteTags(tagIds: string[]): Promise<{ deletedTagIds: string[] }> {
  const uniqueTagIds = [...new Set(tagIds.filter(Boolean))]
  if (!uniqueTagIds.length) {
    return { deletedTagIds: [] }
  }

  const deletedIds = new Set(uniqueTagIds)
  const db = await getBookmarksDb()
  const transaction = db.transaction([TAGS_STORE, BOOKMARK_TAGS_STORE], "readwrite")
  const tagsStore = transaction.objectStore(TAGS_STORE)
  const bookmarkTagsStore = transaction.objectStore(BOOKMARK_TAGS_STORE)
  // Every read is issued before the first await so the transaction cannot
  // auto-commit between them.
  const relationRequests = uniqueTagIds.map((tagId) => bookmarkTagsStore.index("tagId").getAll(tagId))
  const allTagsRequest = tagsStore.getAll()
  const relationGroups = (await Promise.all(
    relationRequests.map((request) => requestToPromise(request))
  )) as BookmarkTagRecord[][]
  const allTags = (await requestToPromise(allTagsRequest)) as TagRecord[]

  for (const relations of relationGroups) {
    for (const bookmarkTag of relations) {
      bookmarkTagsStore.delete(bookmarkTag.id)
    }
  }

  // Children would otherwise point at a tag that no longer exists.
  const updatedAt = new Date().toISOString()
  for (const child of allTags) {
    if (deletedIds.has(child.id) || !child.parentId || !deletedIds.has(child.parentId)) {
      continue
    }

    const { parentId: _droppedParentId, ...rest } = child
    tagsStore.put({ ...rest, updatedAt } satisfies TagRecord)
  }

  for (const tagId of uniqueTagIds) {
    tagsStore.delete(tagId)
  }

  await transactionDone(transaction)
  return { deletedTagIds: uniqueTagIds }
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
  // Both reads are issued before the first await so the transaction cannot
  // auto-commit between them.
  const targetRequest = tagsStore.get(targetTagId)
  const allTagsRequest = tagsStore.getAll()
  const target = (await requestToPromise(targetRequest)) as TagRecord | undefined
  const allTags = (await requestToPromise(allTagsRequest)) as TagRecord[]

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

  // Children of a merged tag follow the survivor, unless the survivor is itself
  // a child — the taxonomy stays two levels deep, so they become roots instead.
  if (mergedTagIds.length) {
    const mergedIdSet = new Set(mergedTagIds)
    // The survivor's parent may itself be one of the merged tags, in which case it
    // is about to become a root (below). Deciding on the stale parentId would send
    // its children to the root level even though the survivor ends up a root they
    // could follow.
    const survivorEndsUpRoot = !target.parentId || mergedIdSet.has(target.parentId)

    for (const child of allTags) {
      if (!child.parentId || !mergedIdSet.has(child.parentId)) {
        continue
      }

      // A merged source was just deleted; re-putting it would resurrect it.
      if (child.id === targetTagId || mergedIdSet.has(child.id)) {
        continue
      }

      const { parentId: _droppedParentId, ...rest } = child
      const reparented: TagRecord = { ...rest, updatedAt: new Date().toISOString() }

      if (survivorEndsUpRoot) {
        reparented.parentId = targetTagId
      }

      tagsStore.put(reparented)
    }
  }

  const updatedTarget: TagRecord = {
    ...target,
    updatedAt: new Date().toISOString()
  }

  // The survivor may itself have been parented under one of the merged tags.
  if (updatedTarget.parentId && mergedTagIds.includes(updatedTarget.parentId)) {
    delete updatedTarget.parentId
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
