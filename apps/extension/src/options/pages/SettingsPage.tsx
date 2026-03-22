import React, { useMemo, useState } from "react"
import { ActionIcon, Badge, Button, Checkbox, Group, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from "@mantine/core"
import { SettingsPanel } from "../../popup/components/SettingsPanel.tsx"
import { useWorkspaceCommands } from "../hooks/useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries.ts"
import { SectionHeader, StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { AppIcon } from "../../ui/icons.tsx"
import { saveAiGenerationSettings } from "../../lib/storage/settings.ts"

type SettingsSection = "pipeline" | "knowledge" | "system"

export function SettingsPage() {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    bookmarks: queries.bookmarks,
    knowledgeCards: queries.knowledgeCards,
    bookmarkTags: queries.bookmarkTags,
    tags: queries.tags,
    refreshData: queries.refreshData
  })
  const [newTagName, setNewTagName] = useState("")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiApiKey, setAiApiKey] = useState("")
  const [aiModel, setAiModel] = useState("")
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false)
  const [exportScope, setExportScopeState] = useState(queries.exportScope)
  const [section, setSection] = useState<SettingsSection>("pipeline")

  React.useEffect(() => {
    setAiEnabled(queries.isLoading ? false : queries.aiGeneration.enabled)
    setAiApiKey(queries.aiGeneration.apiKey)
    setAiModel(queries.aiGeneration.model)
    setExportScopeState(queries.exportScope)
  }, [queries.aiGeneration, queries.exportScope, queries.isLoading])

  const recentTags = useMemo(
    () => [...queries.tags].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 6),
    [queries.tags]
  )
  const tagUsageCountById = useMemo(() => {
    const counts = new Map<string, number>()

    for (const bookmarkTag of queries.bookmarkTags) {
      counts.set(bookmarkTag.tagId, (counts.get(bookmarkTag.tagId) ?? 0) + 1)
    }

    return counts
  }, [queries.bookmarkTags])
  const tagsByUsage = useMemo(() => {
    return [...queries.tags].sort((left, right) => {
      const usageDiff = (tagUsageCountById.get(right.id) ?? 0) - (tagUsageCountById.get(left.id) ?? 0)
      if (usageDiff !== 0) {
        return usageDiff
      }

      return left.name.localeCompare(right.name)
    })
  }, [queries.tags, tagUsageCountById])

  async function handleCreateTag() {
    if (!newTagName.trim()) {
      return
    }

    await commands.handleCreateTag(newTagName)
    setNewTagName("")
  }

  async function handleSaveTagRename() {
    if (!editingTagId || !editingTagName.trim()) {
      return
    }

    await commands.handleRenameTag(editingTagId, editingTagName)
    setEditingTagId(null)
    setEditingTagName("")
  }

  async function handleDeleteTag(tagId: string) {
    await commands.handleDeleteTag(tagId)

    if (editingTagId === tagId) {
      setEditingTagId(null)
      setEditingTagName("")
    }
  }

  async function handleSaveAiSettings() {
    setIsSavingAiSettings(true)
    try {
      await saveAiGenerationSettings({
        enabled: aiEnabled,
        provider: "openai",
        apiKey: aiApiKey.trim(),
        model: aiModel.trim() || "gpt-5-mini"
      })
      await queries.refreshData()
    } finally {
      setIsSavingAiSettings(false)
    }
  }

  return (
    <Stack gap="md">
      <SectionHeader
        title="Settings"
        description="Configure the pipeline that turns source material into reusable knowledge cards and exports them into your vault."
        actions={
          <Button type="button" color="dark" onClick={() => void commands.handleSync()} disabled={commands.isSyncing}>
            {commands.isSyncing ? "Syncing..." : "Sync now"}
          </Button>
        }
      />

      <SegmentedControl
        value={section}
        onChange={(value) => setSection(value as SettingsSection)}
        data={[
          { label: "Pipeline", value: "pipeline" },
          { label: "Knowledge setup", value: "knowledge" },
          { label: "System", value: "system" }
        ]}
      />

      {queries.onboardingStep === "generate-cards" && section === "pipeline" ? (
        <SurfaceCard
          title="Step 2: enable generation"
          description="Source material exists, but there are no cards yet. Turn on AI generation and sync again to create the first draft queue.">
          <Text c="dimmed">You only need to do this once: enable the generator, add your API key, save the model, then return to Dashboard or Sync now from here.</Text>
        </SurfaceCard>
      ) : null}

      {queries.onboardingStep === "export-vault" && section === "knowledge" ? (
        <SurfaceCard
          title="Step 4: export your first vault"
          description="You have reviewed cards now. Choose an export scope and produce the first Obsidian vault to finish onboarding.">
          <Text c="dimmed">This is the moment the app stops being a review workspace and becomes part of your long-term notes system.</Text>
        </SurfaceCard>
      ) : null}

      {section === "pipeline" ? (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <SurfaceCard title="Sync status" description="Source ingestion health lives here. If this is red, the rest of the pipeline is downstream guesswork.">
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <StatusBadge status={commands.isSyncing ? "running" : queries.summary.status} />
                {queries.summary.lastSyncedAt ? (
                  <Text size="sm" c="dimmed">
                    Last synced: {queries.summary.lastSyncedAt}
                  </Text>
                ) : null}
              </Group>

              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="gray">
                  Fetched {queries.summary.fetchedCount}
                </Badge>
                <Badge variant="light" color="gray">
                  Inserted {queries.summary.insertedCount}
                </Badge>
                <Badge variant="light" color="gray">
                  Updated {queries.summary.updatedCount}
                </Badge>
                <Badge variant="light" color={queries.summary.failedCount ? "red" : "gray"}>
                  Failed {queries.summary.failedCount}
                </Badge>
              </Group>

              {queries.summary.errorSummary ? <Text c="red">Latest error: {queries.summary.errorSummary}</Text> : null}
            </Stack>
          </SurfaceCard>

          <SurfaceCard title="AI generation" description="Control how source material becomes card drafts. This is the product’s main transformation stage.">
            <Stack gap="md">
              <Checkbox
                checked={aiEnabled}
                label="Enable AI card generation during sync"
                onChange={(event) => setAiEnabled(event.currentTarget.checked)}
              />
              <TextInput
                label="OpenAI API key"
                type="password"
                placeholder="sk-..."
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.currentTarget.value)}
              />
              <TextInput
                label="Model"
                placeholder="gpt-5-mini"
                value={aiModel}
                onChange={(event) => setAiModel(event.currentTarget.value)}
              />
              <Text size="sm" c="dimmed">
                Recommendation: use `gpt-5-mini` for the first pass. If the API key is missing or the request fails, the app falls back to the heuristic generator and marks the draft for review.
              </Text>
              <Text size="sm" c="dimmed">
                V1 source model: each draft is generated from one saved X post or one saved note_tweet. Thread reconstruction is explicitly out of scope in this version.
              </Text>
              <Button type="button" color="dark" onClick={() => void handleSaveAiSettings()} disabled={isSavingAiSettings}>
                {isSavingAiSettings ? "Saving..." : "Save AI settings"}
              </Button>
            </Stack>
          </SurfaceCard>
        </SimpleGrid>
      ) : null}

      {section === "knowledge" ? (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <SurfaceCard title="Tag management" description="Maintain the shared taxonomy for source material and exported vault structure.">
            <Stack gap="md">
              <TextInput label="New tag" value={newTagName} placeholder="Research" onChange={(event) => setNewTagName(event.currentTarget.value)} />
              <Button type="button" color="dark" onClick={() => void handleCreateTag()} disabled={commands.isSavingTag || !newTagName.trim()}>
                Create tag
              </Button>

              <Stack gap="xs">
                <Text fw={600}>Manage existing tags</Text>
                {!tagsByUsage.length ? <Text c="dimmed">No tags yet.</Text> : null}
                {tagsByUsage.map((tag) => {
                  const usageCount = tagUsageCountById.get(tag.id) ?? 0
                  const isEditing = editingTagId === tag.id

                  return (
                    <Group
                      key={tag.id}
                      justify="space-between"
                      align="center"
                      wrap="nowrap">
                      <Stack gap={4} style={{ flex: 1 }}>
                        {isEditing ? (
                          <TextInput
                            aria-label={`Rename ${tag.name}`}
                            value={editingTagName}
                            onChange={(event) => setEditingTagName(event.currentTarget.value)}
                          />
                        ) : (
                          <Text>{tag.name}</Text>
                        )}
                        <Text size="sm" c="dimmed">
                          {usageCount} bookmark{usageCount === 1 ? "" : "s"}
                        </Text>
                      </Stack>

                      <Group gap={6} wrap="nowrap">
                        {isEditing ? (
                          <>
                            <Button type="button" size="xs" color="dark" onClick={() => void handleSaveTagRename()} disabled={commands.isSavingTag || !editingTagName.trim()}>
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="subtle"
                              onClick={() => {
                                setEditingTagId(null)
                                setEditingTagName("")
                              }}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <ActionIcon
                            type="button"
                            variant="subtle"
                            color="gray"
                            aria-label={`Rename ${tag.name}`}
                            onClick={() => {
                              setEditingTagId(tag.id)
                              setEditingTagName(tag.name)
                            }}>
                            <AppIcon name="edit" size={16} />
                          </ActionIcon>
                        )}
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          color="red"
                          aria-label={`Delete ${tag.name}`}
                          onClick={() => void handleDeleteTag(tag.id)}
                          disabled={commands.isSavingTag}>
                          <AppIcon name="trash" size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  )
                })}
              </Stack>
            </Stack>
          </SurfaceCard>

          <SurfaceCard title="Export and vault shape" description="The current export writes an Obsidian-ready vault zip with cards and sources grouped by tag and theme.">
            <Stack gap="sm">
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="blue">
                  {queries.knowledgeCards.length} cards
                </Badge>
                <Badge variant="light" color="gray">
                  {queries.bookmarks.length} sources
                </Badge>
                <Badge variant="light" color={queries.knowledgeCards.filter((card) => card.status === "reviewed" && card.quality.needsReview).length ? "red" : "gray"}>
                  {queries.knowledgeCards.filter((card) => card.status === "reviewed" && card.quality.needsReview).length} stale
                </Badge>
              </Group>
              <Text fw={600}>Export preview</Text>
              <SegmentedControl
                value={exportScope}
                onChange={(value) => setExportScopeState(value as typeof exportScope)}
                data={[
                  { label: "All", value: "all" },
                  { label: "Reviewed", value: "reviewed" },
                  { label: "Reviewed + stale", value: "reviewed-and-stale" }
                ]}
              />
              <Button
                type="button"
                variant="light"
                onClick={() => void commands.handleSaveExportScope(exportScope)}
                disabled={commands.isSavingExportScope}>
                {commands.isSavingExportScope ? "Saving export scope..." : "Save export scope"}
              </Button>
              <Text>Vault package structure:</Text>
              <Text c="dimmed">Cards/{`<Primary Tag>/<Theme>`} and Sources/{`<Primary Tag>/<Theme>`}</Text>
              <Text c="dimmed">Recommended practice: use reviewed cards as your stable library, keep draft and stale cards inside the app until they are clean enough to ship.</Text>
              <Text c="dimmed">
                Current lifecycle mix: {queries.knowledgeCards.filter((card) => card.status === "draft").length} draft, {queries.knowledgeCards.filter((card) => card.status === "reviewed" && !card.quality.needsReview).length} reviewed, {queries.knowledgeCards.filter((card) => card.status === "reviewed" && card.quality.needsReview).length} stale.
              </Text>
              <Text c="dimmed">
                Current export scope: {exportScope === "all" ? "all cards" : exportScope === "reviewed" ? "reviewed cards only" : "reviewed and stale cards"}
              </Text>
            </Stack>
          </SurfaceCard>

          <SurfaceCard title="Recent organization assets" description="Keep the active taxonomy visible here instead of hiding it inside content pages.">
            <Stack gap="sm">
              <Text fw={600}>Recent tags</Text>
              {!recentTags.length ? <Text c="dimmed">No tags yet.</Text> : null}
              <Group gap="xs" wrap="wrap">
                {recentTags.map((tag) => (
                  <Badge key={tag.id} variant="light" color="dark">
                    {tag.name}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </SurfaceCard>

          <SurfaceCard title="Card draft pipeline" description="The pipeline is now explicit: source material comes in, AI produces a card draft, humans review it, and the vault export becomes the final output.">
            <Stack gap="sm">
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="blue">
                  {queries.knowledgeCards.length} draft{queries.knowledgeCards.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="light" color="gray">
                  {queries.bookmarks.length} source material item{queries.bookmarks.length === 1 ? "" : "s"}
                </Badge>
              </Group>
              <Text>Each draft is generated from one saved X post or one saved note_tweet in v1. We are not reconstructing full threads yet.</Text>
              <Text c="dimmed">Current generator captures provenance and quality warnings so drafts can be reviewed before export.</Text>
            </Stack>
          </SurfaceCard>
        </SimpleGrid>
      ) : null}

      {section === "system" ? (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <SurfaceCard title="Access and permissions" description="System-level requirements for the extension surfaces and background worker.">
            <Stack gap="sm">
              <Text>Required browser permissions: cookies, storage, and access to `https://x.com/*`.</Text>
              <Text>AI card generation also calls `https://api.openai.com/*` directly from the extension background worker.</Text>
              <Text>If sync fails, verify that you are signed in on X and the extension can still read the current session cookies.</Text>
              <Text>Detailed failure text is preserved in sync history and surfaced above.</Text>
            </Stack>
          </SurfaceCard>

          <SettingsPanel
            bookmarks={queries.bookmarks}
            knowledgeCards={queries.knowledgeCards}
            tags={queries.tags}
            summary={queries.summary}
            latestSyncRun={queries.latestSyncRun}
            onExport={commands.handleExport}
            onReset={commands.handleReset}
            isResetting={commands.isResetting}
            isExporting={commands.isExporting}
            exportSummary={commands.lastExportSummary}
          />
        </SimpleGrid>
      ) : null}
    </Stack>
  )
}
