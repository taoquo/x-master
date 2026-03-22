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
    knowledgeCards: queries.knowledgeCards,
    bookmarkTags: queries.bookmarkTags,
    tags: queries.tags,
    refreshData: queries.refreshData
  })

  const model = useMemo(
    () =>
      buildDashboardModel({
        bookmarks: queries.bookmarks,
        knowledgeCards: queries.knowledgeCards,
        tags: queries.tags,
        bookmarkTags: queries.bookmarkTags,
        summary: queries.summary
      }),
    [queries.bookmarkTags, queries.bookmarks, queries.knowledgeCards, queries.summary, queries.tags]
  )

  return (
    <Stack gap="md">
      <SectionHeader
        title="Dashboard"
        description="See what needs attention in the source-to-card pipeline, then jump straight into the right queue."
        actions={
          <>
            <Button type="button" variant="light" color="gray" onClick={() => onOpenInbox()}>
              Open source queue
            </Button>
            <Button type="button" color="dark" onClick={() => void commands.handleSync()} disabled={commands.isSyncing}>
              {commands.isSyncing ? "Syncing..." : "Sync now"}
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <SurfaceCard title="Pipeline snapshot" description="A quick read on the whole pipeline, from saved source material to reusable cards.">
          <Stack gap="md">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="gray">
                {model.metrics.totalBookmarks} source items
              </Badge>
              <Badge variant="light" color="blue">
                {queries.knowledgeCards.length} card drafts
              </Badge>
              <Badge variant="light" color={model.metrics.staleCount ? "red" : "gray"}>
                {model.metrics.staleCount} stale
              </Badge>
              <Badge variant="light" color="gray">
                {model.metrics.tagsCount} tags
              </Badge>
              <Badge variant="light" color="blue">
                {model.metrics.inboxCount} in source queue
              </Badge>
            </Group>

            <Text fw={700} size="xl">
              {model.metrics.totalBookmarks} source items feeding {queries.knowledgeCards.length} card drafts
            </Text>

            <Text c="dimmed">
              {model.metrics.inboxCount} source items still need triage, {model.metrics.draftCount} cards need review, and {model.metrics.reviewedCount} cards are already library-ready.
            </Text>
            <Text c="dimmed">
              {model.metrics.reviewedCount} reviewed, {model.metrics.draftCount} draft, {model.metrics.staleCount} stale.
            </Text>

            {queries.isLoading ? <Text size="sm" c="dimmed">Refreshing workspace snapshot...</Text> : null}
            {queries.loadError ? <Text c="red">Latest load error: {queries.loadError}</Text> : null}
          </Stack>
        </SurfaceCard>

        <SurfaceCard title="Sync health" description="Keep source ingestion visible here and leave lower-level operational detail in Settings.">
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
        <MetricCard label="Source queue" value={String(model.metrics.inboxCount)} hint="Source materials still waiting for their first organizational pass." />
        <MetricCard label="Draft queue" value={String(model.metrics.draftCount)} hint="Generated cards that still need a human review." />
        <MetricCard label="Reviewed library" value={String(model.metrics.reviewedCount)} hint="Cards that are stable enough to export or revisit." />
        <MetricCard label="Stale review" value={String(model.metrics.staleCount)} hint={`${formatPercent(model.pressure.staleShare)} of generated cards need another review.`} />
      </SimpleGrid>

      <SurfaceCard title="Publish activity" description="Calendar heatmap of source publish dates over the last 12 weeks. Click an active day to open the source queue with that publish date focused.">
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
