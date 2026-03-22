import React, { useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, Divider, Group, Paper, Stack, Text, TextInput, Textarea, Title } from "@mantine/core"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import type { LibraryLifecycleFilter, LibraryRouteState, LibraryView } from "../lib/navigation.ts"
import { EmptyState, SectionHeader, StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"
import { isUiTestEnv } from "../../ui/testEnv.ts"
import { getQualityIssueLabel } from "../../lib/cards/qualityIssues.ts"

function cardMatchesQuery(card: {
  title: string
  theme: string
  summary: string
  keyExcerpt: string
  applicability: string
  sourceText: string
  authorName: string
  authorHandle: string
}, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return [
    card.title,
    card.theme,
    card.summary,
    card.keyExcerpt,
    card.applicability,
    card.sourceText,
    card.authorName,
    card.authorHandle
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery)
}

function getCardLifecycleStatus(card: {
  status: "draft" | "reviewed"
  quality: { needsReview: boolean }
}) {
  if (card.status === "reviewed" && card.quality.needsReview) {
    return "stale"
  }

  return card.status
}

function formatProvenanceField(field: string) {
  switch (field) {
    case "key_excerpt":
      return "Key excerpt"
    case "applicability":
      return "Applicability"
    case "summary":
      return "Summary"
    case "theme":
      return "Theme"
    default:
      return field
  }
}

interface LibraryPageProps {
  view: LibraryView
  onViewChange: (view: LibraryView) => void
  initialRouteState?: LibraryRouteState
}

export function LibraryPage({ view, onViewChange, initialRouteState }: LibraryPageProps) {
  const workspace = useWorkspaceData()
  const testEnv = isUiTestEnv()
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined)
  const [selectedLifecycle, setSelectedLifecycle] = useState<LibraryLifecycleFilter>(initialRouteState?.lifecycle ?? "all")
  const [query, setQuery] = useState("")
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(undefined)
  const [draftFields, setDraftFields] = useState({
    title: "",
    theme: "",
    summary: "",
    keyExcerpt: "",
    applicability: ""
  })
  const [reviewFeedback, setReviewFeedback] = useState<{
    cardId: string
    message: string
    nextCardId?: string
  } | null>(null)

  const sourceById = useMemo(() => new Map(workspace.sourceMaterials.map((sourceMaterial) => [sourceMaterial.tweetId, sourceMaterial])), [workspace.sourceMaterials])
  const tagById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const tagIdsBySourceMaterialId = useMemo(() => {
    const map = new Map<string, string[]>()

    for (const bookmarkTag of workspace.bookmarkTags) {
      const current = map.get(bookmarkTag.bookmarkId) ?? []
      current.push(bookmarkTag.tagId)
      map.set(bookmarkTag.bookmarkId, current)
    }

    return map
  }, [workspace.bookmarkTags])

  useEffect(() => {
    if (view === "tags") {
      setSelectedTagId((current) => current ?? workspace.tags[0]?.id)
    }
  }, [view, workspace.tags])

  useEffect(() => {
    if (initialRouteState?.lifecycle) {
      setSelectedLifecycle(initialRouteState.lifecycle)
    }
  }, [initialRouteState?.lifecycle])

  const cardsInScope = useMemo(() => {
    return workspace.knowledgeCards
      .map((card) => {
        const sourceMaterial = sourceById.get(card.sourceMaterialId)
        if (!sourceMaterial) {
          return null
        }

        return {
          ...card,
          sourceText: sourceMaterial.text,
          sourceUrl: sourceMaterial.tweetUrl,
          sourceSavedAt: sourceMaterial.savedAt,
          authorName: sourceMaterial.authorName,
          authorHandle: sourceMaterial.authorHandle,
          tagIds: tagIdsBySourceMaterialId.get(card.sourceMaterialId) ?? []
        }
      })
      .filter(Boolean)
      .filter((card) => {
        if (view !== "tags" || !selectedTagId) {
          return true
        }

        return card!.tagIds.includes(selectedTagId)
      })
      .filter((card) => {
        if (selectedLifecycle === "all") {
          return true
        }

        return getCardLifecycleStatus(card!) === selectedLifecycle
      })
      .filter((card) => cardMatchesQuery(card!, query)) as Array<{
      id: string
      sourceMaterialId: string
      status: "draft" | "reviewed"
      title: string
      theme: string
      summary: string
      keyExcerpt: string
      applicability: string
      provenance: Array<{ field: string; excerpt: string }>
      quality: { score: number; needsReview: boolean; warnings: string[]; generatorVersion: string; issues?: Array<{ code: string; message: string; field?: string }> }
      sourceText: string
      sourceUrl: string
      sourceSavedAt: string
      authorName: string
      authorHandle: string
      tagIds: string[]
    }>
  }, [query, selectedLifecycle, selectedTagId, sourceById, tagIdsBySourceMaterialId, view, workspace.knowledgeCards])

  const lifecycleCounts = useMemo(() => {
    const counts = {
      all: workspace.knowledgeCards.length,
      draft: 0,
      reviewed: 0,
      stale: 0
    }

    for (const card of workspace.knowledgeCards) {
      const status = getCardLifecycleStatus(card)
      counts[status] += 1
    }

    return counts
  }, [workspace.knowledgeCards])

  useEffect(() => {
    if (!cardsInScope.length) {
      setSelectedCardId(undefined)
      return
    }

    if (!selectedCardId || !cardsInScope.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(cardsInScope[0]?.id)
    }
  }, [cardsInScope, selectedCardId])

  const selectedCard = useMemo(() => cardsInScope.find((card) => card.id === selectedCardId) ?? null, [cardsInScope, selectedCardId])
  const groupedProvenance = useMemo(() => {
    if (!selectedCard) {
      return []
    }

    const groups = new Map<string, string[]>()

    for (const item of selectedCard.provenance) {
      const current = groups.get(item.field) ?? []
      if (!current.includes(item.excerpt)) {
        current.push(item.excerpt)
      }
      groups.set(item.field, current)
    }

    return ["theme", "summary", "key_excerpt", "applicability"]
      .map((field) => ({
        field,
        excerpts: groups.get(field) ?? []
      }))
      .filter((group) => group.excerpts.length > 0)
  }, [selectedCard])
  const qualityIssues = selectedCard?.quality.issues ?? []
  const nextCardCandidate = useMemo(() => {
    if (!selectedCardId) {
      return cardsInScope[0] ?? null
    }

    const currentIndex = cardsInScope.findIndex((card) => card.id === selectedCardId)
    if (currentIndex < 0) {
      return cardsInScope[0] ?? null
    }

    return cardsInScope[currentIndex + 1] ?? cardsInScope[currentIndex - 1] ?? null
  }, [cardsInScope, selectedCardId])
  const draftQueueRemaining = useMemo(
    () => cardsInScope.filter((card) => getCardLifecycleStatus(card) === "draft" && card.id !== selectedCardId).length,
    [cardsInScope, selectedCardId]
  )
  const staleQueueRemaining = useMemo(
    () => cardsInScope.filter((card) => getCardLifecycleStatus(card) === "stale" && card.id !== selectedCardId).length,
    [cardsInScope, selectedCardId]
  )

  useEffect(() => {
    if (!selectedCard) {
      setDraftFields({
        title: "",
        theme: "",
        summary: "",
        keyExcerpt: "",
        applicability: ""
      })
      return
    }

    setDraftFields({
      title: selectedCard.title,
      theme: selectedCard.theme,
      summary: selectedCard.summary,
      keyExcerpt: selectedCard.keyExcerpt,
      applicability: selectedCard.applicability
    })
    setReviewFeedback((current) => (current?.cardId === selectedCard.id ? current : null))
  }, [selectedCard])

  async function handleSaveDraft() {
    if (!selectedCard) {
      return
    }

    try {
      await workspace.handleUpdateKnowledgeCardDraft(selectedCard.id, draftFields)
      setReviewFeedback({
        cardId: selectedCard.id,
        message: "Card saved and marked as reviewed.",
        nextCardId: nextCardCandidate?.id
      })
    } catch {
      setReviewFeedback(null)
    }
  }

  async function handleRegenerateSelectedCard() {
    if (!selectedCard) {
      return
    }

    try {
      await workspace.handleRegenerateKnowledgeCardDraft(selectedCard.id)
      setReviewFeedback(null)
    } catch {
      // The command hook now exposes a user-visible error state. Do not add duplicate local handling here.
    }
  }

  const lifecycleTitle =
    selectedLifecycle === "draft"
      ? "Draft queue"
      : selectedLifecycle === "reviewed"
        ? "Reviewed library"
        : selectedLifecycle === "stale"
          ? "Stale review"
          : "All cards"

  const lifecycleDescription =
    selectedLifecycle === "draft"
      ? "Freshly generated cards waiting for a human pass."
      : selectedLifecycle === "reviewed"
        ? "Stable cards that are ready to revisit or export."
        : selectedLifecycle === "stale"
          ? "Previously reviewed cards whose source material changed and now need another look."
          : "Every generated card, regardless of lifecycle state."
  const onboardingNotice =
    workspace.onboardingStep === "review-cards"
      ? "Start with one draft, make it trustworthy, then move directly to the next card."
      : workspace.onboardingStep === "export-vault"
        ? "You already have a reviewed card. The next milestone is exporting your first vault from Settings."
        : null

  return (
    <ExtensionUiProvider>
      <Stack gap="sm" style={{ minHeight: 0, height: testEnv ? "auto" : "calc(100vh - 32px)" }}>
        <SectionHeader
          title="Library"
          description="Review generated cards, resolve stale ones, and tighten the final note before it leaves the app."
          actions={
            <Stack gap={8} align="end">
              <Group gap="xs" wrap="wrap" justify="flex-end">
                <Badge variant="light" color="dark">
                  {workspace.knowledgeCards.length} cards
                </Badge>
                <Badge variant="light" color="blue">
                  {lifecycleCounts.draft} draft
                </Badge>
                <Badge variant="light" color="gray">
                  {lifecycleCounts.reviewed} reviewed
                </Badge>
                <Badge variant="light" color={lifecycleCounts.stale ? "red" : "gray"}>
                  {lifecycleCounts.stale} stale
                </Badge>
              </Group>
              <Paper
                p={4}
                radius="xl"
                withBorder
                style={{
                  display: "inline-flex",
                  gap: 3,
                  background: "#f3f3f4"
                }}>
                <Button type="button" variant={view === "all" ? "white" : "subtle"} color={view === "all" ? "dark" : "gray"} onClick={() => onViewChange("all")} disabled={view === "all"}>
                  Library
                </Button>
                <Button type="button" variant={view === "tags" ? "white" : "subtle"} color={view === "tags" ? "dark" : "gray"} onClick={() => onViewChange("tags")} disabled={view === "tags"}>
                  By tag
                </Button>
              </Paper>
            </Stack>
          }
        />

        {!workspace.knowledgeCards.length ? (
          <EmptyState
            title="No knowledge cards yet."
            description="Once source material is synced and card generation runs, this page becomes your draft queue, reviewed library, and stale review desk."
          />
        ) : null}

        {onboardingNotice ? (
          <Paper p="sm" radius="md" withBorder style={{ background: "#ffffff" }}>
            <Text size="sm" c="dimmed">
              {onboardingNotice}
            </Text>
          </Paper>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: testEnv ? "1fr" : "minmax(360px, 430px) minmax(0, 1fr)",
            gap: 16,
            flex: 1,
            minHeight: 0,
            overflow: "hidden"
          }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: "100%",
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: 16,
              overflow: "hidden"
            }}>
            <div style={{ padding: 14, borderBottom: "1px solid #e4e4e7", background: "#ffffff" }}>
              <Stack gap="sm">
                <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                  <Group gap="xs" wrap="wrap">
                    <Text fw={600} size="sm">
                      {lifecycleTitle}
                    </Text>
                    <Badge variant="light" color="dark">
                      {cardsInScope.length} visible
                    </Badge>
                    <Badge variant="light" color="gray">
                      {workspace.sourceMaterials.length} sources
                    </Badge>
                    {view === "tags" && selectedTagId ? (
                      <Badge variant="light" color="blue">
                        {tagById.get(selectedTagId)?.name ?? selectedTagId}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {lifecycleDescription}
                  </Text>
                </Group>

                <TextInput
                  type="search"
                  value={query}
                  placeholder="Search cards, excerpts, themes, authors"
                  aria-label="Search cards"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />

                <Group gap="xs" wrap="wrap">
                  <Button type="button" size="xs" radius="xl" variant={selectedLifecycle === "all" ? "filled" : "light"} color={selectedLifecycle === "all" ? "dark" : "gray"} onClick={() => setSelectedLifecycle("all")}>
                    All cards ({lifecycleCounts.all})
                  </Button>
                  <Button type="button" size="xs" radius="xl" variant={selectedLifecycle === "draft" ? "filled" : "light"} color={selectedLifecycle === "draft" ? "dark" : "gray"} onClick={() => setSelectedLifecycle("draft")}>
                    Draft queue ({lifecycleCounts.draft})
                  </Button>
                  <Button type="button" size="xs" radius="xl" variant={selectedLifecycle === "reviewed" ? "filled" : "light"} color={selectedLifecycle === "reviewed" ? "dark" : "gray"} onClick={() => setSelectedLifecycle("reviewed")}>
                    Reviewed library ({lifecycleCounts.reviewed})
                  </Button>
                  <Button type="button" size="xs" radius="xl" variant={selectedLifecycle === "stale" ? "filled" : "light"} color={selectedLifecycle === "stale" ? "dark" : "gray"} onClick={() => setSelectedLifecycle("stale")}>
                    Stale review ({lifecycleCounts.stale})
                  </Button>
                </Group>

                {view === "tags" ? (
                  <Stack gap="xs">
                    <Text size="xs" fw={600} c="dimmed">
                      Filter by tag
                    </Text>
                    {!workspace.tags.length ? <Text c="dimmed">No tags available yet.</Text> : null}
                    <Group gap="xs" wrap="wrap">
                      {workspace.tags.map((tag) => (
                        <Button key={tag.id} type="button" size="xs" radius="xl" variant={tag.id === selectedTagId ? "filled" : "light"} color={tag.id === selectedTagId ? "dark" : "gray"} onClick={() => setSelectedTagId(tag.id)}>
                          {tag.name} ({workspace.bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === tag.id).length})
                        </Button>
                      ))}
                    </Group>
                  </Stack>
                ) : null}
              </Stack>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: 12, background: "#fcfcfd" }}>
              <Stack
                gap="sm"
                style={{
                  minHeight: 0,
                  height: "100%",
                  overflowY: "auto",
                  paddingRight: 4
                }}>
                {!cardsInScope.length ? <Text c="dimmed">No cards match the current mode and filters.</Text> : null}
                {cardsInScope.map((card) => (
                  <Card
                    key={card.id}
                    component="button"
                    type="button"
                    padding="md"
                    onClick={() => setSelectedCardId(card.id)}
                    style={{
                      textAlign: "left",
                      borderColor: card.id === selectedCardId ? "#111827" : undefined
                    }}>
                    <Stack gap={6}>
                      <Group justify="space-between" align="center">
                        <Text fw={600}>{card.title}</Text>
                        <StatusBadge status={getCardLifecycleStatus(card)} />
                      </Group>
                      <Text size="sm" c="dimmed">
                        @{card.authorHandle} · quality {card.quality.score}
                      </Text>
                      <Text size="sm" lineClamp={3}>
                        {card.summary}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </div>
          </div>

          <SurfaceCard
            title="Card review"
            description={selectedCard ? "Refine the draft, validate provenance, and keep the source visible while deciding what to trust." : "Select a card from the queue to start reviewing."}
            style={{ minHeight: 0, height: "100%" }}
            bodyStyle={{ minHeight: 0, overflow: "hidden" }}>
            <Stack
              gap="sm"
              style={{
                minHeight: 0,
                height: "100%",
                overflowY: "auto",
                gap: selectedCard ? 16 : 0,
                paddingRight: 4
              }}>
              {!selectedCard ? (
                <Text c="dimmed">Select a card draft to inspect it.</Text>
              ) : (
                <>
                  <Group gap="xs" wrap="wrap">
                    <StatusBadge status={getCardLifecycleStatus(selectedCard)} />
                    <Badge variant="light" color={selectedCard.quality.needsReview ? "red" : "blue"}>
                      Quality {selectedCard.quality.score}
                    </Badge>
                    <Badge variant="light" color="gray">
                      {selectedCard.quality.generatorVersion}
                    </Badge>
                  </Group>

                  {selectedCard.quality.warnings.length ? (
                    <Card padding="md" bg="red.0" withBorder>
                      <Stack gap={4}>
                        <Text fw={600}>Needs review</Text>
                        {qualityIssues.length ? (
                          <Group gap="xs" wrap="wrap">
                            {qualityIssues.map((issue, index) => (
                              <Badge key={`${issue.code}-${index}`} variant="light" color="red">
                                {getQualityIssueLabel(issue.code as Parameters<typeof getQualityIssueLabel>[0])}
                              </Badge>
                            ))}
                          </Group>
                        ) : null}
                        {selectedCard.quality.warnings.map((warning) => (
                          <Text key={warning} size="sm">
                            - {warning}
                          </Text>
                        ))}
                      </Stack>
                    </Card>
                  ) : null}

                  {workspace.commandError && (workspace.commandError.scope === "knowledge-card-save" || workspace.commandError.scope === "knowledge-card-regenerate") ? (
                    <Card padding="md" bg="red.0" withBorder>
                      <Stack gap={6}>
                        <Text fw={600}>Action failed</Text>
                        <Text size="sm">{workspace.commandError.message}</Text>
                        <Group gap="sm">
                          <Button type="button" variant="light" color="red" onClick={workspace.clearCommandError}>
                            Dismiss
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ) : null}

                  <TextInput label="Title" value={draftFields.title} onChange={(event) => setDraftFields((current) => ({ ...current, title: event.currentTarget.value }))} />
                  <TextInput label="Theme" value={draftFields.theme} onChange={(event) => setDraftFields((current) => ({ ...current, theme: event.currentTarget.value }))} />
                  <Textarea label="Summary" minRows={4} value={draftFields.summary} onChange={(event) => setDraftFields((current) => ({ ...current, summary: event.currentTarget.value }))} />
                  <Textarea label="Key excerpt / code" minRows={4} value={draftFields.keyExcerpt} onChange={(event) => setDraftFields((current) => ({ ...current, keyExcerpt: event.currentTarget.value }))} />
                  <Textarea label="Applicability" minRows={3} value={draftFields.applicability} onChange={(event) => setDraftFields((current) => ({ ...current, applicability: event.currentTarget.value }))} />

                  <Group gap="sm">
                    <Button type="button" color="dark" onClick={() => void handleSaveDraft()} disabled={workspace.isSavingTag}>
                      Save draft
                    </Button>
                    <Button
                      type="button"
                      variant="light"
                      onClick={() => void handleRegenerateSelectedCard()}
                      disabled={workspace.isSavingTag}>
                      Regenerate with AI
                    </Button>
                  </Group>

                  {reviewFeedback?.cardId === selectedCard.id ? (
                    <Card padding="md" bg="blue.0" withBorder>
                      <Stack gap={6}>
                        <Text fw={600}>{reviewFeedback.message}</Text>
                        <Text size="sm" c="dimmed">
                          Use this moment to keep momentum going while the current card is still fresh in your head.
                        </Text>
                        <Group gap="xs" wrap="wrap">
                          <Badge variant="light" color="blue">
                            {draftQueueRemaining} draft remaining
                          </Badge>
                          <Badge variant="light" color={staleQueueRemaining ? "red" : "gray"}>
                            {staleQueueRemaining} stale remaining
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {draftQueueRemaining > 0
                            ? "Stay in review mode and clear the next draft while the context is fresh."
                            : staleQueueRemaining > 0
                              ? "Drafts are clear. Next best move is resolving stale cards."
                              : "You cleared the visible queue. The next milestone is exporting a clean vault."}
                        </Text>
                        <Group gap="sm">
                          {reviewFeedback.nextCardId ? (
                            <Button
                              type="button"
                              variant="light"
                              onClick={() => {
                                setSelectedCardId(reviewFeedback.nextCardId)
                                setReviewFeedback(null)
                              }}>
                              Review next card
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="subtle"
                            onClick={() => setReviewFeedback(null)}>
                            Stay here
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ) : null}

                  <Divider />

                  <Stack gap="xs">
                    <Title order={4}>Provenance</Title>
                    {groupedProvenance.map((group) => (
                      <Card key={group.field} padding="sm" withBorder>
                        <Stack gap={4}>
                          <Text size="sm" fw={600}>
                            {formatProvenanceField(group.field)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {group.excerpts.length} supporting snippet{group.excerpts.length === 1 ? "" : "s"}
                          </Text>
                          {group.excerpts.map((excerpt, index) => (
                            <Card key={`${group.field}-${index}`} padding="xs" bg="gray.0" withBorder>
                              <Text size="sm">{excerpt}</Text>
                            </Card>
                          ))}
                        </Stack>
                      </Card>
                    ))}
                  </Stack>

                  <Stack gap="xs">
                    <Title order={4}>Source material</Title>
                    <Text size="sm" c="dimmed">
                      @{selectedCard.authorHandle} · saved {selectedCard.sourceSavedAt}
                    </Text>
                    <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                      {selectedCard.sourceText}
                    </Text>
                    <Text size="sm">Source: {selectedCard.sourceUrl}</Text>
                    <Group gap="xs" wrap="wrap">
                      {selectedCard.tagIds.map((tagId) => (
                        <Badge key={tagId} variant="light" color="dark">
                          {tagById.get(tagId)?.name ?? tagId}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </>
              )}
            </Stack>
          </SurfaceCard>
        </div>
      </Stack>
    </ExtensionUiProvider>
  )
}
