import React, { useMemo, useState } from "react"
import { ActionIcon, Badge, Button, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core"
import { SettingsPanel } from "../../popup/components/SettingsPanel.tsx"
import { useWorkspaceCommands } from "../hooks/useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries.ts"
import { SectionHeader, StatusBadge, SurfaceCard } from "../../ui/components.tsx"
import { AppIcon } from "../../ui/icons.tsx"

export function SettingsPage() {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    bookmarks: queries.bookmarks,
    refreshData: queries.refreshData
  })
  const [newTagName, setNewTagName] = useState("")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")

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

  return (
    <Stack gap="md">
      <SectionHeader
        title="Settings"
        description="Manage sync visibility, workspace data, and the shared tag system used by Inbox and Library."
        actions={
          <Button type="button" color="dark" onClick={() => void commands.handleSync()} disabled={commands.isSyncing}>
            {commands.isSyncing ? "Syncing..." : "Sync now"}
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <SurfaceCard title="Sync status" description="Keep the detailed sync trail here while the popup stays lightweight.">
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

        <SurfaceCard title="Access and permissions" description="This build stays local-first and reads bookmarks through the active X browser session.">
          <Stack gap="sm">
            <Text>Required browser permissions: cookies, storage, and access to `https://x.com/*`.</Text>
            <Text>If sync fails, verify that you are signed in on X and the extension can still read the current session cookies.</Text>
            <Text>Detailed failure text is preserved in sync history and surfaced above.</Text>
          </Stack>
        </SurfaceCard>

        <SurfaceCard title="Tag management" description="Create and maintain the shared tag taxonomy here. Inbox and Library only attach existing tags.">
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

        <SurfaceCard title="Recent organization assets" description="Keep the active tag taxonomy visible here instead of hiding it inside content pages.">
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
      </SimpleGrid>

      <SettingsPanel
        bookmarks={queries.bookmarks}
        tags={queries.tags}
        summary={queries.summary}
        latestSyncRun={queries.latestSyncRun}
        onExport={commands.handleExport}
        onReset={commands.handleReset}
        isResetting={commands.isResetting}
      />
    </Stack>
  )
}
