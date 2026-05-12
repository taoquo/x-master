import React, { startTransition, useEffect, useMemo, useRef, useState } from "react"
import type {
  BookmarkRecord,
  BookmarkTagRecord,
  Locale,
  TagRecord
} from "../lib/types.ts"
import { getSyncErrorSummary, type SyncErrorKind } from "../lib/x/syncErrors.ts"
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
import { BookmarkInspector } from "./components/BookmarkInspector.tsx"
import { useWorkspaceData } from "./hooks/useWorkspaceData.ts"
import { getSettings, saveSettings } from "../lib/storage/settings.ts"
import { StatusBadge } from "../ui/components.tsx"
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

function formatCompactCount(value: number | undefined, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: value && value >= 1000 ? 1 : 0
  }).format(value ?? 0)
}

function formatSyncErrorSummary(summary: { errorKind?: SyncErrorKind; errorSummary?: string }, locale: Locale) {
  return summary.errorKind ? getSyncErrorSummary(summary.errorKind, locale) : summary.errorSummary
}

function getListCopyDensityClass(text: string, hasMedia: boolean, hasTags: boolean) {
  const textLength = text.trim().length

  if (hasMedia) {
    return "is-list-2line"
  }

  if (!hasTags && textLength <= 48) {
    return "is-list-1line"
  }

  if (hasTags || textLength >= 240) {
    return "is-list-2line"
  }

  return "is-list-3line"
}

function getVisibleCardTagNames(tagNames: string[], viewMode: "grid" | "list") {
  if (viewMode !== "list" || tagNames.length <= 2) {
    return tagNames
  }

  return [...tagNames.slice(0, 2), `+${tagNames.length - 2}`]
}

function getListCardTemplateClass(hasMedia: boolean, hasTags: boolean, copyDensityClass: string) {
  if (hasMedia) {
    return "options-result-card-list-template-media"
  }

  if (hasTags) {
    return "options-result-card-list-template-tagged"
  }

  if (copyDensityClass === "is-list-1line") {
    return "options-result-card-list-template-compact"
  }

  return "options-result-card-list-template-default"
}

