import { updateSettings } from "../storage/settings.ts"
import { rejectPendingSuggestionsByTagNames } from "../storage/suggestionsStore.ts"
import { deleteTags, getAllTags } from "../storage/tagsStore.ts"
import { canonicalTagKey } from "./canonical.ts"

// Deleting a tag has to do three things, otherwise the tag comes back:
//   1. drop the tag and its bookmark relations,
//   2. reject every pending suggestion for that name (accepting one would
//      recreate the tag through ensureTagByName),
//   3. remember the canonical key so the rule engine and the LLM step never
//      suggest it again.
// Re-creating the tag by hand clears the block (see createTagUnblocked).
export async function deleteTagPermanently({
  tagId,
  tagName
}: {
  tagId: string
  tagName?: string
}): Promise<{ blockedTagKey: string | null }> {
  const { blockedTagKeys } = await deleteTagsPermanently([{ tagId, tagName }])
  return { blockedTagKey: blockedTagKeys[0] ?? null }
}

// Batch form of deleteTagPermanently: one tags transaction, one suggestions
// scan and one settings write no matter how many tags the user selected. The
// tag manager's bulk delete used to run the single-tag path in a loop, which
// cost three round trips per tag.
export async function deleteTagsPermanently(
  targets: Array<{ tagId: string; tagName?: string }>
): Promise<{ deletedTagIds: string[]; blockedTagKeys: string[] }> {
  const uniqueTargets = new Map(targets.filter((target) => target.tagId).map((target) => [target.tagId, target]))
  if (!uniqueTargets.size) {
    return { deletedTagIds: [], blockedTagKeys: [] }
  }

  const needsLookup = [...uniqueTargets.values()].some((target) => !target.tagName)
  const nameById = needsLookup ? new Map((await getAllTags()).map((tag) => [tag.id, tag.name])) : new Map<string, string>()
  const resolvedNames: string[] = []

  for (const target of uniqueTargets.values()) {
    const name = target.tagName ?? nameById.get(target.tagId)
    if (name) {
      resolvedNames.push(name)
    }
  }

  const { deletedTagIds } = await deleteTags([...uniqueTargets.keys()])

  if (!resolvedNames.length) {
    return { deletedTagIds, blockedTagKeys: [] }
  }

  await rejectPendingSuggestionsByTagNames(resolvedNames)

  const keys = [...new Set(resolvedNames.map((name) => canonicalTagKey(name)).filter(Boolean))]
  if (!keys.length) {
    return { deletedTagIds, blockedTagKeys: [] }
  }

  await updateSettings((current) => ({
    autoTag: {
      ...current.autoTag,
      blockedTagKeys: [...new Set([...current.autoTag.blockedTagKeys, ...keys])]
    }
  }))

  return { deletedTagIds, blockedTagKeys: keys }
}

// Removes a canonical key from the block list. Called whenever the user
// deliberately creates a tag again, so a past deletion never silently blocks a
// name the user now wants.
export async function unblockTagKey(tagName: string) {
  const key = canonicalTagKey(tagName)
  if (!key) {
    return
  }

  await updateSettings((current) => ({
    autoTag: {
      ...current.autoTag,
      blockedTagKeys: current.autoTag.blockedTagKeys.filter((blocked) => blocked !== key)
    }
  }))
}

// Empties the block list in one go. Bulk deletions can block hundreds of names,
// including mainstream subjects the user never meant to ban forever, which
// starves both the rules and the LLM with no visible cause.
export async function clearBlockedTagKeys() {
  await updateSettings((current) => ({
    autoTag: {
      ...current.autoTag,
      blockedTagKeys: []
    }
  }))
}
