import { getSettings, updateSettings } from "../storage/settings.ts"
import { rejectPendingSuggestionsByTagName } from "../storage/suggestionsStore.ts"
import { deleteTag, getAllTags } from "../storage/tagsStore.ts"
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
  const resolvedName = tagName ?? (await getAllTags()).find((tag) => tag.id === tagId)?.name

  await deleteTag(tagId)

  if (!resolvedName) {
    return { blockedTagKey: null }
  }

  await rejectPendingSuggestionsByTagName(resolvedName)

  const key = canonicalTagKey(resolvedName)
  if (!key) {
    return { blockedTagKey: null }
  }

  const settings = await getSettings()
  if (settings.autoTag.blockedTagKeys.includes(key)) {
    return { blockedTagKey: key }
  }

  await updateSettings({
    autoTag: { ...settings.autoTag, blockedTagKeys: [...settings.autoTag.blockedTagKeys, key] }
  })

  return { blockedTagKey: key }
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
