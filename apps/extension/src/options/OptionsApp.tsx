import React, { useEffect, useMemo, useRef, useState } from "react"
import type {
  BookmarkRecord,
  BookmarkTagRecord,
  Locale,
  TagRecord
} from "../lib/types.ts"
import {
  filterBookmarks,
  filterBookmarksByFlags,
  sortBookmarks,
  type BookmarkSortOrder,
} from "../lib/search/searchBookmarks.ts"
import { INBOX_LIST_ID } from "../lib/storage/listsStore.ts"
import { useWorkspaceData } from "./hooks/useWorkspaceData.ts"
import { EmptyState, StatusBadge, SurfaceCard } from "../ui/components.tsx"
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
  return locale === "zh-CN" ? `${zhLabel} ${enLabel}` : enLabel
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
      openOnX: "在 X 中打开",
      tagsTitle: "标签",
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
    latestSaved: "Recently saved",
    activeFilters: "Active filters:",
    sortBy: "Sort by",
    newestSaved: "Newest saved",
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
    openOnX: "Open on X",
    tagsTitle: "Tags",
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

function getListIdByBookmarkId(bookmarkId: string, bookmarkListByBookmarkId: Map<string, string>) {
  return bookmarkListByBookmarkId.get(bookmarkId) ?? INBOX_LIST_ID
}

function getDisplayListName(listId: string, listNamesById: Map<string, string>, copy: OptionsCopy) {
  if (listId === INBOX_LIST_ID) {
    return copy.noList
  }

  return listNamesById.get(listId) ?? copy.noList
}

function getNextThemePreference(themePreference: "system" | "light" | "dark"): "system" | "light" | "dark" {
  if (themePreference === "system") {
    return "dark"
  }

  if (themePreference === "dark") {
    return "light"
  }

  return "system"
}

function createFieldId(scope: string, name: string) {
  return `${scope}-${name}`
}

const SORT_ORDER_SEQUENCE: BookmarkSortOrder[] = ["saved-desc", "saved-asc", "created-desc", "likes-desc"]

