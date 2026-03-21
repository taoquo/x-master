import React, { useMemo } from "react"
import { Badge, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core"
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
        tags: queries.tags,
        bookmarkTags: queries.bookmarkTags,
        summary: queries.summary
      }),
    [queries.bookmarkTags, queries.bookmarks, queries.summary, queries.tags]
  )

  return (
    <Stack gap="md">
      <SectionHeader
        title="Dashboard"
        description="A compact overview of workspace size, sync state, and publish-date activity."
        actions={
          <>
            <Button type="button" variant="light" color="gray" onClick={() => onOpenInbox()}>
              Open Inbox
            </Button>
            <Button type="button" color="dark" onClick={() => void commands.handleSync()} disabled={commands.isSyncing}>
              {commands.isSyncing ? "Syncing..." : "Sync now"}
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SurfaceCard title="Workspace snapshot" description="Keep the dashboard focused on totals and activity, then use navigation for deeper filing work.">
          <Stack gap="md">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="dark">
                {model.metrics.totalBookmarks} bookmarks
              </Badge>
              <Badge variant="light" color="gray">
                {model.metrics.tagsCount} tags
              </Badge>
              <Badge variant="light" color="blue">
                {model.metrics.inboxCount} in Inbox
              </Badge>
            </Group>

            <Text fw={700} size="xl">
              {model.metrics.totalBookmarks} bookmarks in the workspace
            </Text>

            <Text c="dimmed">
              {model.metrics.inboxCount} still in Inbox, {model.metrics.taggedCount} already tagged and available for library review.
            </Text>

            {queries.isLoading ? <Text size="sm" c="dimmed">Refreshing workspace snapshot...</Text> : null}
            {queries.loadError ? <Text c="red">Latest load error: {queries.loadError}</Text> : null}
          </Stack>
        </SurfaceCard>

        <SurfaceCard title="Sync health" description="Keep manual sync visible here and leave detailed operational history in Settings.">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="xs" wrap="wrap">
                <StatusBadge status={commands.isSyncing ? "running" : model.sync.status} />
                <Text c="dimmed" size="sm">
                  Last synced: {formatTimestamp(model.sync.lastSyncedAt)}
                </Text>
              </Group>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="gray">
                Fetched {model.sync.fetchedCount}
              </Badge>
              <Badge variant="light" color="gray">
                Inserted {model.sync.insertedCount}
              </Badge>
              <Badge variant="light" color="gray">
                Updated {model.sync.updatedCount}
              </Badge>
              <Badge variant="light" color={model.sync.failedCount ? "red" : "gray"}>
                Failed {model.sync.failedCount}
              </Badge>
            </Group>

            {model.sync.errorSummary ? <Text c="red">Latest error: {model.sync.errorSummary}</Text> : null}
          </Stack>
        </SurfaceCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        <MetricCard label="Total bookmarks" value={String(model.metrics.totalBookmarks)} hint="All bookmarks currently available in the local workspace." />
        <MetricCard label="Pending in Inbox" value={String(model.metrics.inboxCount)} hint="Bookmarks still waiting for their first tag." />
        <MetricCard label="Tagged coverage" value={formatPercent(model.pressure.taggedShare)} hint={`${model.metrics.taggedCount} bookmarks already carry at least one tag.`} />
        <MetricCard label="Tags defined" value={String(model.metrics.tagsCount)} hint="Current shared taxonomy available for filing and review." />
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
