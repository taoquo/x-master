import React from "react"
import type { BookmarkRecord } from "../../lib/types.ts"

interface BookmarkCardProps {
  bookmark: BookmarkRecord
  isSelected: boolean
  onSelect: (bookmarkId: string) => void
}

export function BookmarkCard({ bookmark, isSelected, onSelect }: BookmarkCardProps) {
  const previewMedia = bookmark.media?.[0]
  const previewText = bookmark.text.length > 160 ? `${bookmark.text.slice(0, 160)}...` : bookmark.text

  return (
    <article>
      <h3>{bookmark.authorName}</h3>
      <p>@{bookmark.authorHandle}</p>
      <p>{previewText}</p>
      <p>Saved: {bookmark.savedAt}</p>
      <p>On X: {bookmark.createdAtOnX}</p>
      <p>
        Likes: {bookmark.metrics?.likes ?? 0} Retweets: {bookmark.metrics?.retweets ?? 0} Replies: {bookmark.metrics?.replies ?? 0}
      </p>
      {previewMedia ? (
        <figure>
          <img src={previewMedia.url} alt={previewMedia.altText ?? "Bookmark media preview"} width="160" />
          <figcaption>{bookmark.media?.length ?? 0} media item(s)</figcaption>
        </figure>
      ) : null}
      <button type="button" aria-pressed={isSelected} onClick={() => onSelect(bookmark.tweetId)}>
        {isSelected ? "Selected" : "View details"}
      </button>
    </article>
  )
}
