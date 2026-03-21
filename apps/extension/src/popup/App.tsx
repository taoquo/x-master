import React, { useEffect, useState } from "react"
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core"
import type { PopupData } from "../lib/types.ts"
import { createEmptySyncSummary } from "../lib/types.ts"
import { loadPopupData, runSync } from "../lib/runtime/popupClient.ts"
import { ExtensionUiProvider } from "../ui/provider.tsx"
import { StatusBadge } from "../ui/components.tsx"
import { deriveOnboardingStep } from "../options/lib/onboarding.ts"

function openWorkspace() {
  if (typeof chrome === "undefined" || !chrome.sidePanel?.open) {
    return
  }

  void chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
}

function getPopupRecommendation(data: PopupData) {
  const onboardingStep = deriveOnboardingStep({
    hasCompletedOnboarding: data.hasCompletedOnboarding,
    sourceMaterialCount: data.sourceMaterials.length,
    knowledgeCards: data.knowledgeCards
  })
  const draftCount = data.knowledgeCards.filter((card) => card.status === "draft").length
  const staleCount = data.knowledgeCards.filter((card) => card.status === "reviewed" && card.quality.needsReview).length
  const reviewedCount = data.knowledgeCards.filter((card) => card.status === "reviewed" && !card.quality.needsReview).length

  if (onboardingStep === "sync-source") {
    return {
      eyebrow: "Getting started",
      title: "Run the first sync",
      description: "Pull source material into the workspace first. That unlocks the card generation and review pipeline.",
      actionLabel: "Sync source material"
    }
  }

  if (onboardingStep === "generate-cards") {
    return {
      eyebrow: "Getting started",
      title: "Open Settings and enable generation",
      description: "Source material is ready. Turn on AI generation, then sync again to produce the first draft queue.",
      actionLabel: "Open workspace"
    }
  }

  if (onboardingStep === "review-cards") {
    return {
      eyebrow: "Getting started",
      title: "Review the first draft queue",
      description: "You already have generated cards. Move into Library and turn the first draft into a reviewed card.",
      actionLabel: "Open workspace"
    }
  }

  if (onboardingStep === "export-vault") {
    return {
      eyebrow: "Getting started",
      title: "Export the first vault",
      description: "You now have reviewed cards. Go to Settings and export the first Obsidian vault to complete onboarding.",
      actionLabel: "Open workspace"
    }
  }

  if (data.summary.status === "error" || data.summary.failedCount > 0) {
    return {
      eyebrow: "Attention",
      title: "Sync health needs attention",
      description: "The latest sync recorded failures. Open the workspace and inspect Settings before trusting downstream card counts.",
      actionLabel: "Open workspace"
    }
  }

  if (staleCount > 0) {
    return {
      eyebrow: "Next best action",
      title: `Review ${staleCount} stale card${staleCount === 1 ? "" : "s"}`,
      description: "Some reviewed cards are no longer trustworthy because their source material changed after review.",
      actionLabel: "Open workspace"
    }
  }

  if (draftCount > 0) {
    return {
      eyebrow: "Next best action",
      title: `Review ${draftCount} draft card${draftCount === 1 ? "" : "s"}`,
      description: "Your card queue is ready. Turn drafts into reviewed assets before adding more filing debt.",
      actionLabel: "Open workspace"
    }
  }

  return {
    eyebrow: "Workspace stable",
    title: `${reviewedCount} reviewed card${reviewedCount === 1 ? "" : "s"} ready`,
    description: "The pipeline is in good shape. You can revisit the library, export again, or keep capturing new source material.",
    actionLabel: "Open workspace"
  }
}

