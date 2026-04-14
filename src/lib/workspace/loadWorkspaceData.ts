import { getAllBookmarks } from "../storage/bookmarksStore.ts"
import { getAllBookmarkLists, getAllLists } from "../storage/listsStore.ts"
import { getSettings } from "../storage/settings.ts"
import { getLatestSyncRun } from "../storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../storage/tagsStore.ts"
import type { WorkspaceData } from "../types.ts"
import { buildWorkspaceStats } from "./stats.ts"

export async function loadWorkspaceDataFromLocal(): Promise<WorkspaceData> {
  const [bookmarks, lists, bookmarkLists, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
    getAllBookmarks(),
    getAllLists(),
    getAllBookmarkLists(),
    getAllTags(),
    getAllBookmarkTags(),
    getSettings(),
    getLatestSyncRun()
  ])

  return {
    bookmarks,
    lists,
    bookmarkLists,
    tags,
    bookmarkTags,
    classificationRules: settings.classificationRules,
    summary: settings.lastSyncSummary,
    latestSyncRun,
    stats: buildWorkspaceStats({
      bookmarks,
      lists,
      bookmarkLists,
      tags,
      bookmarkTags
    })
  }
}