function isVideoMediaType(type: string | undefined) {
  return type === "video" || type === "animated_gif"
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
      restoreBackup: "导入恢复",
      restoringBackup: "恢复中...",
      resetLocalData: "重置本地数据",
      resettingData: "重置中...",
      restoreBackupConfirm: "导入恢复会覆盖当前本地数据，确认继续？",
      resetLocalDataConfirm: "重置会清空本地书签、列表、标签和设置，确认继续？",
      validBackup: "有效备份",
      restoredBackup: "已恢复",
      localDataReset: "本地数据已重置",
      bookmarksCountLabel: "书签",
      listsCountLabel: "列表",
      tagsCountLabel: "标签",
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
      emptyFeedTitle: "还没有保存任何书签",
      emptyFeedDescription: "从 X 保存内容后，书签会以当前卡片流布局出现在这里。",
      noBookmarksTitle: "当前筛选条件下没有匹配的书签",
      noBookmarksDescription: "试试调整搜索词、标签或作者范围。",
      loadingFeedTitle: "正在整理你的书签",
      detailsTitle: "详情",
      detailsDescription: "",
      noBookmarkSelectedTitle: "尚未选择书签",
      noBookmarkSelectedDescription: "选择一个书签以查看详情",
      metadataTitle: "元数据",
      detailLabel: "详情",
      timeLabel: "时间",
      timelineTitle: "时间线",
      publishedAt: "发布于",
      savedAt: "保存于",
      summaryTitle: "内容摘要",
      mediaTitle: "媒体资源",
      openOnX: "在 X 中打开",
      tagsTitle: "标签",
      currentTagsTitle: "当前标签",
      addTagTitle: "添加标签",
      closePreview: "关闭预览",
      previousMedia: "上一张",
      nextMedia: "下一张",
      noTagsYet: "还没有标签。",
      attachExistingTag: "附加已有标签",
      selectTag: "选择标签",
      addTag: "添加标签",
      copyLink: "复制链接",
      done: "完成",
      noLinkToCopy: "暂无可复制链接",
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
      loadFailedTitle: "书签加载失败",
      loadFailedDescription: "暂时无法读取本地工作区数据，你可以立即重试。",
      retryLoad: "重新加载",
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
    restoreBackup: "Import restore",
    restoringBackup: "Restoring...",
    resetLocalData: "Reset local data",
    resettingData: "Resetting...",
    restoreBackupConfirm: "Import restore will overwrite current local data. Continue?",
    resetLocalDataConfirm: "Reset will clear local bookmarks, lists, tags, and settings. Continue?",
    validBackup: "Valid backup",
    restoredBackup: "Restored",
    localDataReset: "Local data reset",
    bookmarksCountLabel: "bookmarks",
    listsCountLabel: "lists",
    tagsCountLabel: "tags",
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
    emptyFeedTitle: "No bookmarks saved yet",
    emptyFeedDescription: "Once you save items from X, they will appear here in the current card feed layout.",
    noBookmarksTitle: "No bookmarks match the current filters",
    noBookmarksDescription: "Try adjusting your search, tags, or author scope.",
    loadingFeedTitle: "Loading your bookmark feed",
    detailsTitle: "Details",
    detailsDescription: "",
    noBookmarkSelectedTitle: "No bookmark selected",
    noBookmarkSelectedDescription: "Select a bookmark to view details",
    metadataTitle: "Metadata",
    detailLabel: "Details",
    timeLabel: "Time",
    timelineTitle: "Timeline",
    publishedAt: "Published",
    savedAt: "Saved",
    summaryTitle: "Summary",
    mediaTitle: "Media",
    openOnX: "Open on X",
    tagsTitle: "Tags",
    currentTagsTitle: "Current tags",
    addTagTitle: "Add tag",
    closePreview: "Close preview",
    previousMedia: "Previous media",
    nextMedia: "Next media",
    noTagsYet: "No tags yet.",
    attachExistingTag: "Attach existing tag",
    selectTag: "Select a tag",
    addTag: "Add a tag",
    copyLink: "Copy link",
    done: "Done",
    noLinkToCopy: "No link available",
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
    loadFailedTitle: "Failed to load bookmarks",
    loadFailedDescription: "The local workspace could not be read right now. Try loading it again.",
    retryLoad: "Retry load",
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
        "folio-inline-message",
        tone === "error" ? "is-error" : "is-info",
        className
      )}>
      {message}
    </div>
  )
}

function FeedStatusCard({
  testId,
  icon,
  overline,
  title,
  description,
  tone = "default",
  action
}: {
  testId: string
  icon: React.ReactNode
  overline: string
  title: string
  description: string
  tone?: "default" | "error"
  action?: React.ReactNode
}) {
  return (
    <div data-testid={testId} className={cn("options-feed-state-shell options-theme-panel", tone === "error" && "is-error")}>
      <div className="options-feed-state-icon">{icon}</div>
      <div className="space-y-3">
        <div className="options-feed-state-overline">{overline}</div>
        <h3 className="options-feed-state-title">{title}</h3>
        <p className="options-feed-state-copy">{description}</p>
      </div>
      {action ? <div className="options-feed-state-actions">{action}</div> : null}
    </div>
  )
}

