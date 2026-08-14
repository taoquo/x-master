import { getAllBookmarks } from "../storage/bookmarksStore.ts"
import { getSettings } from "../storage/settings.ts"
import { getLatestSyncRun } from "../storage/syncRunsStore.ts"
import { getAllBookmarkTags, getAllTags } from "../storage/tagsStore.ts"
import type { WorkspaceData } from "../types.ts"
import { buildWorkspaceStats } from "./stats.ts"

export async function loadWorkspaceDataFromLocal(): Promise<WorkspaceData> {
  const [bookmarks, tags, bookmarkTags, settings, latestSyncRun] = await Promise.all([
    getAllBookmarks(),
    getAllTags(),
    getAllBookmarkTags(),
    getSettings(),
    getLatestSyncRun()
  ])

  return {
    bookmarks,
    tags,
    bookmarkTags,
    savedViews: settings.savedViews,
    summary: settings.lastSyncSummary,
    latestSyncRun,
    stats: buildWorkspaceStats({
      bookmarks,
      tags,
      bookmarkTags
    })
  }
}
