import React from "react"
import { Card, Checkbox, Table, Text } from "@mantine/core"
import type { BookmarkRecord } from "../../lib/types.ts"

interface InboxTableProps {
  bookmarks: BookmarkRecord[]
  selectedBookmarkId?: string
  selectedBookmarkIds: string[]
  folderNameByBookmarkId: Map<string, string>
  onSelectBookmark: (bookmarkId: string) => void
  onToggleBookmarkSelection: (bookmarkId: string) => void
}

function getSummaryText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function formatCompactDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date)
}

export function InboxTable({
  bookmarks,
  selectedBookmarkId,
  selectedBookmarkIds,
  folderNameByBookmarkId,
  onSelectBookmark,
  onToggleBookmarkSelection
}: InboxTableProps) {
  return (
    <Card
      padding={0}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        background: "rgba(255,255,255,0.94)"
      }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        <Table striped={false} highlightOnHover withTableBorder={false} withColumnBorders={false} style={{ tableLayout: "fixed" }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 68 }}>Select</Table.Th>
              <Table.Th style={{ width: 240 }}>User</Table.Th>
              <Table.Th style={{ width: 180 }}>Folder</Table.Th>
              <Table.Th>Summary</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {!bookmarks.length ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" p="md">
                    No bookmarks match the current filters.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}

            {bookmarks.map((bookmark) => {
              const isActive = bookmark.tweetId === selectedBookmarkId
              const isChecked = selectedBookmarkIds.includes(bookmark.tweetId)
              const summaryText = getSummaryText(bookmark.text)
              const mediaCount = bookmark.media?.length ?? 0

              return (
                <Table.Tr
                  key={bookmark.tweetId}
                  onClick={() => onSelectBookmark(bookmark.tweetId)}
                  style={{
                    background: isActive ? "#eef8ff" : undefined,
                    boxShadow: isActive ? "inset 3px 0 0 #2e9fe9" : undefined,
                    cursor: "pointer"
                  }}>
                  <Table.Td style={{ verticalAlign: "top" }}>
                    <Checkbox
                      checked={isChecked}
                      aria-label={`Select ${bookmark.authorName}`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggleBookmarkSelection(bookmark.tweetId)}
                    />
                  </Table.Td>

                  <Table.Td style={{ verticalAlign: "top" }}>
                    <Text fw={600}>{bookmark.authorName}</Text>
                    <Text size="sm" c="dimmed">
                      @{bookmark.authorHandle}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Saved {formatCompactDate(bookmark.savedAt)}
                    </Text>
                  </Table.Td>

                  <Table.Td style={{ verticalAlign: "top" }}>
                    <Text fw={600}>{folderNameByBookmarkId.get(bookmark.tweetId) ?? "Inbox"}</Text>
                    <Text size="xs" c="dimmed">
                      {mediaCount ? `${mediaCount} media` : `${bookmark.metrics?.likes ?? 0} likes`}
                    </Text>
                  </Table.Td>

                  <Table.Td style={{ verticalAlign: "top" }}>
                    <div
                      title={summaryText}
                      style={{
                        display: "-webkit-box",
                        overflow: "hidden",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical"
                      }}>
                      {summaryText || "Untitled bookmark"}
                    </div>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </div>
    </Card>
  )
}
