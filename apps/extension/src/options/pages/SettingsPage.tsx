import React, { useMemo, useState } from "react"
import { Button, Grid, Stack, Text, TextInput } from "@mantine/core"
import { SettingsPanel } from "../../popup/components/SettingsPanel.tsx"
import { useWorkspaceCommands } from "../hooks/useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries.ts"
import { SectionHeader, StatusBadge, SurfaceCard } from "../../ui/components.tsx"

export function SettingsPage() {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    bookmarks: queries.bookmarks,
    refreshData: queries.refreshData
  })
  const [newTagName, setNewTagName] = useState("")
  const [newFolderName, setNewFolderName] = useState("")

  const recentTags = useMemo(
    () => [...queries.tags].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 6),
    [queries.tags]
  )
  const recentFolders = useMemo(
    () => [...queries.folders].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 6),
    [queries.folders]
  )

  async function handleCreateTag() {
    if (!newTagName.trim()) {
      return
    }

    await commands.handleCreateTag(newTagName)
    setNewTagName("")
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) {
      return
    }

    await commands.handleCreateFolder(newFolderName)
    setNewFolderName("")
  }

  return (
    <Stack gap="lg">
      <SectionHeader
        title="Settings"
        description="Manage sync visibility, workspace data, and the folder and tag system that supports daily filing."
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <SurfaceCard
            title="Sync status"
            description="Keep the detailed sync trail here while the popup stays lightweight.">
            <StatusBadge status={commands.isSyncing ? "running" : queries.summary.status} />
            <Text>Fetched: {queries.summary.fetchedCount}</Text>
            <Text>Inserted: {queries.summary.insertedCount}</Text>
            <Text>Updated: {queries.summary.updatedCount}</Text>
            <Text>Failed: {queries.summary.failedCount}</Text>
            {queries.summary.lastSyncedAt ? <Text>Last synced: {queries.summary.lastSyncedAt}</Text> : null}
            {queries.summary.errorSummary ? <Text c="red">Latest error: {queries.summary.errorSummary}</Text> : null}
            <Button type="button" color="dark" onClick={() => void commands.handleSync()} disabled={commands.isSyncing}>
              {commands.isSyncing ? "Syncing..." : "Sync now"}
            </Button>
          </SurfaceCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <SurfaceCard
            title="Access and permissions"
            description="This build stays local-first and reads bookmarks through the active X browser session.">
            <Text>Required browser permissions: cookies, storage, and access to `https://x.com/*`.</Text>
            <Text>If sync fails, verify that you are signed in on X and the extension can still read the current session cookies.</Text>
            <Text>Detailed failure text is preserved in sync history and surfaced above.</Text>
          </SurfaceCard>
        </Grid.Col>
      </Grid>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <SurfaceCard
            title="Organization config"
            description="Create the root tags and folders that Inbox and Library use during filing.">
            <TextInput label="New tag" value={newTagName} placeholder="Research" onChange={(event) => setNewTagName(event.currentTarget.value)} />
            <Button type="button" onClick={() => void handleCreateTag()} disabled={commands.isSavingTag || !newTagName.trim()}>
              Create tag
            </Button>
            <TextInput
              label="New root folder"
              value={newFolderName}
              placeholder="Playbooks"
              onChange={(event) => setNewFolderName(event.currentTarget.value)}
            />
            <Button type="button" onClick={() => void handleCreateFolder()} disabled={commands.isSavingFolder || !newFolderName.trim()}>
              Create folder
            </Button>
          </SurfaceCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <SurfaceCard
            title="Recent organization assets"
            description="Keep taxonomy visible here instead of hiding it inside content pages.">
            <Text fw={600}>Recent tags</Text>
            {!recentTags.length ? <Text c="dimmed">No tags yet.</Text> : null}
            {recentTags.map((tag) => (
              <Text key={tag.id}>{tag.name}</Text>
            ))}
            <Text fw={600} mt="sm">
              Recent folders
            </Text>
            {!recentFolders.length ? <Text c="dimmed">No folders yet.</Text> : null}
            {recentFolders.map((folder) => (
              <Text key={folder.id}>{folder.name}</Text>
            ))}
          </SurfaceCard>
        </Grid.Col>
      </Grid>

      <SettingsPanel
        bookmarks={queries.bookmarks}
        tags={queries.tags}
        latestSyncRun={queries.latestSyncRun}
        onExport={commands.handleExport}
        onReset={commands.handleReset}
        isResetting={commands.isResetting}
      />
    </Stack>
  )
}
