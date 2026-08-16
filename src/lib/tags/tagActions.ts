import { getSettings, updateSettings } from "../storage/settings.ts"
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

  const settings = await getSettings()
  const missingKeys = keys.filter((key) => !settings.autoTag.blockedTagKeys.includes(key))

  if (missingKeys.length) {
    await updateSettings({
      autoTag: { ...settings.autoTag, blockedTagKeys: [...settings.autoTag.blockedTagKeys, ...missingKeys] }
    })
  }

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

  const settings = await getSettings()
  if (!settings.autoTag.blockedTagKeys.includes(key)) {
    return
  }

  await updateSettings({
    autoTag: {
      ...settings.autoTag,
      blockedTagKeys: settings.autoTag.blockedTagKeys.filter((blocked) => blocked !== key)
    }
  })
}
