import React, { startTransition, useEffect, useMemo, useRef, useState } from "react"
import type {
  BookmarkRecord,
  BookmarkTagRecord,
  Locale,
  TagRecord
} from "../lib/types.ts"
import {
  filterBookmarks,
  filterBookmarksByAuthors,
  filterBookmarksByFlags,
  sortBookmarks,
  type BookmarkSortOrder,
} from "../lib/search/searchBookmarks.ts"
import {
  buildAuthorSidebarItems,
  formatAuthorLabel,
  getVisibleAuthorSidebarItems,
  type AuthorSidebarItem
} from "./authorSidebar.ts"
import { useWorkspaceData } from "./hooks/useWorkspaceData.ts"
import { getSettings, saveSettings } from "../lib/storage/settings.ts"
import { EmptyState, StatusBadge, SurfaceCard } from "../ui/components.tsx"
import { BrandLogo } from "../ui/branding.tsx"
import { ExtensionUiProvider, useExtensionUi } from "../ui/provider.tsx"
import { AppIcon } from "../ui/icons.tsx"

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function haveSameItems(current: string[], next: string[]) {
  return current.length === next.length && current.every((value, index) => value === next[index])
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

function getSectionOverline(locale: Locale, zhLabel: string, enLabel: string) {
  return locale === "zh-CN" ? zhLabel : enLabel
}

function getOptionsCopy(locale: Locale) {
  if (locale === "zh-CN") {
    return {
      workspaceBadge: "书签工作区",
      pageTitle: "书签",
      pageDescription: "",
      lastSync: "上次同步",
      syncNow: "立即同步",
      syncing: "同步中...",
      exportData: "导出数据",
      exporting: "导出中...",
      totalTags: "总标签数",
      unclassified: "未分类",
      unclassifiedHint: "仍在等待标签覆盖。",
      preferencesTitle: "偏好设置",
      preferencesDescription: "",
      languageLabel: "语言",
      themeLabel: "主题",
      listsTitle: "书签列表",
      allBookmarks: "全部书签",
      newList: "新建列表",
      newListDescription: "",
      createList: "创建列表",
      libraryTitle: "资料库",
      libraryDescription: "",
      search: "搜索",
      searchPlaceholder: "搜索书签、作者和备注...",
      filters: "筛选",
      filterConditions: "筛选条件",
      filterDescription: "选择要应用的过滤条件。",
      latestSaved: "最近保存",
      activeFilters: "活跃筛选:",
      sortBy: "排序方式",
      newestSaved: "最近保存",
      oldestSaved: "最早保存",
      newestPublished: "最近发布",
      mostLiked: "最多喜欢",
      savedTime: "保存时间",
      anyTime: "任意时间",
      last7Days: "最近 7 天",
      last30Days: "最近 30 天",
      last90Days: "最近 90 天",
      hasMedia: "包含媒体",
      longform: "长文",
      unread: "未读",
      archived: "已归档",
      author: "作者",
      authorsTitle: "作者",
      searchAuthors: "搜索作者",
      searchAuthorsPlaceholder: "搜索作者...",
      showMore: "展开更多",
      allAuthors: "所有作者",
      tag: "标签",
      allTags: "所有标签",
      noActiveFilters: "",
      clearAll: "清除全部",
      clearSelection: "清除选择",
      moveSelectedTo: "将选中项移动到",
      chooseList: "选择列表",
      moveSelected: "移动选中项",
      tagSelectedWith: "为选中项添加标签",
      chooseTag: "选择标签",
      applyTag: "应用标签",
      noBookmarksTitle: "当前筛选条件下没有匹配的书签",
      noBookmarksDescription: "",
      detailsTitle: "详情",
      detailsDescription: "",
      noBookmarkSelectedTitle: "尚未选择书签",
      noBookmarkSelectedDescription: "选择一个书签以查看详情",
      metadataTitle: "元数据",
      detailLabel: "详情",
      timeLabel: "时间",
      summaryTitle: "内容摘要",
      mediaTitle: "媒体资源",
      openOnX: "在 X 中打开",
      tagsTitle: "标签",
      closePreview: "关闭预览",
      previousMedia: "上一张",
      nextMedia: "下一张",
      noTagsYet: "还没有标签。",
      attachExistingTag: "附加已有标签",
      selectTag: "选择标签",
      addTag: "添加标签",
      assignmentTitle: "归档",
      bookmarkFocus: "书签内容",
      primaryList: "主列表",
      createTagLabel: "创建标签",
      createTagDescription: "",
      create: "创建",
      createTagPrompt: "输入新标签名称",
      deleteTagConfirmPrefix: "确认删除标签",
      tagLibrary: "标签库",
      noTagsCreated: "还没有创建任何标签。",
      results: "结果",
      selected: "已选择",
      noList: "未分组",
      loadingStateDescription: "正在从扩展运行时加载本地状态。",
      scopedTo: "当前范围",
      listPrefix: "列表",
      searchPrefix: "搜索",
      authorPrefix: "作者",
      tagPrefix: "标签",
      showing: "显示",
      of: "/",
      deleteLabel: "删除",
      selectBookmark: "选择",
      currentLocalInventory: "当前本地库存。",
      waitingForTags: "仍在等待标签覆盖。",
      preferencesLabel: "偏好设置",
      infoLabel: "信息"
    }
  }

  return {
    workspaceBadge: "Bookmark workspace",
    pageTitle: "Bookmarks",
    pageDescription: "",
    lastSync: "Last sync",
    syncNow: "Sync now",
    syncing: "Syncing...",
    exportData: "Export data",
    exporting: "Exporting...",
    totalTags: "Total tags",
    unclassified: "Unclassified",
    unclassifiedHint: "Still waiting for tag coverage.",
    preferencesTitle: "Preferences",
    preferencesDescription: "",
    languageLabel: "Language",
    themeLabel: "Theme",
    listsTitle: "Lists",
    allBookmarks: "All bookmarks",
    newList: "New list",
    newListDescription: "",
    createList: "Create list",
    libraryTitle: "Library",
    libraryDescription: "",
    search: "Search",
    searchPlaceholder: "Search bookmarks, authors and notes...",
    filters: "Filters",
    filterConditions: "Filter conditions",
    filterDescription: "Choose the filters to apply.",
    latestSaved: "Recently saved",
    activeFilters: "Active filters:",
    sortBy: "Sort by",
    newestSaved: "Recently saved",
    oldestSaved: "Oldest saved",
    newestPublished: "Newest published",
    mostLiked: "Most liked",
    savedTime: "Saved time",
    anyTime: "Any time",
    last7Days: "Last 7 days",
    last30Days: "Last 30 days",
    last90Days: "Last 90 days",
    hasMedia: "Has media",
    longform: "Longform",
    unread: "Unread",
    archived: "Archived",
    author: "Author",
    authorsTitle: "Authors",
    searchAuthors: "Search authors",
    searchAuthorsPlaceholder: "Search authors...",
    showMore: "Show more",
    allAuthors: "All authors",
    tag: "Tag",
    allTags: "All tags",
    noActiveFilters: "",
    clearAll: "Clear all",
    clearSelection: "Clear selection",
    moveSelectedTo: "Move selected to",
    chooseList: "Choose list",
    moveSelected: "Move selected",
    tagSelectedWith: "Tag selected with",
    chooseTag: "Choose tag",
    applyTag: "Apply tag",
    noBookmarksTitle: "No bookmarks match the current filters",
    noBookmarksDescription: "",
    detailsTitle: "Details",
    detailsDescription: "",
    noBookmarkSelectedTitle: "No bookmark selected",
    noBookmarkSelectedDescription: "Select a bookmark to view details",
    metadataTitle: "Metadata",
    detailLabel: "Details",
    timeLabel: "Time",
    summaryTitle: "Summary",
    mediaTitle: "Media",
    openOnX: "Open on X",
    tagsTitle: "Tags",
    closePreview: "Close preview",
    previousMedia: "Previous media",
    nextMedia: "Next media",
    noTagsYet: "No tags yet.",
    attachExistingTag: "Attach existing tag",
    selectTag: "Select a tag",
    addTag: "Add tag",
    assignmentTitle: "Assignment",
    bookmarkFocus: "Bookmark focus",
    primaryList: "Primary list",
    createTagLabel: "Create tag",
    createTagDescription: "",
    create: "Create",
    createTagPrompt: "Enter a new tag name",
    deleteTagConfirmPrefix: "Delete tag",
    tagLibrary: "Tag library",
    noTagsCreated: "No tags created yet.",
    results: "results",
    selected: "selected",
    noList: "No list",
    loadingStateDescription: "Loading local state from the extension runtime.",
    scopedTo: "Scoped to",
    listPrefix: "List",
    searchPrefix: "Search",
    authorPrefix: "Author",
    tagPrefix: "Tag",
    showing: "Showing",
    of: "of",
    deleteLabel: "Delete",
    selectBookmark: "Select",
    currentLocalInventory: "Current local inventory.",
    waitingForTags: "Still waiting for tag coverage.",
    preferencesLabel: "Preferences",
    infoLabel: "Info"
  }
}

type OptionsCopy = ReturnType<typeof getOptionsCopy>

function truncateText(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}...`
}

function getTagNamesForBookmark(bookmarkId: string, bookmarkTags: BookmarkTagRecord[], tagsById: Map<string, TagRecord>) {
  return bookmarkTags
    .filter((bookmarkTag) => bookmarkTag.bookmarkId === bookmarkId)
    .map((bookmarkTag) => tagsById.get(bookmarkTag.tagId))
    .filter(Boolean) as TagRecord[]
}

function getNextThemePreference(
  themePreference: "system" | "light" | "dark",
  resolvedTheme: "light" | "dark"
): "system" | "light" | "dark" {
  if (themePreference === "system") {
    return resolvedTheme === "dark" ? "light" : "dark"
  }

  if (themePreference === "dark") {
    return "light"
  }

  return "system"
}

function createFieldId(scope: string, name: string) {
  return `${scope}-${name}`
}

const SORT_ORDER_SEQUENCE: BookmarkSortOrder[] = ["timeline", "saved-asc", "created-desc", "likes-desc"]
const INITIAL_RESULTS_RENDER_LIMIT = 80
const RESULTS_RENDER_INCREMENT = 80

function getSortLabel(copy: OptionsCopy, sortOrder: BookmarkSortOrder) {
  switch (sortOrder) {
    case "timeline":
      return copy.latestSaved
    case "saved-asc":
      return copy.oldestSaved
    case "created-desc":
      return copy.newestPublished
    case "likes-desc":
      return copy.mostLiked
    case "saved-desc":
    default:
      return copy.latestSaved
  }
}

function getNextSortOrder(sortOrder: BookmarkSortOrder): BookmarkSortOrder {
  const currentIndex = SORT_ORDER_SEQUENCE.indexOf(sortOrder)
  return SORT_ORDER_SEQUENCE[(currentIndex + 1) % SORT_ORDER_SEQUENCE.length]
}

function BackgroundScene() {
  return null
}

function LoadingPanel({ title }: { title: string }) {
  return (
    <SurfaceCard title={title} className="workspace-surface">
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-[8px] bg-[var(--surface-muted)]" />
        <div className="h-10 animate-pulse rounded-[8px] bg-[var(--surface-muted)]" />
        <div className="h-32 animate-pulse rounded-[12px] bg-[var(--surface-muted)]" />
      </div>
    </SurfaceCard>
  )
}

function InlineMessage({
  message,
  tone = "error",
  className
}: {
  message?: string | null
  tone?: "error" | "info"
  className?: string
}) {
  if (!message) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-[1.2rem] border px-4 py-3 text-sm leading-6 backdrop-blur-xl",
        tone === "error"
          ? "border-red-200/70 bg-red-50/70 text-red-700"
          : "border-sky-200/70 bg-sky-50/70 text-sky-700",
        className
      )}>
      {message}
    </div>
  )
}

function FieldBlock({
  label,
  htmlFor,
  description,
  children,
  className,
  labelClassName
}: {
  label: string
  htmlFor: string
  description?: string
  children: React.ReactNode
  className?: string
  labelClassName?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className={cn("block text-[12px] font-normal leading-4 text-[var(--text-secondary)]", labelClassName)}>
        {label}
      </label>
      {children}
      {description ? <p className="options-meta-copy">{description}</p> : null}
    </div>
  )
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

function TextInputField({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
  dataTestId,
  ariaLabel
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  className?: string
  dataTestId?: string
  ariaLabel?: string
}) {
  return (
    <input
      id={id}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={cn("field-shell w-full", className)}
    />
  )
}

function PreviewMedia({ bookmark, index }: { bookmark: BookmarkRecord; index: number }) {
  const mediaUrl = bookmark.media?.[0]?.url

  if (!mediaUrl) {
    return null
  }

  return (
    <div className="workspace-media-frame options-card-media relative aspect-video overflow-hidden bg-[var(--tag-bg)]" data-card-media-index={index}>
      <img
        src={mediaUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  )
}

function BookmarkCard({
  bookmark,
  index,
  currentTagNames,
  selected,
  locale,
  onSelect
}: {
  bookmark: BookmarkRecord
  index: number
  currentTagNames: string[]
  selected: boolean
  locale: Locale
  onSelect: () => void
}) {
  const authorInitials = bookmark.authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || bookmark.authorHandle.slice(0, 2).toUpperCase()

  return (
    <article
      data-bookmark-card={bookmark.tweetId}
      onClick={onSelect}
      className={cn(
        "options-result-card group relative flex flex-col overflow-hidden",
        selected && "options-result-card-selected"
      )}>
      <PreviewMedia bookmark={bookmark} index={index} />

      <div className="options-card-body flex flex-1 flex-col">
        <div className="flex items-start gap-3">
          <div className="options-card-avatar">{authorInitials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[0.95rem] font-semibold text-[var(--text-primary)]">{bookmark.authorName}</div>
                <div className="options-meta-copy truncate">@{bookmark.authorHandle}</div>
              </div>
              <div className="options-card-timestamp shrink-0">
                {formatTimestamp(bookmark.savedAt, locale)}
              </div>
            </div>

            <div className="options-card-copy-wrap">
              <p className={cn("options-card-copy", !!bookmark.media?.length && "is-media")}>
                {truncateText(bookmark.text, bookmark.media?.length ? 180 : 260)}
              </p>
            </div>

            {currentTagNames.length ? (
              <div className="options-card-tags">
                {currentTagNames.map((tagName) => (
                  <span key={tagName} className="options-card-tag">
                    {tagName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="options-card-actions">
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
    </article>
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
  copy: OptionsCopy
  onPreview: (mediaUrl: string) => void
}) {
  const primaryMedia = bookmark.media?.[0]
  const mediaUrl = primaryMedia?.url
  const isVideo = primaryMedia?.type === "video"

  if (!mediaUrl) {
    return null
  }

  return (
    <section data-testid="inspector-media-section" className="options-inspector-section options-inspector-divider">
      <div className="options-overline">{getSectionOverline(locale, copy.mediaTitle, "Media")}</div>
      {isVideo ? (
        <div className="options-inspector-media-shell mt-3">
          <video
            data-testid="inspector-media-video"
            src={mediaUrl}
            controls
            preload="metadata"
            className="h-72 w-full object-cover"
          />
          {bookmark.media && bookmark.media.length > 1 ? (
            <div className="options-inspector-media-count">
              {bookmark.media.length}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          data-testid="inspector-media-trigger"
          className="options-inspector-media-trigger mt-3"
          onClick={() => onPreview(mediaUrl)}>
          <div className="options-inspector-media-shell">
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

function BookmarkInspector({
  bookmark,
  tags,
  bookmarkTags,
  isSavingTags,
  locale,
  copy,
  onAttachTag,
  onDetachTag,
  onClose,
}: {
  bookmark: BookmarkRecord | null
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  isSavingTags: boolean
  locale: Locale
  copy: OptionsCopy
  onAttachTag: (tagId: string) => Promise<void>
  onDetachTag: (tagId: string) => Promise<void>
  onClose: () => void
}) {
  const [selectedTagId, setSelectedTagId] = useState("")
  const [previewMediaIndex, setPreviewMediaIndex] = useState<number | null>(null)
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null)
  const mediaItems = bookmark?.media ?? []
  const hasMultipleMedia = mediaItems.length > 1

  useEffect(() => {
    setSelectedTagId("")
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

  const activePreviewMedia = previewMediaIndex === null ? null : mediaItems[previewMediaIndex] ?? null
  const previewMediaUrl = activePreviewMedia?.url ?? null
  const previewMediaIsVideo = activePreviewMedia?.type === "video"

  function handleOpenPreview(mediaUrl: string) {
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

  const currentTags = tags.filter((tag) => bookmarkTags.some((bookmarkTag) => bookmarkTag.bookmarkId === bookmark.tweetId && bookmarkTag.tagId === tag.id))
  const availableTagOptions = tags.filter((tag) => !currentTags.some((currentTag) => currentTag.id === tag.id))

  const attachSelectId = createFieldId("details", "attach-tag")
  const detailTimestamp = formatTimestamp(bookmark.createdAtOnX || bookmark.savedAt, locale)
  const authorInitials = bookmark.authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || bookmark.authorHandle.slice(0, 2).toUpperCase()

  return (
    <SurfaceCard
      chrome="bare"
      className="options-inspector-shell options-detail-drawer xl:h-[100dvh]">
      <div className="options-detail-drawer-header">
        <div className="options-inspector-author-row min-w-0">
          <div className="options-inspector-avatar">{authorInitials}</div>
          <div className="min-w-0">
            <p className="truncate text-[1rem] font-semibold text-[var(--text-primary)]">{bookmark.authorName}</p>
            <p className="options-meta-copy truncate">@{bookmark.authorHandle}</p>
          </div>
        </div>
        <button
          type="button"
          data-testid="detail-drawer-close"
          aria-label={copy.detailsTitle}
          className="options-detail-drawer-close"
          onClick={onClose}>
          <AppIcon name="close" size={16} />
        </button>
      </div>
      <div
        ref={inspectorScrollRef}
        data-testid="inspector-section-stack"
        className="scroll-shell flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        <section data-testid="inspector-metadata-section" className="options-detail-drawer-meta">
          <div className="options-detail-drawer-meta-row">
            <p className="options-meta-copy">{detailTimestamp}</p>
            <button
              type="button"
              data-testid="detail-open-x-link"
              aria-label={copy.openOnX}
              className="options-detail-drawer-open-link"
              onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
              <AppIcon name="external" size={14} />
            </button>
          </div>
        </section>

        <section data-testid="inspector-summary-section" className="options-inspector-section options-detail-drawer-content">
          <p className="options-body-copy options-inspector-summary">{bookmark.text}</p>
        </section>

        <BookmarkMediaSection
          bookmark={bookmark}
          locale={locale}
          copy={copy}
          onPreview={handleOpenPreview}
        />

        <section data-testid="inspector-tags-section" className="options-inspector-section options-inspector-divider">
          <div className="options-overline">{getSectionOverline(locale, copy.tagsTitle, "Tags")}</div>
          <div data-testid="current-tags" className="mt-4 flex flex-wrap gap-2">
            {!currentTags.length ? <span className="options-meta-copy">{copy.noTagsYet}</span> : null}
            {currentTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void onDetachTag(tag.id)}
                className="chip-button options-tag-pill">
                <span>{tag.name}</span>
                <AppIcon name="close" size={12} />
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <FieldBlock
              label={copy.attachExistingTag}
              htmlFor={attachSelectId}
              labelClassName="options-overline !font-medium !tracking-[0.12em] !text-[var(--text-quaternary)]">
              <SelectField
                id={attachSelectId}
                dataTestId="attach-tag-select"
                value={selectedTagId}
                onChange={setSelectedTagId}
                options={[
                  { value: "", label: copy.selectTag },
                  ...availableTagOptions.map((tag) => ({ value: tag.id, label: tag.name }))
                ]}
                className="options-inspector-field"
              />
            </FieldBlock>
            <button
              type="button"
              onClick={() => void onAttachTag(selectedTagId)}
              disabled={isSavingTags || !selectedTagId}
              className="options-secondary-button options-dashed-action w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="tag" size={14} />
              <span>{copy.addTag}</span>
            </button>
          </div>
        </section>
      </div>
      {previewMediaUrl ? (
        <div data-testid="media-lightbox" className="options-media-lightbox">
          <button
            type="button"
            data-testid="media-lightbox-backdrop"
            aria-label={copy.mediaTitle}
            className="options-media-lightbox-backdrop"
            onClick={() => setPreviewMediaIndex(null)}
          />
          <div className="options-media-lightbox-shell">
            <div className="options-media-lightbox-toolbar">
              <button
                type="button"
                data-testid="media-lightbox-close"
                aria-label={copy.closePreview}
                className="options-media-lightbox-close"
                onClick={() => setPreviewMediaIndex(null)}>
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
                  onClick={handlePrevPreview}>
                  <span aria-hidden="true">‹</span>
                </button>
              ) : (
                <div className="options-media-lightbox-nav-spacer" aria-hidden="true" />
              )}
              <div className="options-media-lightbox-content">
                {previewMediaIsVideo ? (
                  <video
                    key={previewMediaUrl}
                    data-testid="media-lightbox-video"
                    src={previewMediaUrl}
                    controls
                    preload="metadata"
                    className="options-media-lightbox-image"
                  />
                ) : (
                  <img
                    key={previewMediaUrl}
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
                  onClick={handleNextPreview}>
                  <span aria-hidden="true">›</span>
                </button>
              ) : (
                <div className="options-media-lightbox-nav-spacer" aria-hidden="true" />
              )}
            </div>
            {hasMultipleMedia ? (
              <div className="options-media-lightbox-footer">
                <div className="options-media-lightbox-counter">
                  {previewMediaIndex! + 1} / {mediaItems.length}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  )
}

function WorkspaceSidebar({
  workspace,
  locale,
  themePreference,
  resolvedTheme,
  copy,
  lastSyncLabel,
  activeTagIds,
  activeAuthorHandles,
  authorItems,
  authorSearchQuery,
  authorsExpanded,
  isTagsCollapsed,
  isAuthorsCollapsed,
  onTagToggle,
  onAuthorToggle,
  onAuthorSearchQueryChange,
  onToggleTagsCollapsed,
  onToggleAuthorsCollapsed,
  onExpandAuthors,
  onCreateTag,
  onDeleteTag,
  setLocale,
  setThemePreference
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  themePreference: "system" | "light" | "dark"
  resolvedTheme: "light" | "dark"
  copy: OptionsCopy
  lastSyncLabel: string
  activeTagIds: string[]
  activeAuthorHandles: string[]
  authorItems: AuthorSidebarItem[]
  authorSearchQuery: string
  authorsExpanded: boolean
  isTagsCollapsed: boolean
  isAuthorsCollapsed: boolean
  onTagToggle: (tagId: string) => void
  onAuthorToggle: (authorHandle: string) => void
  onAuthorSearchQueryChange: (value: string) => void
  onToggleTagsCollapsed: () => void
  onToggleAuthorsCollapsed: () => void
  onExpandAuthors: () => void
  onCreateTag: (name: string) => Promise<unknown>
  onDeleteTag: (tagId: string) => Promise<unknown>
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
}) {
  const tagCountById = workspace.bookmarkTags.reduce((map, bookmarkTag) => {
    map.set(bookmarkTag.tagId, (map.get(bookmarkTag.tagId) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  const [isCreatingTagInline, setIsCreatingTagInline] = useState(false)
  const [draftTagName, setDraftTagName] = useState("")
  const [isSubmittingDraftTag, setIsSubmittingDraftTag] = useState(false)
  const draftTagInputRef = useRef<HTMLInputElement | null>(null)
  const draftTagBlurIntentRef = useRef<"idle" | "submit" | "cancel">("idle")
  const { items: visibleAuthorItems, shouldShowToggle: shouldShowAuthorToggle } = getVisibleAuthorSidebarItems({
    authorItems,
    searchQuery: authorSearchQuery,
    expanded: authorsExpanded
  })
  const isAllBookmarksSelected = activeTagIds.includes("all") && activeAuthorHandles.length === 0
  const authorSearchId = createFieldId("authors", "search")
  const tagSelectionCount = activeTagIds.includes("all") ? 0 : activeTagIds.length
  const authorSelectionCount = activeAuthorHandles.length

  useEffect(() => {
    if (!isCreatingTagInline || !draftTagInputRef.current) {
      return
    }

    draftTagInputRef.current.focus()
    draftTagInputRef.current.select()
  }, [isCreatingTagInline])

  function resetInlineTagDraft() {
    draftTagBlurIntentRef.current = "idle"
    setDraftTagName("")
    setIsSubmittingDraftTag(false)
    setIsCreatingTagInline(false)
  }

  async function submitInlineTagDraft(nextName?: string) {
    if (isSubmittingDraftTag) {
      return
    }

    const trimmedName = (nextName ?? draftTagInputRef.current?.value ?? draftTagName).trim()
    if (!trimmedName) {
      resetInlineTagDraft()
      return
    }

    setIsSubmittingDraftTag(true)

    try {
      await onCreateTag(trimmedName)
      resetInlineTagDraft()
    } catch {
      setIsSubmittingDraftTag(false)
    }
  }

  function handleCreateTagClick() {
    if (isCreatingTagInline) {
      draftTagInputRef.current?.focus()
      return
    }

    setDraftTagName("")
    setIsCreatingTagInline(true)
  }

  function handleDeleteTagClick(tagId: string, tagName: string) {
    const shouldDelete = typeof window.confirm === "function"
      ? window.confirm(`${copy.deleteTagConfirmPrefix} “${tagName}”?`)
      : true

    if (!shouldDelete) {
      return
    }

    void onDeleteTag(tagId)
  }

  return (
    <aside
      data-testid="lists-sidebar"
      className="options-demo-sidebar options-sidebar-shell flex min-h-[420px] min-w-0 flex-col overflow-hidden">
      <section data-testid="sidebar-status-section" className="options-sidebar-hero">
        <div className="options-sidebar-hero-head">
          <div className="options-sidebar-hero-meta">
            <div className="options-overline">{getSectionOverline(locale, "工作区", "Workspace")}</div>
            <StatusBadge status={workspace.summary.status} />
          </div>
        </div>

        <div className="options-sidebar-brand-row">
          <BrandLogo
            size={38}
            testId="options-brand-logo"
            className="rounded-[12px] shadow-[0_14px_28px_-22px_rgba(15,23,42,0.42)]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="options-display-title options-sidebar-title truncate">
              {copy.pageTitle}
            </h1>
          </div>
        </div>

        <div data-testid="workspace-sidebar-sync" className="options-sidebar-sync">
          <div className="options-sidebar-sync-label">
            {copy.lastSync} {lastSyncLabel}
          </div>

          <button
            type="button"
            onClick={() => void workspace.handleSync()}
            disabled={workspace.isSyncing}
            className="workspace-sync-primary">
            <AppIcon name="sync" size={16} className={workspace.isSyncing ? "animate-spin" : undefined} />
            <span>{workspace.isSyncing ? copy.syncing : copy.syncNow}</span>
          </button>

          <InlineMessage message={workspace.commandError} className="!rounded-[6px] !border-[var(--border-subtle)] !bg-[var(--tag-bg)] !px-3 !py-2 !text-[12px]" />
        </div>
      </section>

      <section data-testid="sidebar-lists-section" className="options-sidebar-lists">
        <div data-testid="sidebar-lists-scroll" className="options-sidebar-lists-scroll scroll-shell min-h-0 flex-1 overflow-y-auto">
          <section data-testid="sidebar-tags-section" className="options-sidebar-group">
            <div className="options-sidebar-section-head">
              <div data-testid="sidebar-tags-title" className="options-sidebar-title-group">
                <span className="options-overline">{getSectionOverline(locale, "标签", "Tags")}</span>
                <button
                  type="button"
                  data-testid="sidebar-create-tag"
                  aria-label={copy.createTagLabel}
                  onClick={handleCreateTagClick}
                  className="options-create-tag-button">
                  <span aria-hidden="true">+</span>
                </button>
              </div>
              <button
                type="button"
                data-testid="sidebar-tags-toggle"
                aria-expanded={!isTagsCollapsed}
                className="options-sidebar-section-toggle"
                onClick={onToggleTagsCollapsed}>
                <span className="options-sidebar-section-toggle-trailing">
                  {tagSelectionCount ? <span className="options-nav-count">{tagSelectionCount}</span> : null}
                  <AppIcon
                    name="caretDown"
                    size={12}
                    className={cn("options-sidebar-section-caret", isTagsCollapsed && "is-collapsed")}
                  />
                </span>
              </button>
            </div>

            {!isTagsCollapsed ? (
              <div data-testid="sidebar-tags-content" className="options-sidebar-group-content">
              <div data-testid="sidebar-list-tree" className="space-y-1">
                <div
                  role="button"
                  tabIndex={0}
                  data-list-button="all"
                  onClick={() => onTagToggle("all")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onTagToggle("all")
                    }
                  }}
                  className={cn(
                    "options-nav-row options-nav-row-all w-full text-left",
                    isAllBookmarksSelected && "options-nav-row-active"
                  )}>
                  <span className="options-nav-row-main">
                    <AppIcon name="globe" size={14} className="options-nav-row-icon" />
                    <span>{copy.allBookmarks}</span>
                  </span>
                  <span className="options-nav-count">{workspace.stats.totalBookmarks}</span>
                </div>

                {isCreatingTagInline ? (
                  <div data-testid="sidebar-create-tag-row" className="options-nav-row options-nav-row-draft">
                    <span className="options-nav-row-main">
                      <AppIcon name="hash" size={14} className="options-nav-row-icon" />
                      <input
                        ref={draftTagInputRef}
                        type="text"
                        value={draftTagName}
                        data-testid="sidebar-create-tag-input"
                        aria-label={copy.createTagLabel}
                        placeholder={copy.createTagPrompt}
                        disabled={isSubmittingDraftTag}
                        className="options-nav-row-input"
                        onChange={(event) => setDraftTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            draftTagBlurIntentRef.current = "submit"
                            void submitInlineTagDraft(event.currentTarget.value)
                            return
                          }

                          if (event.key === "Escape") {
                            event.preventDefault()
                            draftTagBlurIntentRef.current = "cancel"
                            resetInlineTagDraft()
                          }
                        }}
                        onBlur={(event) => {
                          if (draftTagBlurIntentRef.current === "submit" || draftTagBlurIntentRef.current === "cancel") {
                            draftTagBlurIntentRef.current = "idle"
                            return
                          }

                          void submitInlineTagDraft(event.currentTarget.value)
                        }}
                      />
                    </span>
                  </div>
                ) : null}

                {workspace.tags.map((tag) => {
                  const isSelected = activeTagIds.includes(tag.id)
                  return (
                    <div
                      key={tag.id}
                      role="button"
                      tabIndex={0}
                      data-list-button={tag.id}
                      onClick={() => onTagToggle(tag.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onTagToggle(tag.id)
                        }
                      }}
                      className={cn(
                        "options-nav-row options-nav-row-tag w-full text-left",
                        isSelected && "options-nav-row-active"
                      )}>
                      <span className="options-nav-row-main">
                        <AppIcon name="hash" size={14} className="options-nav-row-icon" />
                        <span className="truncate">{tag.name}</span>
                      </span>
                      <span className="options-nav-row-trailing">
                        <span className="options-nav-count">{tagCountById.get(tag.id) ?? 0}</span>
                        {isSelected ? (
                          <span className="options-nav-row-check" aria-hidden="true">
                            <AppIcon name="check" size={12} />
                          </span>
                        ) : (
                          <button
                            type="button"
                            data-testid="sidebar-delete-tag"
                            className="options-nav-row-delete"
                            aria-label={`${copy.deleteLabel} ${tag.name}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDeleteTagClick(tag.id, tag.name)
                            }}
                          >
                            <AppIcon name="trash" size={12} />
                          </button>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              </div>
            ) : null}
          </section>

          <section data-testid="sidebar-authors-section" className="options-sidebar-group options-sidebar-group-authors">
            <div className="options-sidebar-section-head">
              <div data-testid="sidebar-authors-title" className="options-sidebar-title-group">
                <span className="options-overline">{copy.authorsTitle}</span>
              </div>
              <button
                type="button"
                data-testid="sidebar-authors-toggle-header"
                aria-expanded={!isAuthorsCollapsed}
                className="options-sidebar-section-toggle"
                onClick={onToggleAuthorsCollapsed}>
                <span className="options-sidebar-section-toggle-trailing">
                  {authorSelectionCount ? <span className="options-nav-count">{authorSelectionCount}</span> : null}
                  <AppIcon
                    name="caretDown"
                    size={12}
                    className={cn("options-sidebar-section-caret", isAuthorsCollapsed && "is-collapsed")}
                  />
                </span>
              </button>
            </div>

            {!isAuthorsCollapsed ? (
              <div data-testid="sidebar-authors-content" className="options-sidebar-group-content mt-3 space-y-3">
                <FieldBlock label={copy.searchAuthors} htmlFor={authorSearchId} labelClassName="sr-only">
                  <TextInputField
                    id={authorSearchId}
                    type="search"
                    value={authorSearchQuery}
                    onChange={onAuthorSearchQueryChange}
                    placeholder={copy.searchAuthorsPlaceholder}
                    dataTestId="sidebar-authors-search"
                    ariaLabel={copy.searchAuthors}
                    className="options-sidebar-search-input w-full"
                  />
                </FieldBlock>

                <div className="space-y-1">
                  {visibleAuthorItems.map((author) => {
                    const isSelected = activeAuthorHandles.includes(author.authorHandle)

                    return (
                      <div
                        key={author.authorHandle}
                        role="button"
                        tabIndex={0}
                        data-author-button={author.authorHandle}
                        onClick={() => onAuthorToggle(author.authorHandle)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            onAuthorToggle(author.authorHandle)
                          }
                        }}
                        className={cn("options-nav-row w-full text-left", isSelected && "options-nav-row-active")}>
                        <span className="options-nav-row-main min-w-0">
                          <span className="options-nav-row-icon text-[12px] font-semibold">@</span>
                          <span className="min-w-0">
                            <span className="block truncate">{author.authorName || formatAuthorLabel(author)}</span>
                            <span className="options-meta-copy block truncate">{formatAuthorLabel(author)}</span>
                          </span>
                        </span>
                        <span className="options-nav-row-trailing">
                          <span className="options-nav-count">{author.count}</span>
                          {isSelected ? (
                            <span className="options-nav-row-check" aria-hidden="true">
                              <AppIcon name="check" size={12} />
                            </span>
                          ) : null}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {!authorsExpanded && shouldShowAuthorToggle ? (
                  <button
                    type="button"
                    data-testid="sidebar-authors-show-more"
                    onClick={onExpandAuthors}
                    className="options-footer-chip">
                    {copy.showMore}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section data-testid="sidebar-footer-section" className="options-sidebar-config">
        <div className="py-4">
          <span className="sr-only">{copy.preferencesLabel}</span>
          <div className="options-sidebar-footer-row">
            <div className="options-sidebar-footer-controls">
              <button
                type="button"
                data-testid="footer-locale-toggle"
                aria-label={copy.languageLabel}
                onClick={() => void setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
                className="options-footer-chip">
                {locale === "zh-CN" ? "中" : "EN"}
              </button>
              <button
                type="button"
                data-testid="footer-theme-toggle"
                onClick={() => void setThemePreference(getNextThemePreference(themePreference, resolvedTheme))}
                className="options-footer-icon-button"
                aria-label={copy.themeLabel}>
                <AppIcon name={resolvedTheme === "dark" ? "moon" : "sun"} size={14} />
              </button>
              <button
                type="button"
                data-testid="footer-export-toggle"
                onClick={() => void workspace.handleExportWorkspace()}
                disabled={workspace.isExporting}
                className="options-footer-icon-button"
                aria-label={copy.exportData}>
                <AppIcon name="export" size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </aside>
  )
}

function WorkspaceToolbar({
  locale,
  copy,
  loadError,
  currentScopeLabel,
  visibleBookmarksCount,
  query,
  setQuery,
  searchId,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
  filterPopoverOpen,
  setFilterPopoverOpen,
  onlyWithMedia,
  setOnlyWithMedia,
  onlyLongform,
  setOnlyLongform,
  activeRefinementChips,
  clearRefinement
}: {
  locale: Locale
  copy: OptionsCopy
  loadError: string | null
  currentScopeLabel: string
  visibleBookmarksCount: number
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  searchId: string
  sortOrder: BookmarkSortOrder
  setSortOrder: React.Dispatch<React.SetStateAction<BookmarkSortOrder>>
  viewMode: "grid" | "list"
  setViewMode: React.Dispatch<React.SetStateAction<"grid" | "list">>
  filterPopoverOpen: boolean
  setFilterPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>
  onlyWithMedia: boolean
  setOnlyWithMedia: React.Dispatch<React.SetStateAction<boolean>>
  onlyLongform: boolean
  setOnlyLongform: React.Dispatch<React.SetStateAction<boolean>>
  activeRefinementChips: Array<{ key: string; label: string }>
  clearRefinement: (key: string) => void
}) {
  const activeFilterCount = Number(onlyWithMedia) + Number(onlyLongform)

  return (
    <div data-testid="library-header-section" className="options-main-header space-y-4">
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="options-overline">{getSectionOverline(locale, copy.libraryTitle, "Archive")}</div>
            <h2 className="options-display-title-sm mt-3 truncate font-bold">{currentScopeLabel}</h2>
          </div>
          <div className="text-right">
            <div className="options-results-value font-bold">{visibleBookmarksCount}</div>
            <div className="options-overline mt-1">{copy.results}</div>
          </div>
        </div>
      </div>

      <InlineMessage message={loadError} className="!rounded-[6px] !border-[var(--border-subtle)] !bg-[var(--tag-bg)] !px-3 !py-2 !text-[12px]" />

      <div data-testid="workspace-toolbar" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <AppIcon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <TextInputField
              id={searchId}
              ariaLabel={copy.search}
              type="search"
              value={query}
              placeholder={copy.searchPlaceholder}
              onChange={setQuery}
              className="workspace-input options-toolbar-field pl-10 pr-4"
            />
          </div>

          <div className="options-toolbar-inline">
            <div className="relative">
              <button
                type="button"
                data-testid="filter-trigger"
                className="options-toolbar-action"
                aria-expanded={filterPopoverOpen}
                onClick={() => setFilterPopoverOpen((current) => !current)}>
                <AppIcon name="filter" size={14} />
                <span>{copy.filters}</span>
                {activeFilterCount ? <span className="options-toolbar-badge">{activeFilterCount}</span> : null}
              </button>

              {filterPopoverOpen ? (
                <div data-testid="filter-popover" className="options-filter-popover">
                  <div className="space-y-1.5 pb-3">
                    <h4 className="text-sm font-medium leading-none text-[var(--text-primary)]">{copy.filterConditions}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">{copy.filterDescription}</p>
                  </div>
                  <label data-testid="filter-option-media" className="options-filter-row">
                    <input
                      type="checkbox"
                      checked={onlyWithMedia}
                      onChange={(event) => setOnlyWithMedia(event.currentTarget.checked)}
                    />
                    <span>{copy.hasMedia}</span>
                  </label>
                  <label data-testid="filter-option-longform" className="options-filter-row">
                    <input
                      type="checkbox"
                      checked={onlyLongform}
                      onChange={(event) => setOnlyLongform(event.currentTarget.checked)}
                    />
                    <span>{copy.longform}</span>
                  </label>
                  <label data-testid="filter-option-unread" className="options-filter-row is-disabled">
                    <input type="checkbox" disabled />
                    <span>{copy.unread}</span>
                  </label>
                  <label data-testid="filter-option-archived" className="options-filter-row is-disabled">
                    <input type="checkbox" disabled />
                    <span>{copy.archived}</span>
                  </label>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              data-testid="sort-trigger"
              className="options-toolbar-action"
              onClick={() => setSortOrder((current) => getNextSortOrder(current))}>
              <AppIcon name="sort" size={14} />
              <span>{getSortLabel(copy, sortOrder)}</span>
            </button>

            <span className="options-toolbar-divider" aria-hidden="true" />

            <div className="options-view-toggle-group">
              <button
                type="button"
                data-testid="view-toggle-grid"
                className={cn("options-view-toggle", viewMode === "grid" && "is-active")}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}>
                <AppIcon name="grid" size={16} />
              </button>
              <button
                type="button"
                data-testid="view-toggle-list"
                className={cn("options-view-toggle", viewMode === "list" && "is-active")}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}>
                <AppIcon name="list" size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="options-toolbar-context-row flex items-center justify-between gap-4 text-sm">
          <div data-testid="active-filters-row" className="options-active-filters">
            <span className="options-active-filters-label">{copy.activeFilters}</span>
            {activeRefinementChips.length ? (
              <>
                {activeRefinementChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => clearRefinement(chip.key)}
                    className="chip-button options-chip !px-3 !py-1.5 !text-xs">
                    <span>{chip.label}</span>
                    <AppIcon name="close" size={12} />
                  </button>
                ))}
              </>
            ) : (
              <span className="options-active-filters-empty" aria-hidden="true" />
            )}
          </div>
          <span data-testid="library-results-summary" className="options-toolbar-results-meta">
            {visibleBookmarksCount} {copy.results}
          </span>
        </div>
      </div>
    </div>
  )
}

function BookmarkResultsPane({
  workspace,
  isLoading,
  locale,
  copy,
  currentScopeLabel,
  searchId,
  query,
  setQuery,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
  filterPopoverOpen,
  setFilterPopoverOpen,
  onlyWithMedia,
  setOnlyWithMedia,
  onlyLongform,
  setOnlyLongform,
  selectedBookmarkId,
  setSelectedBookmarkId,
  visibleBookmarks,
  renderedBookmarks,
  activeRefinementChips,
  tagNamesByBookmarkId,
  clearRefinement,
  onResultsScroll
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  isLoading: boolean
  locale: Locale
  copy: OptionsCopy
  currentScopeLabel: string
  searchId: string
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  sortOrder: BookmarkSortOrder
  setSortOrder: React.Dispatch<React.SetStateAction<BookmarkSortOrder>>
  viewMode: "grid" | "list"
  setViewMode: React.Dispatch<React.SetStateAction<"grid" | "list">>
  filterPopoverOpen: boolean
  setFilterPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>
  onlyWithMedia: boolean
  setOnlyWithMedia: React.Dispatch<React.SetStateAction<boolean>>
  onlyLongform: boolean
  setOnlyLongform: React.Dispatch<React.SetStateAction<boolean>>
  selectedBookmarkId: string | undefined
  setSelectedBookmarkId: React.Dispatch<React.SetStateAction<string | undefined>>
  visibleBookmarks: BookmarkRecord[]
  renderedBookmarks: BookmarkRecord[]
  activeRefinementChips: Array<{ key: string; label: string }>
  tagNamesByBookmarkId: Map<string, string[]>
  clearRefinement: (key: string) => void
  onResultsScroll: (event: React.UIEvent<HTMLDivElement>) => void
}) {
  return (
    <section data-testid="library-workspace" className="options-main-shell min-h-[420px] min-w-0 overflow-hidden p-0 xl:h-[100dvh]">
      <div className="flex h-full min-h-0 flex-col">
        <WorkspaceToolbar
          locale={locale}
          copy={copy}
          loadError={workspace.loadError}
          currentScopeLabel={currentScopeLabel}
          visibleBookmarksCount={visibleBookmarks.length}
          query={query}
          setQuery={setQuery}
          searchId={searchId}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          viewMode={viewMode}
          setViewMode={setViewMode}
          filterPopoverOpen={filterPopoverOpen}
          setFilterPopoverOpen={setFilterPopoverOpen}
          onlyWithMedia={onlyWithMedia}
          setOnlyWithMedia={setOnlyWithMedia}
          onlyLongform={onlyLongform}
          setOnlyLongform={setOnlyLongform}
          activeRefinementChips={activeRefinementChips}
          clearRefinement={clearRefinement}
        />

        <div
          data-testid="library-results-scroll"
          className="scroll-shell min-h-0 flex-1 overflow-y-auto"
          onScroll={onResultsScroll}>
          {isLoading ? (
            <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 lg:px-8">
              <div className="space-y-4">
                <div className="h-32 animate-pulse rounded-[16px] bg-[var(--surface-muted)]" />
                <div className="h-32 animate-pulse rounded-[16px] bg-[var(--surface-muted)]" />
                <div className="h-32 animate-pulse rounded-[16px] bg-[var(--surface-muted)]" />
              </div>
            </div>
          ) : visibleBookmarks.length ? (
            <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 lg:px-8">
              <div
                data-testid="results-stack"
                className={cn(
                  "content-start gap-4",
                  viewMode === "grid"
                    ? "options-results-grid options-results-masonry columns-1 lg:columns-2"
                    : "options-results-list flex flex-col"
                )}>
              {renderedBookmarks.map((bookmark, index) => {
                const currentTagNames = tagNamesByBookmarkId.get(bookmark.tweetId) ?? []
                const isSelected = selectedBookmarkId === bookmark.tweetId

                return (
                  <BookmarkCard
                    key={bookmark.tweetId}
                    bookmark={bookmark}
                    index={index}
                    currentTagNames={currentTagNames}
                    selected={isSelected}
                    locale={locale}
                    onSelect={() => setSelectedBookmarkId(bookmark.tweetId)}
                  />
                )
              })}
            </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 lg:px-8">
              <EmptyState
                title={copy.noBookmarksTitle}
                description={copy.noBookmarksDescription}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function OptionsScreen() {
  const workspace = useWorkspaceData()
  const { locale, themePreference, resolvedTheme, setLocale, setThemePreference } = useExtensionUi()
  const copy = getOptionsCopy(locale)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [activeTagIds, setActiveTagIds] = useState<string[]>(["all"])
  const [activeAuthorHandles, setActiveAuthorHandles] = useState<string[]>([])
  const [authorSearchQuery, setAuthorSearchQuery] = useState("")
  const [authorsExpanded, setAuthorsExpanded] = useState(false)
  const [isTagsCollapsed, setIsTagsCollapsed] = useState(false)
  const [isAuthorsCollapsed, setIsAuthorsCollapsed] = useState(true)
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("timeline")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [renderLimit, setRenderLimit] = useState(INITIAL_RESULTS_RENDER_LIMIT)
  const resizeStateRef = useRef<null | { side: "left" | "right"; startX: number; startWidth: number }>(null)
  const paneWidthsRef = useRef({ left: 280, right: 360 })

  useEffect(() => {
    void getSettings()
      .then((settings) => {
        const nextLeft = settings.leftSidebarWidth ?? 280
        const nextRight = settings.rightSidebarWidth ?? 360
        paneWidthsRef.current = { left: nextLeft, right: nextRight }
        setLeftSidebarWidth(nextLeft)
        setRightSidebarWidth(nextRight)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const stopResizeMode = () => {
      document.documentElement.classList.remove("is-pane-resizing")
    }

    const handlePointerMove = (event: PointerEvent | MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) {
        return
      }
      event.preventDefault()

      if (state.side === "left") {
        const nextWidth = Math.min(420, Math.max(260, state.startWidth + (event.clientX - state.startX)))
        paneWidthsRef.current.left = nextWidth
        setLeftSidebarWidth(nextWidth)
        return
      }

      const nextWidth = Math.min(520, Math.max(320, state.startWidth - (event.clientX - state.startX)))
      paneWidthsRef.current.right = nextWidth
      setRightSidebarWidth(nextWidth)
    }

    const handlePointerUp = () => {
      if (!resizeStateRef.current) {
        return
      }

      resizeStateRef.current = null
      stopResizeMode()
      void getSettings().then((settings) =>
        saveSettings({
          ...settings,
          leftSidebarWidth: paneWidthsRef.current.left,
          rightSidebarWidth: paneWidthsRef.current.right
        })
      )
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("mousemove", handlePointerMove)
    window.addEventListener("mouseup", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("mousemove", handlePointerMove)
      window.removeEventListener("mouseup", handlePointerUp)
      stopResizeMode()
    }
  }, [leftSidebarWidth, rightSidebarWidth])

  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const authorItems = useMemo(() => buildAuthorSidebarItems(workspace.bookmarks), [workspace.bookmarks])
  const bookmarkTagIdsByBookmarkId = useMemo(() => {
    const map = new Map<string, Set<string>>()

    for (const bookmarkTag of workspace.bookmarkTags) {
      const tagIds = map.get(bookmarkTag.bookmarkId) ?? new Set<string>()
      tagIds.add(bookmarkTag.tagId)
      map.set(bookmarkTag.bookmarkId, tagIds)
    }

    return map
  }, [workspace.bookmarkTags])
  const visibleBookmarks = useMemo(
    () => {
      const scopedBookmarks = activeTagIds.includes("all")
        ? workspace.bookmarks
        : workspace.bookmarks.filter((bookmark) =>
            activeTagIds.every((tagId) => bookmarkTagIdsByBookmarkId.get(bookmark.tweetId)?.has(tagId))
          )

      return sortBookmarks(
        filterBookmarksByFlags(
          filterBookmarks(filterBookmarksByAuthors(scopedBookmarks, activeAuthorHandles), query),
          {
            onlyWithMedia,
            onlyLongform
          }
        ),
        sortOrder
      )
    },
    [
      onlyLongform,
      onlyWithMedia,
      query,
      sortOrder,
      activeAuthorHandles,
      activeTagIds,
      bookmarkTagIdsByBookmarkId,
      workspace.bookmarks
    ]
  )
  const renderedBookmarks = useMemo(
    () => visibleBookmarks.slice(0, Math.min(renderLimit, visibleBookmarks.length)),
    [renderLimit, visibleBookmarks]
  )

  useEffect(() => {
    const visibleBookmarkIds = new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId))

    if (!visibleBookmarks.length) {
      setSelectedBookmarkId(undefined)
      return
    }

    if (selectedBookmarkId && !visibleBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(undefined)
    }
  }, [selectedBookmarkId, visibleBookmarks])

  useEffect(() => {
    setRenderLimit(Math.min(INITIAL_RESULTS_RENDER_LIMIT, visibleBookmarks.length || INITIAL_RESULTS_RENDER_LIMIT))
  }, [visibleBookmarks])

  useEffect(() => {
    setActiveTagIds((current) => {
      if (current.includes("all")) {
        return current.length === 1 ? current : ["all"]
      }

      const validTagIds = current.filter((tagId) => workspace.tags.some((tag) => tag.id === tagId))
      const next = validTagIds.length ? validTagIds : ["all"]

      return haveSameItems(current, next) ? current : next
    })
  }, [workspace.tags])

  useEffect(() => {
    setActiveAuthorHandles((current) => {
      const validAuthorHandles = current.filter((authorHandle) =>
        authorItems.some((author) => author.authorHandle === authorHandle)
      )

      return haveSameItems(current, validAuthorHandles) ? current : validAuthorHandles
    })
  }, [authorItems])

  const selectedBookmark =
    visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ??
    workspace.bookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ??
    null
  const detailDrawerWidth = Math.min(520, Math.max(440, rightSidebarWidth))

  const tagNamesByBookmarkId = useMemo(() => {
    const map = new Map<string, string[]>()

    for (const bookmark of workspace.bookmarks) {
      const tags = getTagNamesForBookmark(bookmark.tweetId, workspace.bookmarkTags, tagsById).map((tag) => tag.name)
      map.set(bookmark.tweetId, tags)
    }

    return map
  }, [tagsById, workspace.bookmarkTags, workspace.bookmarks])

  const searchId = createFieldId("filters", "search")
  const lastSyncLabel = formatTimestamp(workspace.summary.lastSyncedAt, locale)
  const selectedAuthor = activeAuthorHandles[0]
    ? authorItems.find((author) => author.authorHandle === activeAuthorHandles[0]) ?? null
    : null
  const activeTagNames = activeTagIds.includes("all")
    ? []
    : activeTagIds.map((tagId) => workspace.tags.find((tag) => tag.id === tagId)?.name ?? tagId)
  const currentScopeLabel = (() => {
    const scopeParts: string[] = []

    if (selectedAuthor) {
      scopeParts.push(`${copy.authorPrefix} · ${formatAuthorLabel(selectedAuthor)}`)
    }

    if (activeTagNames.length) {
      scopeParts.push(`${activeTagNames.length > 1 ? copy.tagsTitle : copy.tagPrefix} · ${activeTagNames.join(" + ")}`)
    }

    return scopeParts.length ? scopeParts.join(" + ") : copy.allBookmarks
  })()
  const activeRefinementChips = [
    onlyWithMedia ? { key: "media", label: copy.hasMedia } : null,
    onlyLongform ? { key: "longform", label: copy.longform } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>
  const coldStartLoading = workspace.isLoading && !workspace.bookmarks.length

  function clearRefinement(key: string) {
    if (key === "query") {
      setQuery("")
      return
    }

    if (key === "media") {
      setOnlyWithMedia(false)
      return
    }

    if (key === "longform") {
      setOnlyLongform(false)
    }
  }

  function handleTagToggle(tagId: string) {
    if (tagId === "all") {
      setActiveTagIds(["all"])
      setActiveAuthorHandles([])
      return
    }

    setActiveTagIds((current) => {
      if (current.includes("all")) {
        return [tagId]
      }

      const next = current.includes(tagId)
        ? current.filter((currentTagId) => currentTagId !== tagId)
        : [...current, tagId]

      return next.length ? next : ["all"]
    })
  }

  function handleAuthorToggle(authorHandle: string) {
    if (activeAuthorHandles[0] === authorHandle) {
      startTransition(() => {
        setActiveAuthorHandles([])
      })
      return
    }

    setActiveAuthorHandles([authorHandle])
  }

  function handleResultsScroll(event: React.UIEvent<HTMLDivElement>) {
    if (renderLimit >= visibleBookmarks.length) {
      return
    }

    const target = event.currentTarget
    const remainingScroll = target.scrollHeight - target.scrollTop - target.clientHeight

    if (remainingScroll > 320) {
      return
    }

    setRenderLimit((current) => Math.min(current + RESULTS_RENDER_INCREMENT, visibleBookmarks.length))
  }

  return (
    <>
      <BackgroundScene />
      <main className="min-h-[100dvh]">
        <div data-testid="workspace-shell" className="w-full">
          <div
            data-testid="workspace-overview"
            style={
              typeof window !== "undefined" && window.innerWidth >= 768
                ? {
                    gridTemplateColumns: `${leftSidebarWidth}px 12px minmax(0, 1fr)`
                  }
                : undefined
            }
            className="relative grid gap-0 xl:min-h-0 xl:h-[100dvh] xl:grid-cols-[256px_minmax(0,1fr)] xl:items-stretch">
            <>
              <WorkspaceSidebar
                workspace={workspace}
                locale={locale}
                themePreference={themePreference}
                resolvedTheme={resolvedTheme}
                copy={copy}
                lastSyncLabel={lastSyncLabel}
                activeTagIds={activeTagIds}
                activeAuthorHandles={activeAuthorHandles}
                authorItems={authorItems}
                authorSearchQuery={authorSearchQuery}
                authorsExpanded={authorsExpanded}
                isTagsCollapsed={isTagsCollapsed}
                isAuthorsCollapsed={isAuthorsCollapsed}
                onTagToggle={handleTagToggle}
                onAuthorToggle={handleAuthorToggle}
                onAuthorSearchQueryChange={setAuthorSearchQuery}
                onToggleTagsCollapsed={() => setIsTagsCollapsed((current) => !current)}
                onToggleAuthorsCollapsed={() => setIsAuthorsCollapsed((current) => !current)}
                onExpandAuthors={() => setAuthorsExpanded(true)}
                onCreateTag={workspace.handleCreateTag}
                onDeleteTag={workspace.handleDeleteTag}
                setLocale={setLocale}
                setThemePreference={setThemePreference}
              />

              <div
                role="separator"
                aria-orientation="vertical"
                data-testid="split-handle-left"
                className="workspace-split-handle hidden md:block"
                onPointerDown={(event) => {
                  event.preventDefault()
                  resizeStateRef.current = {
                    side: "left",
                    startX: event.clientX,
                    startWidth: leftSidebarWidth
                  }
                  document.documentElement.classList.add("is-pane-resizing")
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  resizeStateRef.current = {
                    side: "left",
                    startX: event.clientX,
                    startWidth: leftSidebarWidth
                  }
                  document.documentElement.classList.add("is-pane-resizing")
                }}
              />

              <BookmarkResultsPane
                workspace={workspace}
                isLoading={coldStartLoading}
                locale={locale}
                copy={copy}
                currentScopeLabel={currentScopeLabel}
                searchId={searchId}
                query={query}
                setQuery={setQuery}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                viewMode={viewMode}
                setViewMode={setViewMode}
                filterPopoverOpen={filterPopoverOpen}
                setFilterPopoverOpen={setFilterPopoverOpen}
                onlyWithMedia={onlyWithMedia}
                setOnlyWithMedia={setOnlyWithMedia}
                onlyLongform={onlyLongform}
                setOnlyLongform={setOnlyLongform}
                selectedBookmarkId={selectedBookmarkId}
                setSelectedBookmarkId={setSelectedBookmarkId}
                visibleBookmarks={visibleBookmarks}
                renderedBookmarks={renderedBookmarks}
                activeRefinementChips={activeRefinementChips}
                tagNamesByBookmarkId={tagNamesByBookmarkId}
                clearRefinement={clearRefinement}
                onResultsScroll={handleResultsScroll}
              />

              {coldStartLoading ? null : selectedBookmark ? (
                <section
                  data-testid="workspace-detail-drawer"
                  className="options-detail-drawer-shell"
                  style={{ width: `${detailDrawerWidth}px` }}>
                  <div data-testid="workspace-inspector" className="h-full">
                    <BookmarkInspector
                      bookmark={selectedBookmark}
                      tags={workspace.tags}
                      bookmarkTags={workspace.bookmarkTags}
                      isSavingTags={workspace.isSavingTags}
                      locale={locale}
                      copy={copy}
                      onAttachTag={async (tagId) => {
                        if (!selectedBookmark) {
                          return
                        }

                        await workspace.handleAttachTag(selectedBookmark.tweetId, tagId)
                      }}
                      onDetachTag={async (tagId) => {
                        if (!selectedBookmark) {
                          return
                        }

                        await workspace.handleDetachTag(selectedBookmark.tweetId, tagId)
                      }}
                      onClose={() => setSelectedBookmarkId(undefined)}
                    />
                  </div>
                </section>
              ) : null}
            </>
          </div>
        </div>
      </main>
    </>
  )
}

export function OptionsApp() {
  return (
    <ExtensionUiProvider>
      <OptionsScreen />
    </ExtensionUiProvider>
  )
}
