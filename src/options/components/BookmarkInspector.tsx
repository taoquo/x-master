import React, { useEffect, useRef, useState } from "react"
import type {
  BookmarkRecord,
  BookmarkTagRecord,
  Locale,
  TagRecord
} from "../../lib/types.ts"
import { SurfaceCard } from "../../ui/components.tsx"
import { AppIcon } from "../../ui/icons.tsx"

type DetailCopy = {
  detailsTitle: string
  openOnX: string
  bookmarkFocus: string
  noBookmarkSelectedDescription: string
  timeLabel: string
  savedTime: string
  summaryTitle: string
  mediaTitle: string
  closePreview: string
  previousMedia: string
  nextMedia: string
  tagsTitle: string
  noTagsYet: string
  addTag: string
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function createFieldId(scope: string, name: string) {
  return `${scope}-${name}`
}

function getSectionOverline(locale: Locale, zhLabel: string, enLabel: string) {
  return locale === "zh-CN" ? zhLabel : enLabel
}

function formatTimestamp(value: string | undefined, locale: Locale) {
  if (!value) {
    return locale === "zh-CN" ? "尚未同步" : "Not synced yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed)
}

function isVideoMediaType(type: string | undefined) {
  return type === "video" || type === "animated_gif"
}

function getMediaPosterUrl(bookmark: BookmarkRecord, mediaIndex = 0) {
  const mediaItem = bookmark.media?.[mediaIndex]

  if (!mediaItem) {
    return undefined
  }

  if (mediaItem.posterUrl) {
    return mediaItem.posterUrl
  }

  const rawMedia = (bookmark.rawPayload as any)?.legacy?.extended_entities?.media?.[mediaIndex]
  return rawMedia?.media_url_https ?? rawMedia?.media_url ?? undefined
}

function SelectField({
  id,
  value,
  onChange,
  options,
  className,
  dataTestId,
  ariaLabel
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
  dataTestId?: string
  ariaLabel?: string
}) {
  return (
    <select
      id={id}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={cn("field-shell w-full appearance-none pr-10", className)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function BookmarkMediaSection({
  bookmark,
  locale,
  copy,
  onPreview
}: {
  bookmark: BookmarkRecord
  locale: Locale
  copy: DetailCopy
  onPreview: (mediaUrl: string) => void
}) {
  const primaryMedia = bookmark.media?.[0]
  const mediaUrl = primaryMedia?.url
  const isVideo = isVideoMediaType(primaryMedia?.type)
  const mediaPosterUrl = getMediaPosterUrl(bookmark, 0) ?? mediaUrl

  if (!mediaUrl) {
    return null
  }

  return (
    <section data-testid="inspector-media-section" className="options-inspector-section options-inspector-divider options-detail-media-section options-detail-media-flow">
      <div className="options-detail-section-overline options-detail-media-head">
        <span>{getSectionOverline(locale, copy.mediaTitle, "Media")}</span>
        {bookmark.media && bookmark.media.length > 1 ? <span className="options-detail-media-meta">{bookmark.media.length}</span> : null}
      </div>
      {isVideo ? (
        <button
          type="button"
          data-testid="inspector-media-trigger"
          className="options-inspector-media-trigger options-detail-media-trigger mt-3"
          onClick={() => onPreview(mediaUrl)}>
          <div className="options-inspector-media-shell options-detail-media-shell">
            <img src={mediaPosterUrl} alt="" className="h-72 w-full object-cover" />
            <div className="options-inspector-media-center-play">
              <AppIcon name="play" size={28} />
            </div>
            {bookmark.media && bookmark.media.length > 1 ? (
              <div className="options-inspector-media-count">
                {bookmark.media.length}
              </div>
            ) : null}
          </div>
        </button>
      ) : (
        <button
          type="button"
          data-testid="inspector-media-trigger"
          className="options-inspector-media-trigger options-detail-media-trigger mt-3"
          onClick={() => onPreview(mediaUrl)}>
          <div className="options-inspector-media-shell options-detail-media-shell">
            <img src={mediaUrl} alt="" className="h-72 w-full object-cover" />
            {bookmark.media && bookmark.media.length > 1 ? (
              <div className="options-inspector-media-count">
                {bookmark.media.length}
              </div>
            ) : null}
          </div>
        </button>
      )}
    </section>
  )
}

function EmptyInspectorState({ copy }: { copy: DetailCopy }) {
  return (
    <SurfaceCard chrome="bare" className="options-inspector-shell xl:h-[100dvh]">
      <div
        data-testid="inspector-section-stack"
        className="scroll-shell workspace-empty-state flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto border-0 bg-transparent px-6 text-center shadow-none">
        <div className="options-inspector-empty-icon">
          <AppIcon name="bookmark" size={28} />
        </div>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">{copy.noBookmarkSelectedDescription}</p>
      </div>
    </SurfaceCard>
  )
}

function DetailDrawerHeader({
  bookmark,
  copy,
  authorInitials,
  onClose
}: {
  bookmark: BookmarkRecord
  copy: DetailCopy
  authorInitials: string
  onClose: () => void
}) {
  return (
    <section data-testid="detail-hero-section" className="options-detail-hero">
      <div className="options-detail-hero-main min-w-0">
        <div className="options-inspector-avatar">{authorInitials}</div>
        <div className="options-detail-hero-copy min-w-0">
          <div className="options-detail-hero-eyebrow">{copy.bookmarkFocus}</div>
          <p className="options-detail-hero-name truncate">{bookmark.authorName}</p>
          <p className="options-detail-hero-handle truncate">@{bookmark.authorHandle}</p>
        </div>
      </div>
      <div data-testid="detail-primary-actions" className="options-detail-hero-actions">
        <button
          type="button"
          data-testid="detail-open-x-link"
          aria-label={copy.openOnX}
          className="options-detail-drawer-open-link options-open-x-button options-theme-elevated"
          onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
          <AppIcon name="external" size={14} />
          <span>{copy.openOnX}</span>
        </button>
        <button
          type="button"
          data-testid="detail-drawer-close"
          aria-label={copy.detailsTitle}
          className="options-detail-drawer-close"
          onClick={onClose}>
          <AppIcon name="close" size={16} />
        </button>
      </div>
    </section>
  )
}

function DetailMetadataSection({
  copy,
  detailTimestamp,
  savedTimestamp
}: {
  copy: DetailCopy
  detailTimestamp: string
  savedTimestamp: string
}) {
  return (
    <section data-testid="inspector-metadata-section" className="options-detail-drawer-meta">
      <div className="options-detail-drawer-meta-row options-detail-meta-grid">
        <div className="options-detail-meta-item">
          <span className="options-detail-meta-label">{copy.timeLabel}</span>
          <span className="options-detail-meta-value">{detailTimestamp}</span>
        </div>
        <div className="options-detail-meta-item">
          <span className="options-detail-meta-label">{copy.savedTime}</span>
          <span className="options-detail-meta-value">{savedTimestamp}</span>
        </div>
      </div>
    </section>
  )
}

function DetailSummarySection({
  copy,
  text
}: {
  copy: DetailCopy
  text: string
}) {
  return (
    <section data-testid="inspector-summary-section" className="options-inspector-section options-detail-summary-card options-detail-summary-flow">
      <div className="options-detail-section-overline">{copy.summaryTitle}</div>
      <p className="options-body-copy options-inspector-summary options-detail-summary-copy">{text}</p>
    </section>
  )
}

function DetailTagsSection({
  locale,
  copy,
  tags,
  currentTags,
  availableTagOptions,
  selectedTagId,
  isAttachTagOpen,
  attachSelectId,
  onSelectedTagIdChange,
  onAttachTag,
  onDetachTag,
  onAttachTagOpenChange
}: {
  locale: Locale
  copy: DetailCopy
  tags: TagRecord[]
  currentTags: TagRecord[]
  availableTagOptions: TagRecord[]
  selectedTagId: string
  isAttachTagOpen: boolean
  attachSelectId: string
  onSelectedTagIdChange: (tagId: string) => void
  onAttachTag: (tagId: string) => Promise<void>
  onDetachTag: (tagId: string) => Promise<void>
  onAttachTagOpenChange: (open: boolean) => void
}) {
  return (
    <section data-testid="inspector-tags-section" className="options-inspector-section options-inspector-divider options-detail-tags-section">
      <div className="options-detail-section-overline">{getSectionOverline(locale, copy.tagsTitle, "Tags")}</div>
      <div className="options-detail-tag-group options-detail-tag-group-current">
        <div data-testid="current-tags" className="options-detail-current-tags mt-2 flex flex-wrap gap-2">
          {!currentTags.length ? <span className="options-meta-copy">{copy.noTagsYet}</span> : null}
          {currentTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => void onDetachTag(tag.id)}
              className="chip-button options-tag-pill options-theme-elevated">
              <span>{tag.name}</span>
              <AppIcon name="close" size={12} />
            </button>
          ))}
        </div>
      </div>
      {availableTagOptions.length || !tags.length ? (
        <div className="options-detail-tag-group options-detail-tag-group-add">
          <div className="options-detail-tag-actions">
            {availableTagOptions.length && isAttachTagOpen ? (
              <div data-testid="attach-tag-inline-shell" className="options-tag-inline-editor">
                <SelectField
                  id={attachSelectId}
                  dataTestId="attach-tag-select"
                  value={selectedTagId}
                  onChange={(nextTagId) => {
                    onSelectedTagIdChange(nextTagId)

                    if (!nextTagId) {
                      return
                    }

                    void onAttachTag(nextTagId)
                      .then(() => {
                        onSelectedTagIdChange("")
                        onAttachTagOpenChange(false)
                      })
                      .catch(() => {
                        onSelectedTagIdChange("")
                        onAttachTagOpenChange(false)
                      })
                  }}
                  options={[
                    { value: "", label: copy.addTag },
                    ...availableTagOptions.map((tag) => ({ value: tag.id, label: tag.name }))
                  ]}
                  className="options-tag-inline-select"
                />
              </div>
            ) : (
              <button
                type="button"
                data-testid="attach-tag-trigger"
                aria-label={copy.addTag}
                className="chip-button options-tag-pill options-tag-pill-add options-detail-add-tag options-theme-elevated"
                disabled={!availableTagOptions.length}
                onClick={() => onAttachTagOpenChange(true)}>
                <span aria-hidden="true">+</span>
                <span>{copy.addTag}</span>
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DetailMediaLightbox({
  copy,
  previewMediaUrl,
  previewMediaIsVideo,
  previewMediaPosterUrl,
  previewMediaIndex,
  mediaItemsLength,
  hasMultipleMedia,
  lightboxRef,
  lightboxCloseButtonRef,
  onClose,
  onPrev,
  onNext
}: {
  copy: DetailCopy
  previewMediaUrl: string
  previewMediaIsVideo: boolean
  previewMediaPosterUrl: string | null
  previewMediaIndex: number
  mediaItemsLength: number
  hasMultipleMedia: boolean
  lightboxRef: React.RefObject<HTMLDivElement | null>
  lightboxCloseButtonRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div
      ref={lightboxRef}
      data-testid="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={copy.mediaTitle}
      className="options-media-lightbox options-theme-overlay">
      <button
        type="button"
        data-testid="media-lightbox-backdrop"
        aria-label={copy.mediaTitle}
        className="options-media-lightbox-backdrop"
        onClick={onClose}
      />
      <div className="options-media-lightbox-shell options-theme-panel">
        <div className="options-media-lightbox-toolbar">
          <button
            ref={lightboxCloseButtonRef}
            type="button"
            data-testid="media-lightbox-close"
            aria-label={copy.closePreview}
            className="options-media-lightbox-close"
            onClick={onClose}>
            <AppIcon name="close" size={18} />
          </button>
        </div>
        <div className="options-media-lightbox-stage">
          {hasMultipleMedia ? (
            <button
              type="button"
              data-testid="media-lightbox-prev"
              aria-label={copy.previousMedia}
              className="options-media-lightbox-nav is-prev"
              onClick={onPrev}>
              <span aria-hidden="true">‹</span>
            </button>
          ) : (
            <div className="options-media-lightbox-nav-spacer" aria-hidden="true" />
          )}
          <div
            data-testid="media-lightbox-content"
            className="options-media-lightbox-content options-theme-elevated">
            {previewMediaIsVideo ? (
              <video
                data-testid="media-lightbox-video"
                src={previewMediaUrl}
                poster={previewMediaPosterUrl ?? undefined}
                controls
                preload="metadata"
                className="options-media-lightbox-image"
              />
            ) : (
              <img
                data-testid="media-lightbox-image"
                src={previewMediaUrl}
                alt=""
                className="options-media-lightbox-image"
              />
            )}
          </div>
          {hasMultipleMedia ? (
            <button
              type="button"
              data-testid="media-lightbox-next"
              aria-label={copy.nextMedia}
              className="options-media-lightbox-nav is-next"
              onClick={onNext}>
              <span aria-hidden="true">›</span>
            </button>
          ) : (
            <div className="options-media-lightbox-nav-spacer" aria-hidden="true" />
          )}
        </div>
        {hasMultipleMedia ? (
          <div className="options-media-lightbox-footer">
            <div className="options-media-lightbox-counter">
              {previewMediaIndex + 1} / {mediaItemsLength}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function BookmarkInspector({
  bookmark,
  tags,
  bookmarkTags,
  locale,
  copy,
  onAttachTag,
  onDetachTag,
  onClose
}: {
  bookmark: BookmarkRecord | null
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  locale: Locale
  copy: DetailCopy
  onAttachTag: (tagId: string) => Promise<void>
  onDetachTag: (tagId: string) => Promise<void>
  onClose: () => void
}) {
  const [selectedTagId, setSelectedTagId] = useState("")
  const [isAttachTagOpen, setIsAttachTagOpen] = useState(false)
  const [previewMediaIndex, setPreviewMediaIndex] = useState<number | null>(null)
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null)
  const lightboxRef = useRef<HTMLDivElement | null>(null)
  const lightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)
  const mediaItems = bookmark?.media ?? []
  const hasMultipleMedia = mediaItems.length > 1

  useEffect(() => {
    setSelectedTagId("")
    setIsAttachTagOpen(false)
    setPreviewMediaIndex(null)
    if (inspectorScrollRef.current) {
      if (typeof inspectorScrollRef.current.scrollTo === "function") {
        inspectorScrollRef.current.scrollTo({ top: 0, behavior: "auto" })
      } else {
        inspectorScrollRef.current.scrollTop = 0
      }
    }
  }, [bookmark?.tweetId])

  useEffect(() => {
    if (previewMediaIndex === null || typeof window === "undefined") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewMediaIndex(null)
        return
      }

      if (event.key === "Tab") {
        const focusableElements = Array.from(
          lightboxRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        ).filter((element) => element.offsetParent !== null || element === document.activeElement)

        if (!focusableElements.length) {
          event.preventDefault()
          lightboxCloseButtonRef.current?.focus()
          return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        const activeElement = document.activeElement

        if (event.shiftKey) {
          if (activeElement === firstElement || !focusableElements.includes(activeElement as HTMLElement)) {
            event.preventDefault()
            lastElement.focus()
          }
          return
        }

        if (activeElement === lastElement || !focusableElements.includes(activeElement as HTMLElement)) {
          event.preventDefault()
          firstElement.focus()
        }
        return
      }

      if (event.key === "ArrowRight" && mediaItems.length > 1) {
        setPreviewMediaIndex((current) => {
          if (current === null) {
            return 0
          }

          return (current + 1) % mediaItems.length
        })
        return
      }

      if (event.key === "ArrowLeft" && mediaItems.length > 1) {
        setPreviewMediaIndex((current) => {
          if (current === null) {
            return 0
          }

          return (current - 1 + mediaItems.length) % mediaItems.length
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mediaItems, previewMediaIndex])

  useEffect(() => {
    if (previewMediaIndex !== null) {
      lightboxCloseButtonRef.current?.focus()
      return
    }

    lastFocusedElementRef.current?.focus()
  }, [previewMediaIndex])

  useEffect(() => {
    if (!bookmark || typeof window === "undefined") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && previewMediaIndex === null) {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [bookmark, onClose, previewMediaIndex])

  useEffect(() => {
    if (previewMediaIndex === null || mediaItems.length < 2 || typeof Image === "undefined") {
      return
    }

    const preloadIndexes = [
      (previewMediaIndex + 1) % mediaItems.length,
      (previewMediaIndex - 1 + mediaItems.length) % mediaItems.length
    ]

    for (const index of new Set(preloadIndexes)) {
      if (index === previewMediaIndex) {
        continue
      }

      const mediaItem = mediaItems[index]
      if (!mediaItem || isVideoMediaType(mediaItem.type)) {
        continue
      }

      const preloadedImage = new Image()
      preloadedImage.decoding = "async"
      preloadedImage.src = mediaItem.url
    }
  }, [mediaItems, previewMediaIndex])

  const activePreviewMedia = previewMediaIndex === null ? null : mediaItems[previewMediaIndex] ?? null
  const previewMediaUrl = activePreviewMedia?.url ?? null
  const previewMediaIsVideo = isVideoMediaType(activePreviewMedia?.type)
  const previewMediaPosterUrl = bookmark && previewMediaIndex !== null
    ? getMediaPosterUrl(bookmark, previewMediaIndex) ?? activePreviewMedia?.posterUrl ?? null
    : null

  function handleOpenPreview(mediaUrl: string) {
    const activeElement = typeof document !== "undefined" ? document.activeElement : null
    lastFocusedElementRef.current = activeElement && "focus" in activeElement
      ? (activeElement as HTMLElement)
      : null
    const nextIndex = mediaItems.findIndex((item) => item.url === mediaUrl)
    setPreviewMediaIndex(nextIndex >= 0 ? nextIndex : 0)
  }

  function handleNextPreview() {
    if (!mediaItems.length) {
      return
    }

    setPreviewMediaIndex((current) => {
      const safeIndex = current ?? 0
      return (safeIndex + 1) % mediaItems.length
    })
  }

  function handlePrevPreview() {
    if (!mediaItems.length) {
      return
    }

    setPreviewMediaIndex((current) => {
      const safeIndex = current ?? 0
      return (safeIndex - 1 + mediaItems.length) % mediaItems.length
    })
  }

  if (!bookmark) {
    return <EmptyInspectorState copy={copy} />
  }

  const currentTags = tags.filter((tag) =>
    bookmarkTags.some((bookmarkTag) => bookmarkTag.bookmarkId === bookmark.tweetId && bookmarkTag.tagId === tag.id)
  )
  const availableTagOptions = tags.filter((tag) => !currentTags.some((currentTag) => currentTag.id === tag.id))

  const attachSelectId = createFieldId("details", "attach-tag")
  const detailTimestamp = formatTimestamp(bookmark.createdAtOnX || bookmark.savedAt, locale)
  const savedTimestamp = formatTimestamp(bookmark.savedAt, locale)
  const authorInitials = bookmark.authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || bookmark.authorHandle.slice(0, 2).toUpperCase()

  return (
    <SurfaceCard chrome="bare" className="options-inspector-shell options-detail-drawer xl:h-[100dvh]">
      <DetailDrawerHeader
        bookmark={bookmark}
        copy={copy}
        authorInitials={authorInitials}
        onClose={onClose}
      />
      <div
        ref={inspectorScrollRef}
        data-testid="inspector-section-stack"
        className="scroll-shell flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        <DetailMetadataSection
          copy={copy}
          detailTimestamp={detailTimestamp}
          savedTimestamp={savedTimestamp}
        />
        <BookmarkMediaSection
          bookmark={bookmark}
          locale={locale}
          copy={copy}
          onPreview={handleOpenPreview}
        />
        <DetailSummarySection copy={copy} text={bookmark.text} />
        <DetailTagsSection
          locale={locale}
          copy={copy}
          tags={tags}
          currentTags={currentTags}
          availableTagOptions={availableTagOptions}
          selectedTagId={selectedTagId}
          isAttachTagOpen={isAttachTagOpen}
          attachSelectId={attachSelectId}
          onSelectedTagIdChange={setSelectedTagId}
          onAttachTag={onAttachTag}
          onDetachTag={onDetachTag}
          onAttachTagOpenChange={setIsAttachTagOpen}
        />
      </div>
      {previewMediaUrl ? (
        <DetailMediaLightbox
          copy={copy}
          previewMediaUrl={previewMediaUrl}
          previewMediaIsVideo={previewMediaIsVideo}
          previewMediaPosterUrl={previewMediaPosterUrl}
          previewMediaIndex={previewMediaIndex!}
          mediaItemsLength={mediaItems.length}
          hasMultipleMedia={hasMultipleMedia}
          lightboxRef={lightboxRef}
          lightboxCloseButtonRef={lightboxCloseButtonRef}
          onClose={() => setPreviewMediaIndex(null)}
          onPrev={handlePrevPreview}
          onNext={handleNextPreview}
        />
      ) : null}
    </SurfaceCard>
  )
}
