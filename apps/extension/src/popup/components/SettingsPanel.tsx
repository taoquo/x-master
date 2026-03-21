import React from "react"
import { Badge, Button, Group, Stack, Text } from "@mantine/core"
import type { BookmarkRecord, SyncRunRecord, SyncSummary, TagRecord } from "../../lib/types.ts"
import { StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"

interface SettingsPanelProps {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  summary: SyncSummary
  latestSyncRun: SyncRunRecord | null
  onExport: () => string | Promise<string>
  onReset: () => Promise<void> | void
  isResetting: boolean
  compact?: boolean
}

export function SettingsPanel({
  bookmarks,
  tags,
  summary,
  latestSyncRun,
  onExport,
  onReset,
  isResetting,
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

          <Group gap="sm" wrap="wrap">
            <Button type="button" color="dark" onClick={() => void onExport()}>
              Export bookmarks
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
