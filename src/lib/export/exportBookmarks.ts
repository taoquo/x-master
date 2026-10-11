import type {
  BookmarkRecord,
  BookmarkTagRecord,
  ExtensionSettings,
  SyncRunRecord,
  SyncSummary,
  TagRecord,
  WorkspaceData
} from "../types.ts"

export const WORKSPACE_EXPORT_VERSION = 2

export interface WorkspaceExportSettings {
  schemaVersion: number
  locale: ExtensionSettings["locale"]
  themePreference: ExtensionSettings["themePreference"]
  savedViews?: ExtensionSettings["savedViews"]
  lastSyncSummary?: SyncSummary
  // Provider id + model only: never the endpoint, never a credential.
  activeProviderId?: string
  model?: string
}

export type WorkspaceExportBookmarkRecord = BookmarkRecord

export interface WorkspaceExportPayload {
  exportVersion: number
  schemaVersion: number
  exportedAt: string
  bookmarks: WorkspaceExportBookmarkRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  settings: WorkspaceExportSettings
  summary: SyncSummary
  latestSyncRun: SyncRunRecord | null
}

function toExportBookmark(bookmark: BookmarkRecord): WorkspaceExportBookmarkRecord {
  const { rawPayload: _rawPayload, ...exportableBookmark } = bookmark as BookmarkRecord & { rawPayload?: unknown }
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
    tags: workspace.tags,
    bookmarkTags: workspace.bookmarkTags,
    settings: {
      schemaVersion: settings.schemaVersion,
      locale: settings.locale,
      themePreference: settings.themePreference,
      savedViews: settings.savedViews,
      lastSyncSummary: settings.lastSyncSummary,
      // Which model the user picked travels with the backup; the endpoint and every
      // credential do not. A restored baseUrl would silently point this install at
      // someone else's gateway, and a key must never leave the machine at all.
      activeProviderId: settings.autoTag.llm.activeProviderId,
      model: settings.autoTag.llm.model
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