function getSortLabel(copy: OptionsCopy, sortOrder: BookmarkSortOrder) {
  switch (sortOrder) {
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
  const palettes = [
    "from-[#f0efeb] via-[#ecebe7] to-[#e6e4de]",
    "from-[#efede7] via-[#ebe8e2] to-[#e4e1da]",
    "from-[#f2f0ea] via-[#ece9e2] to-[#e8e4dc]",
    "from-[#efece5] via-[#e8e4dd] to-[#dfdbd3]",
    "from-[#f5f3ee] via-[#ece8e0] to-[#e2ddd5]"
  ]
  const palette = palettes[index % palettes.length]
  const mediaUrl = bookmark.media?.[0]?.url

  return (
    <div
      className={cn(
        "workspace-media-frame relative h-44 bg-gradient-to-br sm:h-40 lg:h-44 2xl:h-48",
        palette
      )}>
      {mediaUrl ? (
        <img
          src={mediaUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(26,26,26,0.06))]" />
      {mediaUrl ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-black/10 bg-white/75 text-[var(--text-tertiary)]">
            <AppIcon name="image" size={20} />
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-4 bottom-4">
          <div className="max-w-[18ch] text-[0.88rem] leading-6 tracking-[-0.01em] text-[var(--text-secondary)]">
            {truncateText(bookmark.text, 42)}
          </div>
        </div>
      )}
    </div>
  )
}

function BookmarkCard({
  bookmark,
  index,
  currentListName,
  currentTagNames,
  selected,
  locale,
  copy,
  onSelect
}: {
  bookmark: BookmarkRecord
  index: number
  currentListName: string
  currentTagNames: string[]
  selected: boolean
  locale: Locale
  copy: OptionsCopy
  onSelect: () => void
}) {
  return (
    <article
      data-bookmark-card={bookmark.tweetId}
      onClick={onSelect}
      className={cn(
        "options-result-card group relative flex min-h-[220px] flex-col overflow-hidden p-4",
        selected && "options-result-card-selected"
      )}>
      <PreviewMedia bookmark={bookmark} index={index} />

      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--tag-bg)] text-sm font-medium text-[var(--text-primary)]">
          {bookmark.authorName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[0.95rem] font-medium text-[var(--text-primary)]">{bookmark.authorName}</div>
              <div className="options-meta-copy truncate">@{bookmark.authorHandle}</div>
            </div>
            <div className="shrink-0 text-[11px] tracking-[0.02em] text-[var(--text-tertiary)]">
              {formatTimestamp(bookmark.savedAt, locale)}
            </div>
          </div>
          <p className="mt-3 text-[0.83rem] leading-[1.7] text-[var(--text-secondary)]">{truncateText(bookmark.text, 62)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="workspace-badge workspace-badge-plain">{currentListName}</span>
            {bookmark.media?.length ? <span className="chip-button options-chip !cursor-default !px-3 !py-1.5">{copy.hasMedia}</span> : null}
            {currentTagNames.slice(0, 2).map((tagName) => (
              <span key={tagName} className="chip-button options-chip !cursor-default !px-3 !py-1.5">
                {tagName}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
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
}: {
  bookmark: BookmarkRecord | null
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  isSavingTags: boolean
  locale: Locale
  copy: OptionsCopy
  onAttachTag: (tagId: string) => Promise<void>
  onDetachTag: (tagId: string) => Promise<void>
}) {
  const [selectedTagId, setSelectedTagId] = useState("")
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSelectedTagId("")
    if (inspectorScrollRef.current) {
      if (typeof inspectorScrollRef.current.scrollTo === "function") {
        inspectorScrollRef.current.scrollTo({ top: 0, behavior: "auto" })
      } else {
        inspectorScrollRef.current.scrollTop = 0
      }
    }
  }, [bookmark?.tweetId])

  if (!bookmark) {
    return (
      <SurfaceCard chrome="bare" className="options-inspector-shell xl:h-[100dvh]">
        <div data-testid="inspector-section-stack" className="scroll-shell flex min-h-0 flex-1 flex-col overflow-y-auto">
          <EmptyState
            title={copy.detailsTitle}
            description={copy.noBookmarkSelectedDescription}
          />
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
      className="options-inspector-shell xl:h-[100dvh]">
      <div
        ref={inspectorScrollRef}
        data-testid="inspector-section-stack"
        className="scroll-shell flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto">
        <section data-testid="inspector-metadata-section" className="options-inspector-section">
          <div className="options-overline">{getSectionOverline(locale, copy.metadataTitle, "Metadata")}</div>
          <h2 className="options-display-title-xs mt-3">{copy.detailsTitle}</h2>

          <div className="options-inspector-author-row mt-6">
            <div className="options-inspector-avatar">{authorInitials}</div>
            <div className="min-w-0">
              <p className="truncate text-[0.96rem] font-semibold text-[var(--text-primary)]">{bookmark.authorName}</p>
              <p className="options-meta-copy truncate">@{bookmark.authorHandle}</p>
            </div>
          </div>

          <p className="options-meta-copy mt-4">{detailTimestamp}</p>
        </section>

        <section data-testid="inspector-summary-section" className="options-inspector-section">
          <div className="options-overline">{getSectionOverline(locale, copy.summaryTitle, "Summary")}</div>
          <p className="options-body-copy mt-3">{bookmark.text}</p>
          <button
            type="button"
            className="options-secondary-button mt-4 w-full justify-center"
            onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
            <AppIcon name="external" size={14} />
            <span>{copy.openOnX}</span>
          </button>
        </section>

        <section data-testid="inspector-tags-section" className="options-inspector-section">
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
            <FieldBlock label={copy.attachExistingTag} htmlFor={attachSelectId}>
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
              className="options-secondary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="tag" size={14} />
              <span>{copy.addTag}</span>
            </button>
          </div>
        </section>
      </div>
    </SurfaceCard>
  )
}

function WorkspaceSidebar({
  workspace,
  locale,
  themePreference,
  copy,
  lastSyncLabel,
  activeTagIds,
  onTagToggle,
  onCreateTag,
  onDeleteTag,
  setLocale,
  setThemePreference
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  themePreference: "system" | "light" | "dark"
  copy: OptionsCopy
  lastSyncLabel: string
  activeTagIds: string[]
  onTagToggle: (tagId: string) => void
  onCreateTag: (name: string) => Promise<unknown>
  onDeleteTag: (tagId: string) => Promise<unknown>
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
}) {
  const tagCountById = workspace.bookmarkTags.reduce((map, bookmarkTag) => {
    map.set(bookmarkTag.tagId, (map.get(bookmarkTag.tagId) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  function handleCreateTagClick() {
    const name = window.prompt(copy.createTagPrompt, "")
    if (!name?.trim()) {
      return
    }

    void onCreateTag(name)
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="options-overline">{getSectionOverline(locale, "工作区", "Workspace")}</div>
          <StatusBadge status={workspace.summary.status} />
        </div>

        <h1 className="options-display-title mt-4">
          {copy.pageTitle}
        </h1>

        <p className="options-body-copy mt-3 max-w-[24ch]">
          {locale === "zh-CN"
            ? "在列表、标签和最近同步之间搜索、排序并整理已保存内容。"
            : "Search, sort, and organize saved items across lists, tags, and recent syncs."}
        </p>

        <div data-testid="workspace-sidebar-sync" className="mt-5 grid gap-3">
          <div className="options-meta-copy">
            {copy.lastSync} {lastSyncLabel}
          </div>

          <button
            type="button"
            onClick={() => void workspace.handleSync()}
            disabled={workspace.isSyncing}
            className="workspace-sync-primary">
            <AppIcon name="sync" size={16} />
            <span>{workspace.isSyncing ? copy.syncing : copy.syncNow}</span>
          </button>

          <InlineMessage message={workspace.commandError} className="!rounded-[6px] !border-[var(--border-subtle)] !bg-[var(--tag-bg)] !px-3 !py-2 !text-[12px]" />
        </div>
      </section>

      <section data-testid="sidebar-lists-section" className="options-sidebar-lists">
        <div className="px-6 pb-4 pt-6">
          <div className="options-sidebar-section-head">
            <div className="options-overline">{getSectionOverline(locale, "标签", "Tags")}</div>
            <button
              type="button"
              data-testid="sidebar-create-tag"
              aria-label={copy.createTagLabel}
              onClick={handleCreateTagClick}
              className="options-create-tag-button">
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>

        <div data-testid="sidebar-lists-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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
                "options-nav-row w-full text-left",
                activeTagIds.includes("all") && "options-nav-row-active"
              )}>
              <span className="options-nav-row-main">
                <AppIcon name="bookmark" size={14} className="options-nav-row-icon" />
                <span>{copy.allBookmarks}</span>
              </span>
              <span className="options-nav-count">{workspace.stats.totalBookmarks}</span>
            </div>

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
                    "options-nav-row w-full text-left",
                    isSelected && "options-nav-row-active"
                  )}>
                  <span className="options-nav-row-main">
                    <AppIcon name="tag" size={14} className="options-nav-row-icon" />
                    <span className="truncate">{tag.name}</span>
                  </span>
                  <span className="options-nav-row-trailing">
                    <span className="options-nav-count">{tagCountById.get(tag.id) ?? 0}</span>
                    <button
                      type="button"
                      data-testid={isSelected ? undefined : "sidebar-delete-tag"}
                      className="options-nav-row-delete"
                      aria-label={`${copy.deleteLabel} ${tag.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDeleteTagClick(tag.id, tag.name)
                      }}
                    >
                      <AppIcon name="trash" size={12} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section data-testid="sidebar-footer-section" className="options-sidebar-config">
        <div className="px-6 py-6">
          <div className="options-overline">{copy.preferencesLabel}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <button
              type="button"
              data-testid="footer-settings-button"
              aria-label={copy.preferencesLabel}
              className="options-footer-icon-button">
              <AppIcon name="bookmark" size={14} />
            </button>
            <button
              type="button"
              data-testid="footer-locale-toggle"
              onClick={() => void setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
              className="options-footer-chip">
              {locale === "zh-CN" ? "中" : "EN"}
            </button>
            <button
              type="button"
              data-testid="footer-theme-toggle"
              onClick={() => void setThemePreference(getNextThemePreference(themePreference))}
              className="options-footer-icon-button"
              aria-label={copy.themeLabel}>
              {themePreference === "dark" ? "L" : "D"}
            </button>
            <button
              type="button"
              data-testid="footer-info-button"
              aria-label={copy.infoLabel}
              className="options-footer-icon-button">
              <AppIcon name="info" size={14} />
            </button>
          </div>
        </div>
      </section>
    </aside>
  )
}

function WorkspaceToolbar({
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
  clearRefinement,
  clearAllRefinements
}: {
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
  clearAllRefinements: () => void
}) {
  return (
    <div data-testid="library-header-section" className="options-main-header">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="options-overline">{copy.libraryTitle} Archive</div>
            <h2 className="options-display-title-sm mt-3 truncate">{currentScopeLabel}</h2>
          </div>
          <div className="text-right">
            <div className="options-results-value">{visibleBookmarksCount}</div>
            <div className="options-overline mt-1">{copy.results}</div>
          </div>
        </div>

        <InlineMessage message={loadError} className="!rounded-[6px] !border-[var(--border-subtle)] !bg-[var(--tag-bg)] !px-3 !py-2 !text-[12px]" />

        <div data-testid="workspace-toolbar" className="options-toolbar-grid">
          <div className="relative min-w-0">
            <AppIcon name="search" size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <TextInputField
              id={searchId}
              ariaLabel={copy.search}
              type="search"
              value={query}
              placeholder={copy.searchPlaceholder}
              onChange={setQuery}
              className="workspace-input options-toolbar-field pl-11 pr-4"
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
              </button>

              {filterPopoverOpen ? (
                <div data-testid="filter-popover" className="options-filter-popover">
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
              <span>{getSortLabel(copy, sortOrder)}</span>
            </button>

            <div className="options-view-toggle-group">
              <button
                type="button"
                data-testid="view-toggle-grid"
                className={cn("options-view-toggle", viewMode === "grid" && "is-active")}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}>
                Grid
              </button>
              <button
                type="button"
                data-testid="view-toggle-list"
                className={cn("options-view-toggle", viewMode === "list" && "is-active")}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}>
                List
              </button>
            </div>
          </div>
        </div>

        <div data-testid="active-filters-row" className="options-active-filters">
          <span className="options-meta-copy">{copy.activeFilters}</span>
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
              <button
                type="button"
                onClick={clearAllRefinements}
                className="options-clear-button">
                <span>{copy.clearAll}</span>
              </button>
            </>
          ) : (
            <span className="options-meta-copy">-</span>
          )}
        </div>
      </div>
    </div>
  )
}

function BookmarkResultsPane({
  workspace,
  locale,
  copy,
  selectedListId,
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
  activeRefinementChips,
  bookmarkListByBookmarkId,
  tagNamesByBookmarkId,
  listNamesById,
  clearRefinement,
  clearAllRefinements
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  copy: OptionsCopy
  selectedListId: string
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
  activeRefinementChips: Array<{ key: string; label: string }>
  bookmarkListByBookmarkId: Map<string, string>
  tagNamesByBookmarkId: Map<string, string[]>
  listNamesById: Map<string, string>
  clearRefinement: (key: string) => void
  clearAllRefinements: () => void
}) {
  return (
    <section data-testid="library-workspace" className="options-main-shell min-h-[420px] min-w-0 overflow-hidden p-0 xl:h-[100dvh]">
      <div className="flex h-full min-h-0 flex-col">
        <WorkspaceToolbar
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
          clearAllRefinements={clearAllRefinements}
        />

        <div data-testid="library-results-summary" className="options-results-summary flex items-center justify-between gap-3 px-12 py-5">
          <span className="options-meta-copy">{visibleBookmarks.length} {copy.results}</span>
          {selectedListId ? <span className="options-meta-copy">{copy.scopedTo} {currentScopeLabel}</span> : null}
        </div>

        <div data-testid="library-results-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto px-12 pb-12 pt-8">
          {visibleBookmarks.length ? (
            <div
              data-testid="results-stack"
              className={cn(
                "content-start gap-8",
                viewMode === "grid" ? "options-results-grid grid sm:grid-cols-2 2xl:grid-cols-2" : "options-results-list flex flex-col"
              )}>
              {visibleBookmarks.map((bookmark, index) => {
                const currentTagNames = tagNamesByBookmarkId.get(bookmark.tweetId) ?? []
                const currentListName = getDisplayListName(
                  getListIdByBookmarkId(bookmark.tweetId, bookmarkListByBookmarkId),
                  listNamesById,
                  copy
                )
                const isSelected = selectedBookmarkId === bookmark.tweetId

                return (
                  <BookmarkCard
                    key={bookmark.tweetId}
                    bookmark={bookmark}
                    index={index}
                    currentListName={currentListName}
                    currentTagNames={currentTagNames}
                    selected={isSelected}
                    locale={locale}
                    copy={copy}
                    onSelect={() => setSelectedBookmarkId(bookmark.tweetId)}
                  />
                )
              })}
            </div>
          ) : (
            <EmptyState
              title={copy.noBookmarksTitle}
              description={copy.noBookmarksDescription}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function SidebarLoading({ copy: _copy }: { copy: OptionsCopy }) {
  return (
    <SurfaceCard chrome="bare" className="options-sidebar-shell min-h-[420px] xl:h-[100dvh]">
      <div className="space-y-4 px-8 py-10">
        <div className="h-4 animate-pulse rounded-[4px] bg-[var(--tag-bg)]" />
        <div className="h-12 animate-pulse rounded-[4px] bg-[var(--tag-bg)]" />
        <div className="h-10 animate-pulse rounded-[6px] bg-[var(--tag-bg)]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="h-24 animate-pulse rounded-[6px] bg-[var(--tag-bg)]" />
          <div className="h-24 animate-pulse rounded-[6px] bg-[var(--tag-bg)]" />
        </div>
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-[4px] bg-[var(--tag-bg)]" />
          <div className="h-10 animate-pulse rounded-[4px] bg-[var(--tag-bg)]" />
          <div className="h-10 animate-pulse rounded-[4px] bg-[var(--tag-bg)]" />
        </div>
        <div className="h-20 animate-pulse rounded-[4px] bg-[var(--tag-bg)]" />
      </div>
    </SurfaceCard>
  )
}

function OptionsScreen() {
  const workspace = useWorkspaceData()
  const { locale, themePreference, setLocale, setThemePreference } = useExtensionUi()
  const copy = getOptionsCopy(locale)
  const [selectedListId, setSelectedListId] = useState("")
  const [activeTagIds, setActiveTagIds] = useState<string[]>(["all"])
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)

  const bookmarkListByBookmarkId = useMemo(
    () => new Map(workspace.bookmarkLists.map((bookmarkList) => [bookmarkList.bookmarkId, bookmarkList.listId])),
    [workspace.bookmarkLists]
  )
  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const listNamesById = useMemo(() => new Map(workspace.lists.map((list) => [list.id, list.name])), [workspace.lists])
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
          filterBookmarks(scopedBookmarks, query),
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
      activeTagIds,
      bookmarkTagIdsByBookmarkId,
      workspace.bookmarks
    ]
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
    if (selectedListId && !workspace.lists.some((list) => list.id === selectedListId)) {
      setSelectedListId("")
    }
  }, [selectedListId, workspace.lists])

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
  const currentScopeLabel = selectedListId
    ? getDisplayListName(selectedListId, listNamesById, copy)
    : activeTagIds.includes("all")
      ? copy.allBookmarks
      : activeTagIds
          .map((tagId) => workspace.tags.find((tag) => tag.id === tagId)?.name ?? tagId)
          .join(" + ")
  const activeRefinementChips = [
    query.trim() ? { key: "query", label: `${copy.searchPrefix}: ${truncateText(query.trim(), 24)}` } : null,
    onlyWithMedia ? { key: "media", label: copy.hasMedia } : null,
    onlyLongform ? { key: "longform", label: copy.longform } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>

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

  function clearAllRefinements() {
    setQuery("")
    setOnlyWithMedia(false)
    setOnlyLongform(false)
  }

  function handleTagToggle(tagId: string) {
    if (tagId === "all") {
      setActiveTagIds(["all"])
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

  return (
    <>
      <BackgroundScene />
      <main className="min-h-[100dvh]">
        <div data-testid="workspace-shell" className="w-full">
          <div
            data-testid="workspace-overview"
            className="grid gap-0 xl:min-h-0 xl:h-[100dvh] xl:grid-cols-[320px_minmax(0,1fr)_340px] xl:items-stretch">
          {workspace.isLoading && !workspace.bookmarks.length ? (
            <>
              <SidebarLoading copy={copy} />
              <LoadingPanel title={copy.libraryTitle} />
              <LoadingPanel title={copy.detailsTitle} />
            </>
          ) : (
            <>
              <WorkspaceSidebar
                workspace={workspace}
                locale={locale}
                themePreference={themePreference}
                copy={copy}
                lastSyncLabel={lastSyncLabel}
                activeTagIds={activeTagIds}
                onTagToggle={handleTagToggle}
                onCreateTag={workspace.handleCreateTag}
                onDeleteTag={workspace.handleDeleteTag}
                setLocale={setLocale}
                setThemePreference={setThemePreference}
              />

              <BookmarkResultsPane
                workspace={workspace}
                locale={locale}
                copy={copy}
                selectedListId={selectedListId}
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
                activeRefinementChips={activeRefinementChips}
                bookmarkListByBookmarkId={bookmarkListByBookmarkId}
                tagNamesByBookmarkId={tagNamesByBookmarkId}
                listNamesById={listNamesById}
                clearRefinement={clearRefinement}
                clearAllRefinements={clearAllRefinements}
              />

              <section data-testid="workspace-inspector">
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
                />
              </section>
            </>
          )}
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
