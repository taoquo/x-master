import React from "react"
import { Button, Group, Stack, Text, Title } from "@mantine/core"
import type { BookmarkRecord, SyncRunRecord, TagRecord } from "../../lib/types.ts"
import { StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"

interface SettingsPanelProps {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  latestSyncRun: SyncRunRecord | null
  onExport: () => string | Promise<string>
  onReset: () => Promise<void> | void
  isResetting: boolean
  compact?: boolean
}

export function SettingsPanel({
  bookmarks,
  tags,
  latestSyncRun,
  onExport,
  onReset,
  isResetting,
  compact = false
}: SettingsPanelProps) {
  return (
    <ExtensionUiProvider>
      <SurfaceCard>
      <Stack gap={compact ? "xs" : "sm"}>
        <Group justify="space-between">
          <Title order={compact ? 4 : 3}>Workspace</Title>
          <StatusBadge status={latestSyncRun?.status ?? "idle"} />
        </Group>
        <Text>Bookmarks stored: {bookmarks.length}</Text>
        <Text>Tags stored: {tags.length}</Text>
        <Text>Latest sync status: {latestSyncRun?.status ?? "idle"}</Text>
        {latestSyncRun?.startedAt ? <Text>Latest sync started: {latestSyncRun.startedAt}</Text> : null}
        {latestSyncRun?.finishedAt ? <Text>Latest sync finished: {latestSyncRun.finishedAt}</Text> : null}
        {latestSyncRun?.errorSummary ? <Text c="red">Latest sync error: {latestSyncRun.errorSummary}</Text> : null}
        <Group gap="sm">
          <Button type="button" onClick={() => void onExport()}>
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
