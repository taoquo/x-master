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
//
// Note for future readers: this runs in the options-page realm and writes
// tag-suggestions there, while the auto-tag pipeline writes the same store from the
// background worker. The two are not serialized. That is tolerable because both
// operations are idempotent (rejecting by name, skipping existing ids) and because
// a restore or reset clears the run state so a live pipeline stops at its next
// batch boundary — but it is why `suggestions/*` writes go through the worker
// while this one does not.
export async function deleteTagsPermanently(
  targets: Array<{ tagId: string; tagName?: string }>
): Promise<{ deletedTagIds: string[]; blockedTagKeys: string[] }> {
  const uniqueTargets = new Map(targets.filter((target) => target.tagId).map((target) => [target.tagId, target]))
  if (!uniqueTargets.size) {
    return { deletedTagIds: [], blockedTagKeys: [] }
  }

  // Names are resolved from storage, never from the caller. The UI supplies them
  // from a workspace snapshot that can be stale, and a stale id used to block the
  // name of a tag that still existed — which silently stopped auto-tagging from
  // ever suggesting that concept again while the tag sat in the library.
  const tagsBefore = await getAllTags()
  const nameById = new Map(tagsBefore.map((tag) => [tag.id, tag.name]))
  const existingIds = [...uniqueTargets.keys()].filter((tagId) => nameById.has(tagId))

  const { deletedTagIds } = await deleteTags(existingIds)
  const resolvedNames = deletedTagIds
    .map((tagId) => nameById.get(tagId))
    .filter((name): name is string => Boolean(name))

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
