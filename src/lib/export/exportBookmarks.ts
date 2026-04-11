import type {
  BookmarkListRecord,
  BookmarkRecord,
  BookmarkTagRecord,
  ExtensionSettings,
  ListRecord,
  SyncRunRecord,
  SyncSummary,
  TagRecord,
  WorkspaceData
} from "../types.ts"

export const WORKSPACE_EXPORT_VERSION = 1

export interface WorkspaceExportSettings {
  schemaVersion: number
  locale: ExtensionSettings["locale"]
  themePreference: ExtensionSettings["themePreference"]
  classificationRules: ExtensionSettings["classificationRules"]
  lastSyncSummary?: SyncSummary
}

export type WorkspaceExportBookmarkRecord = Omit<BookmarkRecord, "rawPayload">

export interface WorkspaceExportPayload {
  exportVersion: number
  schemaVersion: number
  exportedAt: string
  bookmarks: WorkspaceExportBookmarkRecord[]
  lists: ListRecord[]
  bookmarkLists: BookmarkListRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  classificationRules: ExtensionSettings["classificationRules"]
  settings: WorkspaceExportSettings
  summary: SyncSummary
  latestSyncRun: SyncRunRecord | null
}

function toExportBookmark(bookmark: BookmarkRecord): WorkspaceExportBookmarkRecord {
  const { rawPayload: _rawPayload, ...exportableBookmark } = bookmark
  return exportableBookmark
}

export function createWorkspaceExportPayload({
  workspace,
  settings,
  exportedAt = new Date().toISOString()
}: {
  workspace: WorkspaceData
  settings: ExtensionSettings
  exportedAt?: string
}): WorkspaceExportPayload {
  return {
    exportVersion: WORKSPACE_EXPORT_VERSION,
    schemaVersion: settings.schemaVersion,
    exportedAt,
    bookmarks: workspace.bookmarks.map(toExportBookmark),
    lists: workspace.lists,
    bookmarkLists: workspace.bookmarkLists,
    tags: workspace.tags,
    bookmarkTags: workspace.bookmarkTags,
    classificationRules: settings.classificationRules,
    settings: {
      schemaVersion: settings.schemaVersion,
      locale: settings.locale,
      themePreference: settings.themePreference,
      classificationRules: settings.classificationRules,
      lastSyncSummary: settings.lastSyncSummary
    },
    summary: workspace.summary,
    latestSyncRun: workspace.latestSyncRun
  }
}

export function createWorkspaceExportFilename(exportedAt: string | Date = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt)
  const resolvedDate = Number.isNaN(date.getTime()) ? new Date() : date
  const year = resolvedDate.getUTCFullYear()
  const month = String(resolvedDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(resolvedDate.getUTCDate()).padStart(2, "0")

  return `xbm-workspace-${year}-${month}-${day}.json`
}

export function exportBookmarks({
  workspace,
  settings,
  exportedAt
}: {
  workspace: WorkspaceData
  settings: ExtensionSettings
  exportedAt?: string
}) {
  return JSON.stringify(createWorkspaceExportPayload({ workspace, settings, exportedAt }), null, 2)
}