export default function App() {
  const [data, setData] = useState<PopupData>({
    bookmarks: [],
    sourceMaterials: [],
    knowledgeCards: [],
    tags: [],
    bookmarkTags: [],
    aiGeneration: {
      enabled: false,
      provider: "openai",
      apiKey: "",
      model: "gpt-5-mini"
    },
    exportScope: "all",
    hasCompletedOnboarding: false,
    summary: createEmptySyncSummary(),
    latestSyncRun: null
  })
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    void refreshPopupData()
  }, [])

  async function refreshPopupData() {
    const nextData = await loadPopupData()
    setData(nextData)
  }

  async function handleSync() {
    setIsSyncing(true)

    try {
      await runSync()
    } catch {
      // The background sync persists the failed summary, refresh after the request settles.
    } finally {
      await refreshPopupData()
      setIsSyncing(false)
    }
  }

  const recommendation = getPopupRecommendation(data)
  const staleCount = data.knowledgeCards.filter((card) => card.status === "reviewed" && card.quality.needsReview).length
  const reviewedCount = data.knowledgeCards.filter((card) => card.status === "reviewed" && !card.quality.needsReview).length

  return (
    <ExtensionUiProvider>
      <Stack
        gap="md"
        p="md"
        w={360}
        maw="100%"
        style={{
          background: "linear-gradient(180deg, #f6f8fb 0%, #ebeff4 100%)"
        }}>
        <Card padding="lg">
          <Stack gap="xs">
            <Group justify="space-between" align="start">
              <div>
                <Title order={3}>X Knowledge Cards</Title>
                <Text c="dimmed">Capture source material, review knowledge cards, then ship a clean vault.</Text>
              </div>
              <Badge color="sand" variant="light">
                local-first
              </Badge>
            </Group>
          </Stack>
        </Card>

        <Card
          padding="lg"
          style={{
            background: "linear-gradient(135deg, #111827 0%, #1f2937 65%, #0f172a 100%)",
            color: "#ffffff"
          }}>
          <Stack gap="md">
            <Group justify="space-between" align="start" wrap="wrap">
              <Stack gap={4}>
                <Text size="xs" fw={700} tt="uppercase" c="rgba(255,255,255,0.72)">
                  {recommendation.eyebrow}
                </Text>
                <Title order={4} c="#ffffff">
                  {recommendation.title}
                </Title>
              </Stack>
              <Group gap="xs" wrap="wrap">
                <Badge variant="filled" color="blue">
                  {data.sourceMaterials.length} sources
                </Badge>
                <Badge variant="filled" color={staleCount ? "red" : "gray"}>
                  {staleCount} stale
                </Badge>
                <Badge variant="filled" color="dark">
                  {reviewedCount} reviewed
                </Badge>
              </Group>
            </Group>

            <Text c="rgba(255,255,255,0.82)">{recommendation.description}</Text>

            <Group justify="space-between" align="center" wrap="wrap">
              {!data.aiGeneration.enabled ? (
                <Text size="sm" c="rgba(255,255,255,0.72)">
                  AI card generation is off.
                </Text>
              ) : (
                <Text size="sm" c="rgba(255,255,255,0.72)">
                  AI generation is on with {data.aiGeneration.model || "gpt-5-mini"}.
                </Text>
              )}
              <Button type="button" color="blue" onClick={recommendation.actionLabel === "Sync source material" ? () => void handleSync() : openWorkspace} disabled={isSyncing}>
                {recommendation.actionLabel === "Sync source material" && isSyncing ? "Syncing..." : recommendation.actionLabel}
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={4}>Sync</Title>
              <StatusBadge status={data.summary.status} />
            </Group>
            <Text>Fetched: {data.summary.fetchedCount}</Text>
            <Text>Inserted: {data.summary.insertedCount}</Text>
            <Text>Updated: {data.summary.updatedCount}</Text>
            <Text>Failed: {data.summary.failedCount}</Text>
            {data.summary.lastSyncedAt ? <Text>Last synced: {data.summary.lastSyncedAt}</Text> : null}
            {data.summary.errorSummary ? <Text c="red">Error: {data.summary.errorSummary}</Text> : null}
            <Button type="button" onClick={() => void handleSync()} disabled={isSyncing}>
              {isSyncing ? "Syncing..." : "Sync now"}
            </Button>
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="sm">
            <Title order={4}>Pipeline snapshot</Title>
            <Text>Source materials: {data.sourceMaterials.length}</Text>
            <Text>Card drafts: {data.knowledgeCards.length}</Text>
            <Text>Reviewed cards: {reviewedCount}</Text>
            <Text>Stale cards: {staleCount}</Text>
            <Text>Tags: {data.tags.length}</Text>
            <Text>Current sync status: {data.summary.status}</Text>
            {!data.sourceMaterials.length ? <Text c="dimmed">Run your first sync to bring technical threads in as source material.</Text> : null}
            {data.sourceMaterials.length > 0 && !data.knowledgeCards.length ? <Text c="dimmed">Source material is ready. The next sync will generate your first knowledge card drafts.</Text> : null}
            {data.summary.lastSyncedAt ? <Text>Last synced: {data.summary.lastSyncedAt}</Text> : null}
          </Stack>
        </Card>
      </Stack>
    </ExtensionUiProvider>
  )
}