function FeedLoadingState({ copy }: { copy: OptionsCopy }) {
  return (
    <div data-testid="feed-loading-state" className="options-feed-skeleton-shell options-theme-panel">
      <div className="options-feed-skeleton-head">
        <div className="space-y-3">
          <div className="options-feed-state-overline">{copy.loadingFeedTitle}</div>
          <div className="h-5 w-56 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-[12px] bg-[var(--surface-muted)]" />
      </div>

      <div className="options-feed-skeleton-grid" aria-hidden="true">
        {[228, 276, 244, 296, 236, 260].map((height, index) => (
          <div key={`${height}-${index}`} className="options-feed-skeleton-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="h-4 w-[88%] animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="h-4 w-[64%] animate-pulse rounded-full bg-[var(--surface-muted)]" />
            </div>
            <div className="mt-5 animate-pulse rounded-[16px] bg-[var(--surface-muted)]" style={{ height }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function formatBackupDate(value: string, locale: Locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date)
}

function DataSafetyPanel({
  workspace,
  locale,
  copy
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  copy: OptionsCopy
}) {
  const validation = workspace.backupValidationResult
  const restoreResult = workspace.restoreResult
  const resetResult = workspace.resetResult

  const statusText = (() => {
    if (restoreResult) {
      return `${copy.restoredBackup} ${restoreResult.counts.bookmarks} ${copy.bookmarksCountLabel}`
    }

    if (resetResult) {
      return copy.localDataReset
    }

    if (validation) {
      return `${copy.validBackup} · ${validation.counts.bookmarks} ${copy.bookmarksCountLabel} · ${validation.counts.tags} ${copy.tagsCountLabel} · ${formatBackupDate(validation.exportedAt, locale)}`
    }

    return null
  })()

  if (!statusText) {
    return null
  }

  return (
    <section data-testid="workspace-data-safety-panel" className="options-data-safety-panel">
      <div data-testid="data-safety-validation-result">
        <InlineMessage
          message={statusText}
          tone="info"
          className="options-data-safety-result"
        />
      </div>
    </section>
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

function PreviewMedia({
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

function AuthorAvatar({
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

function BookmarkCard({
  bookmark,
  index,
  currentTagNames,
  selected,
  viewMode,
  locale,
  onSelect
}: {
  bookmark: BookmarkRecord
  index: number
  currentTagNames: string[]
  selected: boolean
  viewMode: "grid" | "list"
  locale: Locale
  onSelect: () => void
}) {
  const authorInitials = bookmark.authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || bookmark.authorHandle.slice(0, 2).toUpperCase()
  const showsInlineMedia = viewMode === "list" && !!bookmark.media?.length
  const mediaPreview = <PreviewMedia bookmark={bookmark} index={index} className={showsInlineMedia ? "options-card-media-inline" : undefined} />
  const hasTags = currentTagNames.length > 0
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
        listCardTemplateClass,
        selected && "options-result-card-selected"
      )}>
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

                {visibleTagNames.length ? (
                  <div className="options-card-tags">
                    {visibleTagNames.map((tagName) => (
                      <span key={tagName} className="options-card-tag">
                        {tagName}
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
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
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

  function resetFileInput(input: HTMLInputElement | null) {
    if (input) {
      input.value = ""
    }
  }

  function reloadOptionsPage() {
    if (typeof location !== "undefined" && typeof location.reload === "function") {
      location.reload()
      return
    }

    if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
      window.location.reload()
    }
  }

  async function handleRestoreFile(file: File | undefined, input: HTMLInputElement | null) {
    if (!file) {
      return
    }

    try {
      await workspace.handleValidateBackupFile(file)
      const shouldRestore = typeof window.confirm === "function" ? window.confirm(copy.restoreBackupConfirm) : true
      if (shouldRestore) {
        await workspace.handleRestoreBackupFile(file)
        reloadOptionsPage()
      }
    } catch {
      // The shared command error area renders the failure.
    } finally {
      resetFileInput(input)
    }
  }

  async function handleResetLocalData() {
    const shouldReset = typeof window.confirm === "function" ? window.confirm(copy.resetLocalDataConfirm) : true
    if (!shouldReset) {
      return
    }

    try {
      await workspace.handleResetLocalData()
      reloadOptionsPage()
    } catch {
      // The shared command error area renders the failure.
    }
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
      className="options-demo-sidebar options-sidebar-shell folio-index-panel options-theme-panel flex min-h-[420px] min-w-0 flex-col overflow-hidden">
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
            className="options-sidebar-brand-mark rounded-[12px]"
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
            className="workspace-sync-primary folio-secondary-action">
            <AppIcon name="sync" size={16} className={workspace.isSyncing ? "animate-spin" : undefined} />
            <span>{workspace.isSyncing ? copy.syncing : copy.syncNow}</span>
          </button>

          <InlineMessage message={formatSyncErrorSummary(workspace.summary, locale) ?? workspace.commandError} />
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
              <div data-testid="sidebar-tags-content" className="options-sidebar-group-content options-sidebar-group-content-tags">
              <div data-testid="sidebar-list-tree" className="options-sidebar-rows">
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
              <div data-testid="sidebar-authors-content" className="options-sidebar-group-content options-sidebar-group-content-authors">
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

                <div className="options-sidebar-rows">
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
                        className={cn("options-nav-row options-author-nav-row w-full text-left", isSelected && "options-nav-row-active")}>
                        <span className="options-nav-row-main min-w-0">
                          <span className="options-author-avatar options-nav-row-icon" aria-hidden="true">
                            {author.authorAvatarUrl ? (
                              <img src={author.authorAvatarUrl} alt="" />
                            ) : (
                              <span className="options-author-avatar-fallback">@</span>
                            )}
                          </span>
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
          <DataSafetyPanel workspace={workspace} locale={locale} copy={copy} />
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
              <span
                data-testid="footer-data-actions-divider"
                className="options-footer-divider"
                aria-hidden="true"
              />
              <button
                type="button"
                data-testid="footer-export-toggle"
                onClick={() => void workspace.handleExportWorkspace()}
                disabled={workspace.isExporting}
                className="options-footer-icon-button"
                aria-label={copy.exportData}>
                <AppIcon name="export" size={14} />
              </button>
              <button
                type="button"
                data-testid="data-safety-restore-backup"
                onClick={() => restoreInputRef.current?.click()}
                disabled={workspace.isValidatingBackup || workspace.isRestoringBackup}
                className="options-footer-icon-button"
                aria-label={copy.restoreBackup}>
                <AppIcon name="import" size={14} />
              </button>
              <button
                type="button"
                data-testid="data-safety-reset-local"
                onClick={() => void handleResetLocalData()}
                disabled={workspace.isResettingData}
                className="options-footer-icon-button options-footer-icon-button-danger"
                aria-label={workspace.isResettingData ? copy.resettingData : copy.resetLocalData}>
                <AppIcon name="trash" size={14} />
              </button>
            </div>
          </div>
          <input
            ref={restoreInputRef}
            data-testid="data-safety-restore-input"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void handleRestoreFile(event.currentTarget.files?.[0], event.currentTarget)}
          />
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
      <div className="options-main-header-top">
        <div className="options-main-header-row">
          <div className="options-main-header-copy min-w-0">
            <div className="options-overline">{getSectionOverline(locale, copy.libraryTitle, "Archive")}</div>
            <h2 className="options-display-title-sm mt-3 truncate font-bold">{currentScopeLabel}</h2>
          </div>
          <div className="options-main-header-summary text-right">
            <div data-testid="results-count" className="options-results-value options-main-header-summary-value font-bold">{visibleBookmarksCount}</div>
            <div className="options-overline options-main-header-summary-label mt-1">{copy.results}</div>
          </div>
        </div>
      </div>

      <InlineMessage message={loadError} />

      <div data-testid="workspace-toolbar" className="options-toolbar-shell folio-filter-bar options-theme-panel">
        <div className="options-toolbar-primary">
          <div className="options-toolbar-search relative min-w-0 flex-1">
            <AppIcon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <TextInputField
              id={searchId}
              ariaLabel={copy.search}
              type="search"
              value={query}
              placeholder={copy.searchPlaceholder}
              onChange={setQuery}
              className="workspace-input options-toolbar-field options-toolbar-field-compact pl-10 pr-4"
            />
          </div>

          <div className="options-toolbar-controls options-toolbar-inline">
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
                <div data-testid="filter-popover" className="options-filter-popover options-theme-elevated">
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

        <div className="options-toolbar-summary-row options-toolbar-context-row">
          <div data-testid="active-filters-row" className="options-active-filters">
            <span className="options-active-filters-label">{copy.activeFilters}</span>
            {activeRefinementChips.length ? (
              <>
                {activeRefinementChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => clearRefinement(chip.key)}
                    className="chip-button options-chip options-theme-elevated !px-3 !py-1.5 !text-xs">
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
  const hasAnyBookmarks = workspace.bookmarks.length > 0
  const hasFeedRefinement = currentScopeLabel !== copy.allBookmarks || Boolean(query.trim()) || activeRefinementChips.length > 0
  const showLoadErrorState = Boolean(workspace.loadError) && !hasAnyBookmarks

  return (
    <section data-testid="library-workspace" className="options-main-shell min-h-[420px] min-w-0 overflow-hidden p-0 xl:h-[100dvh]">
      <div className="flex h-full min-h-0 flex-col">
        <div
          data-testid="library-results-scroll"
          className="scroll-shell min-h-0 flex-1 overflow-y-auto"
          onScroll={onResultsScroll}>
          <div
            data-testid="results-shell"
            className={cn(
              "options-results-shell options-theme-surface mx-auto w-full px-5 pb-10 pt-4 lg:px-8",
              viewMode === "grid" ? "options-results-shell-grid" : "options-results-shell-list"
            )}>
            <WorkspaceToolbar
              locale={locale}
              copy={copy}
              loadError={showLoadErrorState ? null : workspace.loadError}
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

            {isLoading ? (
              <FeedLoadingState copy={copy} />
            ) : showLoadErrorState ? (
              <FeedStatusCard
                testId="feed-error-state"
                icon={<AppIcon name="sync" size={24} />}
                overline={copy.infoLabel}
                title={copy.loadFailedTitle}
                description={workspace.loadError ?? copy.loadFailedDescription}
                tone="error"
                action={
                  <button
                    type="button"
                    data-testid="feed-error-retry"
                    className="options-secondary-button"
                    onClick={() => void workspace.refreshData()}>
                    <AppIcon name="sync" size={16} />
                    {copy.retryLoad}
                  </button>
                }
              />
            ) : visibleBookmarks.length ? (
              <div
                data-testid="results-stack"
                className={cn(
                  "content-start",
                  viewMode === "grid"
                    ? "options-results-grid options-results-masonry options-results-stack-grid columns-1 lg:columns-2"
                    : "options-results-list options-results-stack-list flex flex-col"
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
                      viewMode={viewMode}
                      locale={locale}
                      onSelect={() => setSelectedBookmarkId(bookmark.tweetId)}
                    />
                  )
                })}
              </div>
            ) : (
              <FeedStatusCard
                testId="feed-empty-state"
                icon={<AppIcon name={hasFeedRefinement ? "filter" : "bookmark"} size={24} />}
                overline={copy.infoLabel}
                title={hasAnyBookmarks || hasFeedRefinement ? copy.noBookmarksTitle : copy.emptyFeedTitle}
                description={hasAnyBookmarks || hasFeedRefinement ? copy.noBookmarksDescription : copy.emptyFeedDescription}
              />
            )}
          </div>
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

  useEffect(() => {
    if (!selectedBookmark || typeof document === "undefined") {
      return
    }

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = "hidden"
    body.classList.add("options-detail-scroll-locked")

    return () => {
      body.style.overflow = previousOverflow
      body.classList.remove("options-detail-scroll-locked")
    }
  }, [selectedBookmark])

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
                  data-testid="workspace-detail-modal"
                  role="presentation"
                  className="options-detail-modal">
                  <button
                    type="button"
                    data-testid="workspace-detail-backdrop"
                    aria-label={copy.detailsTitle}
                    className="options-detail-backdrop"
                    onClick={() => setSelectedBookmarkId(undefined)}
                  />
                  <div data-testid="workspace-detail-card" className="options-detail-focus-card">
                    <BookmarkInspector
                      bookmark={selectedBookmark}
                      tags={workspace.tags}
                      bookmarkTags={workspace.bookmarkTags}
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
                      onCreateTag={workspace.handleCreateTag}
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
