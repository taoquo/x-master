import React from "react"
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

export function InboxTable({
  bookmarks,
  selectedBookmarkId,
  selectedBookmarkIds,
  folderNameByBookmarkId,
  onSelectBookmark,
  onToggleBookmarkSelection
}: InboxTableProps) {
  return (
    <section
      style={{
        minHeight: 0,
        display: "grid",
        border: "1px solid #d7e3ee",
        borderRadius: 16,
        background: "#ffffff",
        overflow: "hidden"
      }}>
      <div style={{ minHeight: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#f8fbfd", borderBottom: "1px solid #d7e3ee" }}>
              <th style={{ width: 64, padding: "12px 10px", textAlign: "left" }}>Select</th>
              <th style={{ width: 220, padding: "12px 10px", textAlign: "left" }}>User</th>
              <th style={{ width: 160, padding: "12px 10px", textAlign: "left" }}>Folder</th>
              <th style={{ padding: "12px 10px", textAlign: "left" }}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {!bookmarks.length ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, color: "#52606d" }}>
                  No bookmarks match the current filters.
                </td>
              </tr>
            ) : null}
            {bookmarks.map((bookmark) => {
              const isActive = bookmark.tweetId === selectedBookmarkId
              const isChecked = selectedBookmarkIds.includes(bookmark.tweetId)
              const summaryText = getSummaryText(bookmark.text)

              return (
                <tr
                  key={bookmark.tweetId}
                  onClick={() => onSelectBookmark(bookmark.tweetId)}
                  style={{
                    background: isActive ? "#eef6ff" : "#ffffff",
                    borderBottom: "1px solid #e6edf5",
                    cursor: "pointer"
                  }}>
                  <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      aria-label={`Select ${bookmark.authorName}`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggleBookmarkSelection(bookmark.tweetId)}
                    />
                  </td>
                  <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{bookmark.authorName}</strong>
                      <span style={{ color: "#52606d" }}>@{bookmark.authorHandle}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 10px", verticalAlign: "top", color: "#334e68" }}>
                    {folderNameByBookmarkId.get(bookmark.tweetId) ?? "Inbox"}
                  </td>
                  <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                    <div
                      title={summaryText}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                      {summaryText || "Untitled bookmark"}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
