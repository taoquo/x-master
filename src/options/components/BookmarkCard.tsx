import React from "react"
import type { BookmarkRecord, Locale, TagSuggestionRecord } from "../../lib/types.ts"
import { AppIcon } from "../../ui/icons.tsx"
import type { OptionsCopy } from "../i18n/copy.ts"
import {
  cn,
  formatCompactCount,
  formatTimestamp,
  getListCardTemplateClass,
  getListCopyDensityClass,
  getVisibleCardTagNames,
  isVideoMediaType,
  truncateText
} from "../utils.ts"

export function PreviewMedia({
  bookmark,
  index,
  className
}: {
  bookmark: BookmarkRecord
  index: number
  className?: string
}) {
  const primaryMedia = bookmark.media?.[0]
  const mediaUrl = primaryMedia?.url
  const isVideo = isVideoMediaType(primaryMedia?.type)
  const previewUrl = isVideo ? getMediaPosterUrl(bookmark, 0) ?? mediaUrl : mediaUrl

  if (!previewUrl) {
    return null
  }

  return (
    <div
      className={cn(
        "workspace-media-frame options-card-media relative aspect-video overflow-hidden bg-[var(--tag-bg)]",
        className
      )}
      data-card-media-index={index}>
      <img
        src={previewUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  )
}

export function AuthorAvatar({
  avatarUrl,
  initials,
  alt
}: {
  avatarUrl?: string
  initials: string
  alt: string
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={alt} />
  }

  return <>{initials}</>
}

export function getMediaPosterUrl(bookmark: BookmarkRecord, mediaIndex = 0) {
  return bookmark.media?.[mediaIndex]?.posterUrl || undefined
}

export function BookmarkCard({
  bookmark,
  index,
  currentTagNames,
  pendingSuggestions,
  selected,
  bulkSelected,
  viewMode,
  locale,
  copy,
  onSelect,
  onBulkToggle,
  onAcceptSuggestion,
  onRejectSuggestion
}: {
  bookmark: BookmarkRecord
  index: number
  currentTagNames: string[]
  pendingSuggestions: TagSuggestionRecord[]
  selected: boolean
  bulkSelected: boolean
  viewMode: "grid" | "list"
  locale: Locale
  copy: OptionsCopy
  onSelect: () => void
  onBulkToggle: () => void
  onAcceptSuggestion: (suggestionId: string) => void
  onRejectSuggestion: (suggestionId: string) => void
}) {
  const authorInitials = bookmark.authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || bookmark.authorHandle.slice(0, 2).toUpperCase()
  const showsInlineMedia = viewMode === "list" && !!bookmark.media?.length
  const hasTopMediaPreview = !showsInlineMedia && !!bookmark.media?.length
  const mediaPreview = <PreviewMedia bookmark={bookmark} index={index} className={showsInlineMedia ? "options-card-media-inline" : undefined} />
  const hasTags = currentTagNames.length > 0 || pendingSuggestions.length > 0
  const visibleTagNames = getVisibleCardTagNames(currentTagNames, viewMode)
  const listCopyDensityClass = getListCopyDensityClass(bookmark.text, !!bookmark.media?.length, hasTags)
  const listCardTemplateClass = viewMode === "list" ? getListCardTemplateClass(!!bookmark.media?.length, hasTags, listCopyDensityClass) : undefined
  const metricItems = [
    { key: "reply", icon: "comment" as const, value: bookmark.metrics?.replies ?? 0 },
    { key: "retweet", icon: "share" as const, value: bookmark.metrics?.retweets ?? 0 },
    { key: "like", icon: "heart" as const, value: bookmark.metrics?.likes ?? 0 }
  ]

  return (
    <article
      data-bookmark-card={bookmark.tweetId}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "options-result-card options-theme-elevated group relative flex flex-col overflow-hidden",
        viewMode === "list" && "options-result-card-list",
        hasTopMediaPreview && "options-result-card-has-top-media",
        listCardTemplateClass,
        selected && "options-result-card-selected"
      )}>
      <button
        type="button"
        data-testid="bookmark-select-toggle"
        aria-label={`${copy.selectBookmarkForBulk} ${bookmark.authorName || bookmark.authorHandle}`}
        aria-pressed={bulkSelected}
        className={cn("options-bookmark-select-toggle", bulkSelected && "is-selected")}
        onClick={(event) => {
          event.stopPropagation()
          onBulkToggle()
        }}>
        {bulkSelected ? (
          <span data-select-check="" className="options-bookmark-select-check">
            <AppIcon name="check" size={13} />
          </span>
        ) : null}
      </button>
      {!showsInlineMedia ? mediaPreview : null}

      <div className="options-card-body flex flex-1 flex-col">
        <div className="options-card-layout">
          <div className="options-card-column">
            <div className="options-card-main">
              <div className="options-card-avatar">
                <AuthorAvatar
                  avatarUrl={bookmark.authorAvatarUrl}
                  initials={authorInitials}
                  alt={bookmark.authorName || bookmark.authorHandle}
                />
              </div>
              <div className="options-card-content">
                <div className="options-card-header">
                  <div className="options-card-author min-w-0">
                    <div className="options-card-author-name truncate">{bookmark.authorName}</div>
                    <div className="options-card-author-handle truncate">@{bookmark.authorHandle}</div>
                  </div>
                  <div className="options-card-timestamp shrink-0">
                    {formatTimestamp(bookmark.savedAt, locale)}
                  </div>
                </div>

                <div className="options-card-copy-wrap">
                  <p className={cn("options-card-copy options-preserve-whitespace", viewMode === "list" && listCopyDensityClass, !!bookmark.media?.length && "is-media")}>
                    {truncateText(bookmark.text, bookmark.media?.length ? 180 : 260)}
                  </p>
                </div>

                {visibleTagNames.length || pendingSuggestions.length ? (
                  <div className="options-card-tags">
                    {visibleTagNames.map((tagName) => (
                      <span key={tagName} className="options-card-tag">
                        {tagName}
                      </span>
                    ))}
                    {pendingSuggestions.map((suggestion) => (
                      <span
                        key={suggestion.id}
                        data-testid="suggestion-chip"
                        data-suggestion-id={suggestion.id}
                        className="options-card-tag options-card-tag-suggestion">
                        <button
                          type="button"
                          data-testid="suggestion-accept"
                          aria-label={`${copy.acceptSuggestionLabel} ${suggestion.tagName}`}
                          className="options-card-tag-suggestion-accept"
                          onClick={(event) => {
                            event.stopPropagation()
                            onAcceptSuggestion(suggestion.id)
                          }}>
                          {suggestion.tagName}
                        </button>
                        <button
                          type="button"
                          data-testid="suggestion-reject"
                          aria-label={`${copy.rejectSuggestionLabel} ${suggestion.tagName}`}
                          className="options-card-tag-suggestion-reject"
                          onClick={(event) => {
                            event.stopPropagation()
                            onRejectSuggestion(suggestion.id)
                          }}>
                          <AppIcon name="close" size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="options-card-actions">
              {viewMode === "list" ? (
                <div className="options-card-stat-list options-card-actions-start" aria-hidden="true">
                  {metricItems.map((item) => (
                    <span key={item.key} className="options-card-stat">
                      <AppIcon name={item.icon} size={14} />
                      <span>{formatCompactCount(item.value, locale)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="options-card-actions-start">
                  <button type="button" className="options-card-action" tabIndex={-1} aria-hidden="true">
                    <AppIcon name="comment" size={16} />
                  </button>
                  <button type="button" className="options-card-action" tabIndex={-1} aria-hidden="true">
                    <AppIcon name="heart" size={16} />
                  </button>
                  <button type="button" className="options-card-action" tabIndex={-1} aria-hidden="true">
                    <AppIcon name="share" size={16} />
                  </button>
                </div>
              )}
              <button
                type="button"
                className="options-card-action"
                onClick={(event) => {
                  event.stopPropagation()
                  window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")
                }}>
                <AppIcon name="external" size={16} />
              </button>
            </div>
          </div>

          {showsInlineMedia ? (
            <div className="options-card-side">
              {mediaPreview}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
