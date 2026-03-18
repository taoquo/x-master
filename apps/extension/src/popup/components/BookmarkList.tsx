import React from "react"
import type { BookmarkRecord } from "../../lib/types.ts"
import { BookmarkCard } from "./BookmarkCard.tsx"

interface BookmarkListProps {
  bookmarks: BookmarkRecord[]
  selectedBookmarkId?: string
  resultCount: number
  sortLabel: string
  folderLabel: string
  onSelectBookmark: (bookmarkId: string) => void
}

export function BookmarkList({
  bookmarks,
  selectedBookmarkId,
  resultCount,
  sortLabel,
  folderLabel,
  onSelectBookmark
}: BookmarkListProps) {
  return (
    <section style={{ display: "grid", minHeight: 0 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          paddingBottom: 10,
          borderBottom: "1px solid #dde7f0",
          marginBottom: 12
        }}>
        <div>
          <h2 style={{ margin: 0 }}>Bookmarks</h2>
          <p style={{ margin: "4px 0 0", color: "#52606d" }}>
            {folderLabel} · {resultCount} result(s)
          </p>
        </div>
        <span style={{ fontSize: 13, color: "#52606d" }}>Sorted by {sortLabel}</span>
      </header>
      <div style={{ display: "grid", gap: 12, overflowY: "auto", paddingRight: 4 }}>
      {!bookmarks.length ? <p>No bookmarks match the current filters.</p> : null}
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.tweetId}
          bookmark={bookmark}
          isSelected={bookmark.tweetId === selectedBookmarkId}
          onSelect={onSelectBookmark}
        />
      ))}
      </div>
    </section>
  )
}
