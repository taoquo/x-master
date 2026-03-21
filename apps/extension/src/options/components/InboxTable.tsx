import React from "react"
import { Badge, Checkbox, Group, Stack, Text, UnstyledButton } from "@mantine/core"
import type { BookmarkRecord } from "../../lib/types.ts"

interface InboxTableProps {
  bookmarks: BookmarkRecord[]
  selectedBookmarkId?: string
  selectedBookmarkIds: string[]
  onSelectBookmark: (bookmarkId: string) => void
  onToggleBookmarkSelection: (bookmarkId: string) => void
}

function getSummaryText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function getHeadline(text: string) {
  const summary = getSummaryText(text)
  if (!summary) {
    return "Untitled bookmark"
  }

  const [headline] = summary.split(/(?<=[.!?])\s/)
  return headline.length > 52 ? `${headline.slice(0, 49)}...` : headline
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const diffMs = Date.now() - date.getTime()
  const day = 24 * 60 * 60 * 1000

  if (diffMs < day) {
    return "Today"
  }
  if (diffMs < day * 2) {
    return "1 day ago"
  }

  return `${Math.round(diffMs / day)} days ago`
}

function buildChips(bookmark: BookmarkRecord) {
  const chips: Array<{ label: string; variant: "dark" | "muted" | "outline" }> = []

  chips.push({ label: bookmark.text.trim().length > 280 ? "Longform" : "Standard", variant: "dark" })

  if (bookmark.media?.length) {
    chips.push({ label: `${bookmark.media.length} media`, variant: "muted" })
  }

  if ((bookmark.metrics?.likes ?? 0) > 0) {
    chips.push({ label: `${bookmark.metrics?.likes} likes`, variant: "outline" })
  }

  return chips
}

export function InboxTable({
  bookmarks,
  selectedBookmarkId,
  selectedBookmarkIds,
  onSelectBookmark,
  onToggleBookmarkSelection
}: InboxTableProps) {
  return (
    <Stack gap="xs" style={{ minHeight: 0, overflow: "auto" }}>
      {!bookmarks.length ? (
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            border: "1px solid #e4e4e7",
            background: "#ffffff"
          }}>
          <Text c="dimmed">No bookmarks match the current filters.</Text>
        </div>
      ) : null}

      {bookmarks.map((bookmark) => {
        const isActive = bookmark.tweetId === selectedBookmarkId
        const isChecked = selectedBookmarkIds.includes(bookmark.tweetId)
        const summaryText = getSummaryText(bookmark.text)
        const chips = buildChips(bookmark)
        const hasAttentionDot = Boolean(bookmark.media?.length) || bookmark.text.trim().length > 280

        return (
          <UnstyledButton
            key={bookmark.tweetId}
            type="button"
            onClick={() => onSelectBookmark(bookmark.tweetId)}
            style={{
              display: "block",
              width: "100%",
              padding: 16,
              borderRadius: 8,
              border: `1px solid ${isActive ? "#18181b" : "#e4e4e7"}`,
              background: isActive ? "#f4f4f5" : "#ffffff",
              boxShadow: isActive ? "0 8px 24px rgba(24,24,27,0.08)" : undefined,
              textAlign: "left"
            }}>
            <Stack gap={8}>
              <Group justify="space-between" align="start" wrap="nowrap">
                <Group gap={12} wrap="nowrap">
                  <Checkbox
                    checked={isChecked}
                    aria-label={`Select ${bookmark.authorName}`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggleBookmarkSelection(bookmark.tweetId)}
                  />
                  <Group gap={10} wrap="nowrap">
                    <Text fw={600} size="sm">
                      {bookmark.authorName}
                    </Text>
                    {hasAttentionDot ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: "#2563eb",
                          flexShrink: 0
                        }}
                      />
                    ) : null}
                  </Group>
                </Group>
                <Text size="xs" c="dimmed">
                  {formatRelativeDate(bookmark.savedAt)}
                </Text>
              </Group>

              <Text size="xs" c="#18181b">
                {getHeadline(bookmark.text)}
              </Text>

              <Text size="sm" c="dimmed" lineClamp={3}>
                {summaryText}
              </Text>

              <Group gap="xs" wrap="wrap">
                {chips.map((chip) => (
                  <Badge
                    key={`${bookmark.tweetId}-${chip.label}`}
                    variant={chip.variant === "outline" ? "outline" : "filled"}
                    color={chip.variant === "dark" ? "dark" : "gray"}
                    styles={
                      chip.variant === "muted"
                        ? {
                            root: {
                              background: "#f4f4f5",
                              color: "#18181b",
                              borderColor: "#f4f4f5"
                            }
                          }
                        : undefined
                    }>
                    {chip.label}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </UnstyledButton>
        )
      })}
    </Stack>
  )
}
