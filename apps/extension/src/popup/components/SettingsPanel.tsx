import React from "react"
import { Badge, Button, Group, Stack, Text } from "@mantine/core"
import type { BookmarkRecord, KnowledgeCardDraftRecord, SyncRunRecord, SyncSummary, TagRecord } from "../../lib/types.ts"
import { StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"
import type { ExportSummary } from "../../options/hooks/useWorkspaceCommands.ts"

interface SettingsPanelProps {
  bookmarks: BookmarkRecord[]
  knowledgeCards: KnowledgeCardDraftRecord[]
  tags: TagRecord[]
  summary: SyncSummary
  latestSyncRun: SyncRunRecord | null
  onExport: () => unknown | Promise<unknown>
  onReset: () => Promise<void> | void
  isResetting: boolean
  isExporting?: boolean
  exportSummary?: ExportSummary | null
  compact?: boolean
}

export function SettingsPanel({
  bookmarks,
  knowledgeCards,
  tags,
  summary,
  latestSyncRun,
  onExport,
  onReset,
  isResetting,
  isExporting = false,
  exportSummary = null,
  compact = false
}: SettingsPanelProps) {
  return (
    <ExtensionUiProvider>
      <SurfaceCard title="Workspace" description="Export, inspect, and reset local workspace data from one place.">
        <Stack gap={compact ? "xs" : "md"}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <StatusBadge status={summary.status} />
              <Badge variant="light" color="gray">
                Bookmarks stored: {bookmarks.length}
              </Badge>
              <Badge variant="light" color="blue">
                Card drafts: {knowledgeCards.length}
              </Badge>
              <Badge variant="light" color="gray">
                Tags stored: {tags.length}
              </Badge>
            </Group>
          </Group>

          <Stack gap={6}>
            <Text>Current sync status: {summary.status}</Text>
            {summary.lastSyncedAt ? <Text>Last synced: {summary.lastSyncedAt}</Text> : null}
            {summary.errorSummary ? <Text c="red">Current sync error: {summary.errorSummary}</Text> : null}
            {latestSyncRun?.startedAt ? <Text>Latest recorded sync started: {latestSyncRun.startedAt}</Text> : null}
            {latestSyncRun?.finishedAt ? <Text>Latest recorded sync finished: {latestSyncRun.finishedAt}</Text> : null}
            {latestSyncRun?.errorSummary ? <Text c="red">Latest recorded sync error: {latestSyncRun.errorSummary}</Text> : null}
          </Stack>

          {exportSummary ? (
            <Stack gap={4}>
              <Text fw={600}>Last export</Text>
              <Text>{exportSummary.fileName}</Text>
              <Text size="sm" c="dimmed">
                {exportSummary.cardCount} cards, {exportSummary.sourceCount} sources, {exportSummary.reviewedCount} reviewed, {exportSummary.draftCount} drafts, {exportSummary.staleCount} stale
              </Text>
              <Text size="sm" c="dimmed">
                Exported at: {exportSummary.exportedAt}
              </Text>
            </Stack>
          ) : null}

          <Group gap="sm" wrap="wrap">
            <Button type="button" color="dark" onClick={() => void onExport()} disabled={isExporting}>
              {isExporting ? "Exporting..." : "Export Obsidian vault"}
            </Button>
            <Button type="button" variant="light" color="red" onClick={() => void onReset()} disabled={isResetting}>
              {isResetting ? "Resetting..." : "Reset local data"}
            </Button>
          </Group>
        </Stack>
      </SurfaceCard>
    </ExtensionUiProvider>
  )
}
