import React, { useEffect, useState } from "react"
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core"
import type { PopupData } from "../lib/types.ts"
import { createEmptySyncSummary } from "../lib/types.ts"
import { loadPopupData, runSync } from "../lib/runtime/popupClient.ts"
import { ExtensionUiProvider } from "../ui/provider.tsx"
import { StatusBadge } from "../ui/components.tsx"

function openWorkspace() {
  if (typeof chrome === "undefined" || !chrome.sidePanel?.open) {
    return
  }

  void chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
}

export default function App() {
  const [data, setData] = useState<PopupData>({
    bookmarks: [],
    tags: [],
    bookmarkTags: [],
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
                <Title order={3}>X Bookmark Manager</Title>
                <Text c="dimmed">Quick sync and jump into the full workspace.</Text>
              </div>
              <Badge color="sand" variant="light">
                local-first
              </Badge>
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
            <Title order={4}>Overview</Title>
            <Text>Bookmarks: {data.bookmarks.length}</Text>
            <Text>Tags: {data.tags.length}</Text>
            <Text>Current sync status: {data.summary.status}</Text>
            {data.summary.lastSyncedAt ? <Text>Last synced: {data.summary.lastSyncedAt}</Text> : null}
          </Stack>
        </Card>

        <Button type="button" size="md" color="dark" onClick={openWorkspace}>
          Open workspace
        </Button>
      </Stack>
    </ExtensionUiProvider>
  )
}
