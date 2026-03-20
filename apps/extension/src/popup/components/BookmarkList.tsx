import React from "react"
import { Stack, Text } from "@mantine/core"
import type { BookmarkRecord } from "../../lib/types.ts"
import { BookmarkCard } from "./BookmarkCard.tsx"
import { EmptyState, SectionHeader } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"

interface BookmarkListProps {
  bookmarks: BookmarkRecord[]
  selectedBookmarkId?: string
  resultCount: number
  sortLabel: string
  folderLabel: string
  onSelectBookmark: (bookmarkId: string) => void
  selectionEnabled?: boolean
  selectedBookmarkIds?: string[]
  onToggleBookmarkSelection?: (bookmarkId: string) => void
}

export function BookmarkList({
  bookmarks,
  selectedBookmarkId,
  resultCount,
  sortLabel,
  folderLabel,
  onSelectBookmark,
  selectionEnabled = false,
  selectedBookmarkIds = [],
  onToggleBookmarkSelection
}: BookmarkListProps) {
  return (
    <ExtensionUiProvider>
      <Stack gap="md" h="100%">
        <div>
          <SectionHeader title="Bookmarks" description={`${folderLabel} · ${resultCount} result(s)`} />
          <Text size="sm" c="dimmed" mt={4}>
            Sorted by {sortLabel}
          </Text>
        </div>
        <div style={{ overflowY: "auto", paddingRight: 4 }}>
          <Stack gap="md">
          {!bookmarks.length ? <EmptyState title="No bookmarks match the current filters." description="Adjust the current query or browse a different context." /> : null}
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.tweetId}
              bookmark={bookmark}
              isSelected={bookmark.tweetId === selectedBookmarkId}
              onSelect={onSelectBookmark}
              selectionEnabled={selectionEnabled}
              isChecked={selectedBookmarkIds.includes(bookmark.tweetId)}
              onToggleChecked={onToggleBookmarkSelection}
            />
          ))}
          </Stack>
        </div>
      </Stack>
    </ExtensionUiProvider>
  )
}
