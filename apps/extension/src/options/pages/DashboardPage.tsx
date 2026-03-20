import React, { useMemo } from "react"
import { Button, Grid, Group, SimpleGrid, Stack, Text } from "@mantine/core"
import { DashboardHeatmap } from "../components/DashboardHeatmap.tsx"
import { useWorkspaceCommands } from "../hooks/useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries.ts"
import { buildDashboardModel } from "../lib/dashboard.ts"
import type { InboxRouteState } from "../lib/navigation.ts"
import { MetricCard, SectionHeader, StatusBadge, SurfaceCard } from "../../ui/components.tsx"

interface DashboardPageProps {
  onOpenInbox: (routeState?: InboxRouteState) => void
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "not yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed)
}

function formatPercent(value: number) {
  return `${value}%`
}

export function DashboardPage({ onOpenInbox }: DashboardPageProps) {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    bookmarks: queries.bookmarks,
    refreshData: queries.refreshData
  })

  const model = useMemo(
    () =>
      buildDashboardModel({
        bookmarks: queries.bookmarks,
        bookmarkFolders: queries.bookmarkFolders,
        tags: queries.tags,
        bookmarkTags: queries.bookmarkTags,
        folders: queries.folders,
        summary: queries.summary,
        latestSyncRun: queries.latestSyncRun
      }),
    [queries.bookmarkFolders, queries.bookmarkTags, queries.bookmarks, queries.folders, queries.latestSyncRun, queries.summary, queries.tags]
  )

  return (
    <Stack gap="lg">
      <SectionHeader
        title="Dashboard"
        description="A compact overview of workspace size, sync state, and publish-date activity."
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <SurfaceCard title="Workspace snapshot" description="Keep the dashboard focused on totals and activity, then use the left navigation for deeper work.">
            <Text fw={700} size="xl">
              {model.metrics.totalBookmarks} bookmarks in the workspace
            </Text>
            <Text c="dimmed">
              {model.metrics.inboxCount} still in Inbox, {model.metrics.organizedCount} filed, {model.metrics.untaggedCount} still untagged.
            </Text>
            {queries.isLoading ? <Text size="sm" c="dimmed">Refreshing workspace snapshot...</Text> : null}
            {queries.loadError ? <Text c="red">Latest load error: {queries.loadError}</Text> : null}
          </SurfaceCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <SurfaceCard title="Sync health" description="Keep manual sync visible here and leave operational detail in Settings.">
            <Group justify="space-between" align="start">
              <Stack gap={4}>
                <Group gap="xs">
                  <StatusBadge status={commands.isSyncing ? "running" : model.sync.status} />
                  <Text c="dimmed">Last synced: {formatTimestamp(model.sync.lastSyncedAt)}</Text>
                </Group>
                <Text size="sm">Latest run: {model.sync.latestRunStatus}</Text>
                {model.sync.latestRunFinishedAt ? <Text size="sm">Finished: {formatTimestamp(model.sync.latestRunFinishedAt)}</Text> : null}
              </Stack>
              <Button type="button" color="dark" onClick={() => void commands.handleSync()} disabled={commands.isSyncing}>
                {commands.isSyncing ? "Syncing..." : "Sync now"}
              </Button>
            </Group>

            <Group gap="md" wrap="wrap">
              <Text size="sm">Fetched {model.sync.fetchedCount}</Text>
              <Text size="sm">Inserted {model.sync.insertedCount}</Text>
              <Text size="sm">Updated {model.sync.updatedCount}</Text>
              <Text size="sm">Failed {model.sync.failedCount}</Text>
            </Group>

            {model.sync.errorSummary ? <Text c="red">Latest error: {model.sync.errorSummary}</Text> : null}
          </SurfaceCard>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        <MetricCard label="Total bookmarks" value={String(model.metrics.totalBookmarks)} hint="All bookmarks currently available in the local workspace." />
        <MetricCard label="Pending in Inbox" value={String(model.metrics.inboxCount)} hint="Bookmarks still waiting for final filing." />
        <MetricCard label="Tagged coverage" value={formatPercent(model.pressure.taggedShare)} hint={`${model.metrics.taggedCount} bookmarks already carry at least one tag.`} />
        <MetricCard label="Folders / Tags" value={`${model.metrics.foldersCount} / ${model.metrics.tagsCount}`} hint="Current organization system coverage." />
      </SimpleGrid>

      <SurfaceCard title="Publish activity" description="Calendar heatmap of bookmark publish dates over the last 12 weeks. Click an active day to open Inbox with that publish date focused.">
        <DashboardHeatmap
          weeks={model.heatmap.weeks}
          totalPublishedInWindow={model.heatmap.totalPublishedInWindow}
          busiestDayCount={model.heatmap.busiestDayCount}
          busiestDayDate={model.heatmap.busiestDayDate}
          onSelectDate={(date) => onOpenInbox({ publishedDate: date })}
        />
      </SurfaceCard>
    </Stack>
  )
}
