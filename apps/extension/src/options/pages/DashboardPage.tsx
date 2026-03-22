import React, { useMemo } from "react"
import { Badge, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { DashboardHeatmap } from "../components/DashboardHeatmap.tsx"
import { useWorkspaceCommands } from "../hooks/useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries.ts"
import { buildDashboardModel } from "../lib/dashboard.ts"
import type { InboxRouteState, LibraryRouteState } from "../lib/navigation.ts"
import { MetricCard, SectionHeader, StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import type { OnboardingStep } from "../../lib/types.ts"

interface DashboardPageProps {
  onOpenInbox: (routeState?: InboxRouteState) => void
  onOpenLibrary?: (routeState?: LibraryRouteState) => void
  onOpenSettings?: () => void
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

function getOnboardingHero(step: OnboardingStep) {
  switch (step) {
    case "sync-source":
      return {
        eyebrow: "Getting started",
        stage: "Step 1 of 4",
        title: "Pull source material into the workspace",
        description: "Run the first sync to bring saved X posts and notes into the source queue. The rest of the pipeline starts only after source material exists.",
        support: "Once source material arrives, the app can generate knowledge card drafts and start the review loop.",
        actionLabel: "Sync source material",
        action: "sync" as const
      }
    case "generate-cards":
      return {
        eyebrow: "Getting started",
        stage: "Step 2 of 4",
        title: "Enable generation and create the first draft queue",
        description: "Source material exists, but no cards have been generated yet. Turn on AI generation, save the model settings, then sync again.",
        support: "This is the first time the app stops being a capture tool and starts behaving like a card pipeline.",
        actionLabel: "Open pipeline settings",
        action: "settings" as const
      }
    case "review-cards":
      return {
        eyebrow: "Getting started",
        stage: "Step 3 of 4",
        title: "Review the first draft queue",
        description: "Your first generated cards are ready. Move into Library and turn at least one draft into a reviewed card you trust.",
        support: "That first reviewed card is the moment the workflow becomes a real knowledge asset system.",
        actionLabel: "Review draft queue",
        action: "library-draft" as const
      }
    case "export-vault":
      return {
        eyebrow: "Getting started",
        stage: "Step 4 of 4",
        title: "Export the first vault",
        description: "You have reviewed cards now. Produce the first vault export to close the loop from source capture to reusable notes.",
        support: "This is the step that turns the app into part of your long-term learning system instead of a temporary workspace.",
        actionLabel: "Open export controls",
        action: "settings" as const
      }
    case "done":
    default:
      return null
  }
}

export function DashboardPage({ onOpenInbox, onOpenLibrary, onOpenSettings }: DashboardPageProps) {
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

  const onboardingHero = getOnboardingHero(queries.onboardingStep)
  const hero = onboardingHero ?? {
    eyebrow: "Next best action",
    stage: "Workflow priority",
    title: model.recommendation.title,
    description: model.recommendation.description,
    support: "Choose the next queue based on where work is piling up and where trust is slipping.",
    actionLabel: model.recommendation.actionLabel,
    action: "recommendation" as const
  }

  const handleRecommendation = () => {
    if (model.recommendation.action === "sync") {
      void commands.handleSync()
      return
    }

    if (model.recommendation.action === "settings") {
      onOpenSettings?.()
      return
    }

    if (model.recommendation.action === "inbox") {
      onOpenInbox()
      return
    }

    if (model.recommendation.action === "library-tags") {
      onOpenLibrary?.({ view: "tags", lifecycle: "all" })
      return
    }

    if (model.recommendation.action === "library-lifecycle") {
      onOpenLibrary?.({ view: "all", lifecycle: model.recommendation.lifecycle ?? "all" })
    }
  }

  const handleHeroAction = () => {
    if (hero.action === "sync") {
      void commands.handleSync()
      return
    }

    if (hero.action === "settings") {
      onOpenSettings?.()
      return
    }

    if (hero.action === "library-draft") {
      onOpenLibrary?.({ view: "all", lifecycle: "draft" })
      return
    }

    handleRecommendation()
  }

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

      <SurfaceCard
        style={{
          background: "linear-gradient(135deg, #111827 0%, #1f2937 65%, #0f172a 100%)",
          color: "#ffffff"
        }}
        title={hero.eyebrow}
        description="The dashboard should answer this before anything else: what should you do right now to improve the knowledge pipeline?"
        bodyStyle={{ gap: 18 }}>
        <Stack gap="lg">
          <Group gap="xs" wrap="wrap">
            <Badge variant="filled" color="blue">
              {hero.stage}
            </Badge>
            <Badge variant="filled" color="blue">
              {model.metrics.draftCount} drafts
            </Badge>
            <Badge variant="filled" color={model.metrics.staleCount ? "red" : "gray"}>
              {model.metrics.staleCount} stale
            </Badge>
            <Badge variant="filled" color="gray">
              {model.metrics.reviewedCount} reviewed
            </Badge>
            <Badge variant="filled" color="dark">
              {model.metrics.inboxCount} source items waiting
            </Badge>
          </Group>

          <Stack gap={8}>
            <Text size="xs" fw={700} tt="uppercase" c="rgba(255,255,255,0.7)">
              {hero.eyebrow}
            </Text>
            <Title order={1} c="#ffffff" style={{ maxWidth: 720 }}>
              {hero.title}
            </Title>
            <Text c="rgba(255,255,255,0.82)" size="md" style={{ maxWidth: 760, lineHeight: 1.65 }}>
              {hero.description}
            </Text>
          </Stack>

          <Group justify="space-between" align="end" wrap="wrap">
            <Stack gap={6}>
              <Text size="sm" c="rgba(255,255,255,0.72)">
                This workspace now behaves like a production line:
              </Text>
              <Text size="sm" c="rgba(255,255,255,0.88)">
                source queue {"->"} draft queue {"->"} reviewed library {"->"} vault export
              </Text>
              <Text size="sm" c="rgba(255,255,255,0.72)">
                {hero.support}
              </Text>
            </Stack>

            <Button
              type="button"
              color="blue"
              size="lg"
              onClick={handleHeroAction}
              disabled={hero.action === "sync" && commands.isSyncing}>
              {hero.action === "sync" && commands.isSyncing ? "Syncing..." : hero.actionLabel}
            </Button>
          </Group>
        </Stack>
      </SurfaceCard>

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
