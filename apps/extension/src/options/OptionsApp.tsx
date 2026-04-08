import React, { useEffect, useMemo, useRef, useState } from "react"
import type {
  BookmarkRecord,
  BookmarkTagRecord,
  Locale,
  ListRecord,
  TagRecord
} from "../lib/types.ts"
import {
  applyBookmarkFilters,
  type BookmarkSortOrder,
  type SavedTimeRange
} from "../lib/search/searchBookmarks.ts"
import { INBOX_LIST_ID } from "../lib/storage/listsStore.ts"
import { useWorkspaceData } from "./hooks/useWorkspaceData.ts"
import { EmptyState, StatusBadge, SurfaceCard } from "../ui/components.tsx"
import { ExtensionUiProvider, useExtensionUi } from "../ui/provider.tsx"
import { AppIcon } from "../ui/icons.tsx"
import { localeOptions, themeOptions } from "../ui/i18n.ts"

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
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
      searchPlaceholder: "搜索书签、作者和备注",
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
      advancedFilters: "高级筛选",
      hideAdvancedFilters: "收起高级筛选",
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
      selectVisible: "选中当前可见项",
      noBookmarksTitle: "当前筛选条件下没有匹配的书签",
      noBookmarksDescription: "",
      detailsTitle: "详情",
      detailsDescription: "",
      noBookmarkSelectedTitle: "尚未选择书签",
      noBookmarkSelectedDescription: "",
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
      selectedCount: "已选"
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
    searchPlaceholder: "Search bookmarks, authors, and notes",
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
    advancedFilters: "Advanced filters",
    hideAdvancedFilters: "Hide advanced filters",
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
    selectVisible: "Select visible",
    noBookmarksTitle: "No bookmarks match the current filters",
    noBookmarksDescription: "",
    detailsTitle: "Details",
    detailsDescription: "",
    noBookmarkSelectedTitle: "No bookmark selected",
    noBookmarkSelectedDescription: "",
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
    selectedCount: "selected"
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

function normalizeListName(value: string) {
  return value.trim().toLocaleLowerCase()
}

function getVisibleLists(lists: ListRecord[]) {
  return lists.filter((list) => list.id !== INBOX_LIST_ID)
}

function getNextAvailableListName(baseName: string, lists: ListRecord[]) {
  const visibleNames = new Set(getVisibleLists(lists).map((list) => normalizeListName(list.name)))
  if (!visibleNames.has(normalizeListName(baseName))) {
    return baseName
  }

  let index = 2
  while (visibleNames.has(normalizeListName(`${baseName} ${index}`))) {
    index += 1
  }

  return `${baseName} ${index}`
}

function getDisplayListName(listId: string, listNamesById: Map<string, string>, copy: OptionsCopy) {
  if (listId === INBOX_LIST_ID) {
    return copy.noList
  }

  return listNamesById.get(listId) ?? copy.noList
}

function createFieldId(scope: string, name: string) {
  return `${scope}-${name}`
}

function BackgroundScene() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(113,112,255,0.12),transparent_68%)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(94,106,210,0.08),transparent_72%)] blur-3xl" />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
    </>
  )
}

function LoadingPanel({ title }: { title: string }) {
  return (
    <SurfaceCard title={title}>
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white/55" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/55" />
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/55" />
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

function PreferencesPanel({
  locale,
  themePreference,
  setLocale,
  setThemePreference,
  copy,
  compact = false
}: {
  locale: Locale
  themePreference: "system" | "light" | "dark"
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
  copy: OptionsCopy
  compact?: boolean
}) {
  const localeFieldId = createFieldId("preferences-tip", "locale")
  const themeFieldId = createFieldId("preferences-tip", "theme")

  return (
    <div data-testid="workspace-preferences-inline" className={cn("grid gap-4", compact && "gap-3")}>
      {!compact ? (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] border border-white/65 bg-white/36 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <AppIcon name="info" size={15} />
          </span>
          <div className="min-w-0">
            <div className="workspace-overline">{copy.preferencesTitle}</div>
            {copy.preferencesDescription ? <p className="workspace-body mt-1">{copy.preferencesDescription}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label={copy.languageLabel} htmlFor={localeFieldId}>
          <SelectField
            id={localeFieldId}
            value={locale}
            onChange={(value) => void setLocale(value as Locale)}
            options={localeOptions.map((option) => ({ value: option.value, label: option.label[locale] }))}
            className="workspace-field"
          />
        </FieldBlock>

        <FieldBlock label={copy.themeLabel} htmlFor={themeFieldId}>
          <SelectField
            id={themeFieldId}
            value={themePreference}
            onChange={(value) => void setThemePreference(value as typeof themePreference)}
            options={themeOptions.map((option) => ({ value: option.value, label: option.label[locale] }))}
            className="workspace-field"
          />
        </FieldBlock>
      </div>
    </div>
  )
}

function getLocaleSummaryLabel(locale: Locale) {
  return locale === "zh-CN" ? "中文" : "English"
}

function getThemeSummaryLabel(themePreference: "system" | "light" | "dark", locale: Locale) {
  const option = themeOptions.find((entry) => entry.value === themePreference)
  return option ? option.label[locale] : themePreference
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
      <label htmlFor={htmlFor} className={cn("block text-[12px] font-medium leading-4 text-slate-600", labelClassName)}>
        {label}
      </label>
      {children}
      {description ? <p className="workspace-meta">{description}</p> : null}
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

function ToolbarSelectField({
  shellTestId,
  label,
  id,
  value,
  onChange,
  options
}: {
  shellTestId: string
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div data-testid={shellTestId} className="relative min-w-0">
      <span className="pointer-events-none absolute left-4 top-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <SelectField
        id={id}
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options}
        className="workspace-field px-4 pb-3 pt-7"
      />
    </div>
  )
}

function ReadonlyField({ value, className, id }: { value: string; className?: string; id?: string }) {
  return (
    <div id={id} className={cn("readonly-field workspace-body", className)}>
      <span className="truncate">{value}</span>
    </div>
  )
}

function ToggleChip({
  checked,
  label,
  onChange,
  className,
  activeClassName
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  className?: string
  activeClassName?: string
}) {
  return (
    <label className={cn("chip-button", className, checked && (activeClassName ?? "chip-button-active"))}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="sr-only"
      />
      <span>{label}</span>
    </label>
  )
}

function PreviewMedia({ bookmark, index }: { bookmark: BookmarkRecord; index: number }) {
  const palettes = [
    "from-[#191a1b] via-[#23252a] to-[#2b2d31]",
    "from-[#101114] via-[#1c1d22] to-[#2a2d3b]",
    "from-[#17181b] via-[#242730] to-[#31354b]",
    "from-[#161820] via-[#20293b] to-[#2f4467]",
    "from-[#16171c] via-[#252236] to-[#3d3b58]"
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,10,0.04),rgba(8,9,10,0.38))]" />
      {mediaUrl ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/28 text-white backdrop-blur-xl">
            <AppIcon name="play" size={28} />
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-4 bottom-4">
          <div className="max-w-[18ch] text-[0.98rem] font-medium leading-6 tracking-[-0.02em] text-white/82">
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
  checked,
  locale,
  copy,
  onSelect,
  onToggle
}: {
  bookmark: BookmarkRecord
  index: number
  currentListName: string
  currentTagNames: string[]
  selected: boolean
  checked: boolean
  locale: Locale
  copy: OptionsCopy
  onSelect: () => void
  onToggle: () => void
}) {
  return (
    <article
      data-bookmark-card={bookmark.tweetId}
      onClick={onSelect}
      className={cn(
        "workspace-bookmark-card group relative flex min-h-[232px] flex-col overflow-hidden p-4 sm:min-h-[224px] 2xl:min-h-[252px]",
        selected && "workspace-bookmark-card-selected"
      )}>
      <div className="absolute right-4 top-4 z-10">
        <input
          type="checkbox"
          aria-label={`${copy.selectBookmark} ${bookmark.authorHandle}`}
          checked={checked}
          onChange={(event) => {
            event.stopPropagation()
            onToggle()
          }}
          onClick={(event) => event.stopPropagation()}
          className="h-5 w-5 rounded border-white/80 bg-white/80"
        />
      </div>

      <PreviewMedia bookmark={bookmark} index={index} />

      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-950 text-sm font-medium text-white">
          {bookmark.authorName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[0.95rem] font-medium text-slate-900">{bookmark.authorName}</div>
              <div className="workspace-meta truncate">@{bookmark.authorHandle}</div>
            </div>
            <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-slate-500">
              {formatTimestamp(bookmark.savedAt, locale)}
            </div>
          </div>
          <p className="mt-3 text-[0.875rem] leading-[1.55rem] text-slate-600">{truncateText(bookmark.text, 62)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip-button workspace-chip !cursor-default !px-3 !py-1.5">{currentListName}</span>
            {bookmark.media?.length ? <span className="chip-button workspace-chip !cursor-default !px-3 !py-1.5">{copy.hasMedia}</span> : null}
            {currentTagNames.slice(0, 2).map((tagName) => (
              <span key={tagName} className="chip-button workspace-chip !cursor-default !px-3 !py-1.5">
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
  lists,
  tags,
  bookmarkTags,
  currentListId,
  isSavingTags,
  locale,
  copy,
  onMoveToList,
  onAttachTag,
  onDetachTag,
  onCreateTag,
  onDeleteTag
}: {
  bookmark: BookmarkRecord | null
  lists: ListRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  currentListId: string
  isSavingTags: boolean
  locale: Locale
  copy: OptionsCopy
  onMoveToList: (listId: string) => Promise<void>
  onAttachTag: (tagId: string) => Promise<void>
  onDetachTag: (tagId: string) => Promise<void>
  onCreateTag: (name: string) => Promise<void>
  onDeleteTag: (tagId: string) => Promise<void>
}) {
  const [selectedTagId, setSelectedTagId] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSelectedTagId("")
    setNewTagName("")
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
      <EmptyState
        title={copy.noBookmarkSelectedTitle}
        description={copy.noBookmarkSelectedDescription}
      />
    )
  }

  const currentTags = tags.filter((tag) => bookmarkTags.some((bookmarkTag) => bookmarkTag.bookmarkId === bookmark.tweetId && bookmarkTag.tagId === tag.id))
  const availableTagOptions = tags.filter((tag) => !currentTags.some((currentTag) => currentTag.id === tag.id))

  const attachSelectId = createFieldId("details", "attach-tag")
  const createTagId = createFieldId("details", "new-tag")
  const listSelectId = createFieldId("details", "list")
  const focusId = createFieldId("details", "focus")

  return (
    <SurfaceCard
      title={copy.detailsTitle}
      className="workspace-inspector-shell xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)] xl:max-h-[calc(100dvh-3rem)]">
      <div
        ref={inspectorScrollRef}
        data-testid="inspector-section-stack"
        className="scroll-shell flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        <section data-testid="inspector-meta-section" className="workspace-inspector-section">
          <div className="workspace-section-label">{copy.bookmarkFocus}</div>
          <div className="mt-3 overflow-hidden rounded-[1.8rem]">
            <PreviewMedia bookmark={bookmark} index={0} />
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-slate-950 text-white shadow-soft">
              {bookmark.authorName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[1.05rem] font-semibold leading-5 tracking-[-0.02em] text-slate-900">{bookmark.authorName}</div>
              <div className="workspace-meta">@{bookmark.authorHandle}</div>
            </div>
          </div>

          <p className="mt-4 max-w-[34ch] text-[0.95rem] leading-6 text-slate-600">{truncateText(bookmark.text, 148)}</p>

          <div className="workspace-meta mt-3">
            {formatTimestamp(bookmark.createdAtOnX, locale)}
          </div>

          <button
            type="button"
            className="glass-button mt-6 w-full justify-center"
            onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
            <AppIcon name="external" size={16} />
            <span>{copy.openOnX}</span>
          </button>
        </section>

        <section data-testid="inspector-tags-section" className="workspace-inspector-section">
          <div className="workspace-section-label">{copy.tagsTitle}</div>
          <h3 className="workspace-title-md text-slate-900">{copy.tagsTitle}</h3>
          <div data-testid="current-tags" className="mt-4 flex flex-wrap gap-2">
            {!currentTags.length ? <span className="text-sm text-slate-600">{copy.noTagsYet}</span> : null}
            {currentTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void onDetachTag(tag.id)}
                className="chip-button">
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
                className="workspace-field"
              />
            </FieldBlock>
            <button
              type="button"
              onClick={() => void onAttachTag(selectedTagId)}
              disabled={isSavingTags || !selectedTagId}
              className="glass-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="tag" size={16} />
              <span>{copy.addTag}</span>
            </button>
          </div>
        </section>

        <section data-testid="inspector-assignment-section" className="workspace-inspector-section">
          <div className="workspace-section-label">{copy.assignmentTitle}</div>
          <h3 className="workspace-title-md text-slate-900">{copy.assignmentTitle}</h3>
          <div className="mt-4 grid gap-4">
            <FieldBlock label={copy.bookmarkFocus} htmlFor={focusId}>
              <ReadonlyField id={focusId} value={truncateText(bookmark.text, 90)} />
            </FieldBlock>

            <FieldBlock label={copy.primaryList} htmlFor={listSelectId}>
              <SelectField
                id={listSelectId}
                value={currentListId}
                onChange={(value) => void onMoveToList(value)}
                options={[
                  { value: INBOX_LIST_ID, label: copy.noList },
                  ...lists.map((list) => ({ value: list.id, label: list.name }))
                ]}
                className="workspace-field"
              />
            </FieldBlock>
          </div>
        </section>

        <section data-testid="inspector-create-tag-section" className="workspace-inspector-section">
          <div className="workspace-section-label">{copy.createTagLabel}</div>
          <h3 className="workspace-title-md text-slate-900">{copy.createTagLabel}</h3>
          <div className="mt-4 grid gap-4">
            <FieldBlock
              label={copy.createTagLabel}
              htmlFor={createTagId}>
              <TextInputField
                id={createTagId}
                value={newTagName}
                placeholder="research"
                onChange={setNewTagName}
                className="workspace-field"
              />
            </FieldBlock>
            <button
              type="button"
              onClick={() =>
                void onCreateTag(newTagName).then(() => {
                  setNewTagName("")
                })
              }
              disabled={isSavingTags || !newTagName.trim()}
              className="glass-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="sparkle" size={16} />
              <span>{copy.create}</span>
            </button>
          </div>
        </section>

        <section className="workspace-inspector-section">
          <div className="workspace-section-label">{copy.tagLibrary}</div>
          <h3 className="workspace-title-md text-slate-900">{copy.tagLibrary}</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {!tags.length ? <span className="text-sm text-slate-600">{copy.noTagsCreated}</span> : null}
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void onDeleteTag(tag.id)}
                className="chip-button">
                <span>{tag.name}</span>
                <AppIcon name="trash" size={12} />
              </button>
            ))}
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
  setLocale,
  setThemePreference,
  copy,
  lastSyncLabel,
  selectedListId,
  setSelectedListId,
  editingListId,
  editingListName,
  setEditingListName,
  onCreateList,
  onStartListRename,
  onCommitListRename,
  onCancelListRename,
  showPreferencesPanel,
  setShowPreferencesPanel
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  themePreference: "system" | "light" | "dark"
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
  copy: OptionsCopy
  lastSyncLabel: string
  selectedListId: string
  setSelectedListId: React.Dispatch<React.SetStateAction<string>>
  editingListId: string | null
  editingListName: string
  setEditingListName: React.Dispatch<React.SetStateAction<string>>
  onCreateList: () => Promise<void>
  onStartListRename: (listId: string, name: string) => void
  onCommitListRename: (nextName?: string) => Promise<void>
  onCancelListRename: () => void
  showPreferencesPanel: boolean
  setShowPreferencesPanel: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const visibleListCounts = workspace.stats.listCounts.filter((list) => list.listId !== INBOX_LIST_ID)

  return (
    <aside
      data-testid="lists-sidebar"
      className="panel-surface flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-[24px] p-0 xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)] xl:max-h-[calc(100dvh-3rem)]">
      <section data-testid="sidebar-status-section" className="border-b border-white/45 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="workspace-title-xl max-w-[8ch] text-slate-950">
            {copy.pageTitle}
          </h1>
          <StatusBadge status={workspace.summary.status} />
        </div>

        <div data-testid="workspace-sidebar-sync" className="mt-4 grid gap-3">
          <div className="workspace-meta rounded-[1.2rem] border border-white/60 bg-white/20 px-4 py-3 backdrop-blur-xl">
            {copy.lastSync} {lastSyncLabel}
          </div>
          <button
            type="button"
            onClick={() => void workspace.handleSync()}
            disabled={workspace.isSyncing}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[1.2rem] border border-slate-900/90 bg-slate-950 px-4 py-2.5 text-[0.95rem] font-medium text-white shadow-[0_18px_44px_-26px_rgba(15,23,42,0.45)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60">
            <AppIcon name="sync" size={16} />
            <span>{workspace.isSyncing ? copy.syncing : copy.syncNow}</span>
          </button>
          <InlineMessage message={workspace.commandError} />
        </div>

        <div data-testid="workspace-summary-strip" className="mt-4">
          <div className="flex items-center justify-between rounded-[1.1rem] border border-white/45 bg-white/10 px-3.5 py-3">
            <p className="text-[11px] font-medium tracking-[0.08em] text-slate-500">{copy.totalTags}</p>
            <div className="text-[1rem] font-semibold tracking-[-0.03em] text-slate-800">{workspace.tags.length}</div>
          </div>
        </div>
      </section>

      <section data-testid="sidebar-lists-section" className="flex min-h-0 flex-1 flex-col">
        <div data-testid="sidebar-lists-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-5">
          <div data-testid="sidebar-tree-root" className="workspace-tree-shell">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-500/70" aria-hidden="true" />
                <span className="truncate text-[12px] font-medium tracking-[0.06em] text-slate-600">{copy.listsTitle}</span>
              </div>
              <button
                type="button"
                data-testid="add-list-button"
                aria-label={copy.newList}
                onClick={() => void onCreateList()}
                disabled={workspace.isSavingLists}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[0.9rem] border border-white/60 bg-white/22 text-lg leading-none text-slate-700 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/40 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60">
                +
              </button>
            </div>
          </div>

          <div data-testid="sidebar-list-tree" className="workspace-tree-branch">
            <div className="space-y-1.5">
              <button
                type="button"
                data-list-button="all"
                onClick={() => setSelectedListId("")}
                className={cn(
                  "workspace-action-row workspace-tree-row w-full text-left text-[0.92rem]",
                  selectedListId === ""
                    ? "workspace-tree-row-active"
                    : "text-slate-700"
                )}>
                <span>{copy.allBookmarks}</span>
                <span className="font-mono text-[12px]">{workspace.stats.totalBookmarks}</span>
                <span className="h-8 w-8" aria-hidden="true" />
              </button>

              {visibleListCounts.map((list) => {
                const isSelected = selectedListId === list.listId
                return (
                  <div key={list.listId} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    {editingListId === list.listId ? (
                      <div className="workspace-tree-row workspace-tree-row-active grid min-h-[42px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3">
                        <input
                          data-testid="inline-list-name-input"
                          value={editingListName}
                          autoFocus
                          onChange={(event) => setEditingListName(event.currentTarget.value)}
                          onBlur={(event) => void onCommitListRename(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              void onCommitListRename(event.currentTarget.value)
                            }

                            if (event.key === "Escape") {
                              event.preventDefault()
                              onCancelListRename()
                            }
                          }}
                          className="field-shell h-9 w-full rounded-[10px] border-white/30 bg-white/10 px-3 text-[0.92rem]"
                        />
                        <span className="font-mono text-[12px]">{list.count}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-list-button={list.listId}
                        onClick={() => setSelectedListId(list.listId)}
                        onDoubleClick={() => onStartListRename(list.listId, list.name)}
                        className={cn(
                          "workspace-tree-row grid min-h-[42px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 text-left text-[0.92rem]",
                          isSelected
                            ? "workspace-tree-row-active"
                            : "text-slate-700"
                        )}>
                        <span className="truncate">{list.name}</span>
                        <span className="font-mono text-[12px]">{list.count}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`${copy.deleteLabel} ${list.name}`}
                      onClick={() => void workspace.handleDeleteList(list.listId)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[0.8rem] text-slate-500 opacity-70 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/55 hover:text-slate-900 hover:opacity-100 active:translate-y-[1px]">
                      <AppIcon name="trash" size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section data-testid="sidebar-footer-section" className="border-t border-white/45 px-4 py-4 md:px-5">
        <div className="px-1 md:px-0">
          <button
            type="button"
            data-testid="toggle-preferences-panel"
            onClick={() => setShowPreferencesPanel((current) => !current)}
            className="flex w-full items-start justify-between gap-3 text-left">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{copy.preferencesTitle}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-white/55 bg-white/16 px-2.5 py-1">
                  {copy.languageLabel} {getLocaleSummaryLabel(locale)}
                </span>
                <span className="rounded-full border border-white/55 bg-white/16 px-2.5 py-1">
                  {copy.themeLabel} {getThemeSummaryLabel(themePreference, locale)}
                </span>
              </div>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] border border-white/55 bg-white/16 text-slate-700">
              <AppIcon name={showPreferencesPanel ? "close" : "info"} size={14} />
            </span>
          </button>

          {showPreferencesPanel ? (
            <div className="mt-4 border-t border-white/45 pt-4">
              <PreferencesPanel
                locale={locale}
                themePreference={themePreference}
                setLocale={setLocale}
                setThemePreference={setThemePreference}
                copy={copy}
                compact
              />
            </div>
          ) : null}
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
  selectedBookmarkIdsCount,
  hasBulkSelection,
  hasActiveRefinements,
  hasAdvancedRefinements,
  showAdvancedFilters,
  setShowAdvancedFilters,
  query,
  setQuery,
  searchId,
  sortId,
  sortOrder,
  setSortOrder,
  timeId,
  timeRange,
  setTimeRange,
  onlyWithMedia,
  setOnlyWithMedia,
  onlyLongform,
  setOnlyLongform,
  selectedAuthorHandle,
  setSelectedAuthorHandle,
  authorId,
  authorOptions,
  selectedTagId,
  setSelectedTagId,
  tagId,
  tags,
  activeRefinementChips,
  clearRefinement,
  clearAllRefinements,
  onSelectVisible
}: {
  copy: OptionsCopy
  loadError: string | null
  currentScopeLabel: string
  visibleBookmarksCount: number
  selectedBookmarkIdsCount: number
  hasBulkSelection: boolean
  hasActiveRefinements: boolean
  hasAdvancedRefinements: boolean
  showAdvancedFilters: boolean
  setShowAdvancedFilters: React.Dispatch<React.SetStateAction<boolean>>
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  searchId: string
  sortId: string
  sortOrder: BookmarkSortOrder
  setSortOrder: React.Dispatch<React.SetStateAction<BookmarkSortOrder>>
  timeId: string
  timeRange: SavedTimeRange
  setTimeRange: React.Dispatch<React.SetStateAction<SavedTimeRange>>
  onlyWithMedia: boolean
  setOnlyWithMedia: React.Dispatch<React.SetStateAction<boolean>>
  onlyLongform: boolean
  setOnlyLongform: React.Dispatch<React.SetStateAction<boolean>>
  selectedAuthorHandle: string
  setSelectedAuthorHandle: React.Dispatch<React.SetStateAction<string>>
  authorId: string
  authorOptions: Array<{ value: string; label: string }>
  selectedTagId: string
  setSelectedTagId: React.Dispatch<React.SetStateAction<string>>
  tagId: string
  tags: TagRecord[]
  activeRefinementChips: Array<{ key: string; label: string }>
  clearRefinement: (key: string) => void
  clearAllRefinements: () => void
  onSelectVisible: () => void
}) {
  return (
    <div data-testid="library-header-section" className="border-b border-white/45 px-5 py-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="workspace-overline">{copy.libraryTitle}</div>
            <h2 className="workspace-title-lg mt-2 truncate text-slate-900">{currentScopeLabel}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="workspace-meta rounded-full border border-white/60 bg-white/26 px-3 py-1.5 backdrop-blur-xl">
              {visibleBookmarksCount} {copy.results}
            </span>
            {hasBulkSelection ? (
              <span className="workspace-meta rounded-full border border-white/60 bg-white/26 px-3 py-1.5 backdrop-blur-xl">
                {selectedBookmarkIdsCount} {copy.selected}
              </span>
            ) : null}
          </div>
        </div>

        <InlineMessage message={loadError} className="mb-1" />

        <div data-testid="workspace-toolbar" className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_220px_220px]">
          <div className="relative min-w-0">
            <AppIcon name="search" size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <TextInputField
              id={searchId}
              ariaLabel={copy.search}
              type="search"
              value={query}
              placeholder={copy.searchPlaceholder}
              onChange={setQuery}
              className="workspace-field pl-11 pr-4 placeholder:text-slate-500"
            />
          </div>

          <ToolbarSelectField
            shellTestId="toolbar-sort-shell"
            label={copy.sortBy}
            id={sortId}
            value={sortOrder}
            onChange={(value) => setSortOrder(value as BookmarkSortOrder)}
            options={[
              { value: "saved-desc", label: copy.newestSaved },
              { value: "saved-asc", label: copy.oldestSaved },
              { value: "created-desc", label: copy.newestPublished },
              { value: "likes-desc", label: copy.mostLiked }
            ]}
          />

          <ToolbarSelectField
            shellTestId="toolbar-time-shell"
            label={copy.savedTime}
            id={timeId}
            value={timeRange}
            onChange={(value) => setTimeRange(value as SavedTimeRange)}
            options={[
              { value: "all", label: copy.anyTime },
              { value: "7d", label: copy.last7Days },
              { value: "30d", label: copy.last30Days },
              { value: "90d", label: copy.last90Days }
            ]}
          />
        </div>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip
              checked={onlyWithMedia}
              label={copy.hasMedia}
              onChange={setOnlyWithMedia}
              className="workspace-chip !px-3.5 !py-2"
            />
            <ToggleChip
              checked={onlyLongform}
              label={copy.longform}
              onChange={setOnlyLongform}
              className="workspace-chip !px-3.5 !py-2"
            />
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className={cn("chip-button workspace-chip !px-3.5 !py-2", showAdvancedFilters && "chip-button-active")}>
              <span>{showAdvancedFilters ? copy.hideAdvancedFilters : copy.advancedFilters}</span>
              {hasAdvancedRefinements ? (
                <span className={cn("rounded-full px-2 py-0.5 text-xs", showAdvancedFilters ? "bg-white/20 text-white" : "bg-slate-900 text-white")}>
                  {Number(Boolean(selectedAuthorHandle)) + Number(Boolean(selectedTagId))}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onSelectVisible}
              disabled={visibleBookmarksCount === 0}
              className="chip-button workspace-chip !px-3.5 !py-2 disabled:cursor-not-allowed disabled:opacity-60">
              <span>{copy.selectVisible}</span>
            </button>
          </div>

          {showAdvancedFilters ? (
            <div className="panel-elevated grid gap-3 rounded-[1.5rem] p-4 md:grid-cols-2">
              <FieldBlock label={copy.author} htmlFor={authorId}>
                <SelectField
                  id={authorId}
                  value={selectedAuthorHandle}
                  onChange={setSelectedAuthorHandle}
                  options={[{ value: "", label: copy.allAuthors }, ...authorOptions]}
                  className="workspace-field"
                />
              </FieldBlock>
              <FieldBlock label={copy.tag} htmlFor={tagId}>
                <SelectField
                  id={tagId}
                  value={selectedTagId}
                  onChange={setSelectedTagId}
                  options={[{ value: "", label: copy.allTags }, ...tags.map((tag) => ({ value: tag.id, label: tag.name }))]}
                  className="workspace-field"
                />
              </FieldBlock>
            </div>
          ) : null}

          {hasActiveRefinements ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeRefinementChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearRefinement(chip.key)}
                  className="chip-button workspace-chip !px-3 !py-1.5 !text-xs">
                  <span>{chip.label}</span>
                  <AppIcon name="close" size={12} />
                </button>
              ))}

              <button
                type="button"
                onClick={clearAllRefinements}
                className="ml-auto inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/60 bg-white/30 px-4 text-sm font-medium text-slate-700 backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white/45 active:translate-y-[1px]">
                <span>{copy.clearAll}</span>
              </button>
            </div>
          ) : null}
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
  authorId,
  tagId,
  sortId,
  timeId,
  moveId,
  bulkTagIdField,
  query,
  setQuery,
  selectedAuthorHandle,
  setSelectedAuthorHandle,
  selectedTagId,
  setSelectedTagId,
  sortOrder,
  setSortOrder,
  timeRange,
  setTimeRange,
  onlyWithMedia,
  setOnlyWithMedia,
  onlyLongform,
  setOnlyLongform,
  selectedBookmarkId,
  setSelectedBookmarkId,
  selectedBookmarkIds,
  setSelectedBookmarkIds,
  bulkListId,
  setBulkListId,
  bulkTagId,
  setBulkTagId,
  showAdvancedFilters,
  setShowAdvancedFilters,
  visibleBookmarks,
  authorOptions,
  activeRefinementChips,
  hasActiveRefinements,
  hasAdvancedRefinements,
  hasBulkSelection,
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
  authorId: string
  tagId: string
  sortId: string
  timeId: string
  moveId: string
  bulkTagIdField: string
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  selectedAuthorHandle: string
  setSelectedAuthorHandle: React.Dispatch<React.SetStateAction<string>>
  selectedTagId: string
  setSelectedTagId: React.Dispatch<React.SetStateAction<string>>
  sortOrder: BookmarkSortOrder
  setSortOrder: React.Dispatch<React.SetStateAction<BookmarkSortOrder>>
  timeRange: SavedTimeRange
  setTimeRange: React.Dispatch<React.SetStateAction<SavedTimeRange>>
  onlyWithMedia: boolean
  setOnlyWithMedia: React.Dispatch<React.SetStateAction<boolean>>
  onlyLongform: boolean
  setOnlyLongform: React.Dispatch<React.SetStateAction<boolean>>
  selectedBookmarkId: string | undefined
  setSelectedBookmarkId: React.Dispatch<React.SetStateAction<string | undefined>>
  selectedBookmarkIds: string[]
  setSelectedBookmarkIds: React.Dispatch<React.SetStateAction<string[]>>
  bulkListId: string
  setBulkListId: React.Dispatch<React.SetStateAction<string>>
  bulkTagId: string
  setBulkTagId: React.Dispatch<React.SetStateAction<string>>
  showAdvancedFilters: boolean
  setShowAdvancedFilters: React.Dispatch<React.SetStateAction<boolean>>
  visibleBookmarks: BookmarkRecord[]
  authorOptions: Array<{ value: string; label: string }>
  activeRefinementChips: Array<{ key: string; label: string }>
  hasActiveRefinements: boolean
  hasAdvancedRefinements: boolean
  hasBulkSelection: boolean
  bookmarkListByBookmarkId: Map<string, string>
  tagNamesByBookmarkId: Map<string, string[]>
  listNamesById: Map<string, string>
  clearRefinement: (key: string) => void
  clearAllRefinements: () => void
}) {
  return (
    <section data-testid="library-workspace" className="panel-surface min-h-[420px] min-w-0 overflow-hidden rounded-[24px] p-0 xl:h-[calc(100dvh-3rem)]">
      <div className="flex h-full min-h-0 flex-col">
        <WorkspaceToolbar
          copy={copy}
          loadError={workspace.loadError}
          currentScopeLabel={currentScopeLabel}
          visibleBookmarksCount={visibleBookmarks.length}
          selectedBookmarkIdsCount={selectedBookmarkIds.length}
          hasBulkSelection={hasBulkSelection}
          hasActiveRefinements={hasActiveRefinements}
          hasAdvancedRefinements={hasAdvancedRefinements}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          query={query}
          setQuery={setQuery}
          searchId={searchId}
          sortId={sortId}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          timeId={timeId}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          onlyWithMedia={onlyWithMedia}
          setOnlyWithMedia={setOnlyWithMedia}
          onlyLongform={onlyLongform}
          setOnlyLongform={setOnlyLongform}
          selectedAuthorHandle={selectedAuthorHandle}
          setSelectedAuthorHandle={setSelectedAuthorHandle}
          authorId={authorId}
          authorOptions={authorOptions}
          selectedTagId={selectedTagId}
          setSelectedTagId={setSelectedTagId}
          tagId={tagId}
          tags={workspace.tags}
          activeRefinementChips={activeRefinementChips}
          clearRefinement={clearRefinement}
          clearAllRefinements={clearAllRefinements}
          onSelectVisible={() => setSelectedBookmarkIds(visibleBookmarks.map((bookmark) => bookmark.tweetId))}
        />

        {hasBulkSelection ? (
          <div className="border-b border-white/45 px-5 py-4 md:px-6">
            <div className="panel-elevated rounded-[1.5rem] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900">{selectedBookmarkIds.length} {copy.selectedCount}</div>
                <button
                  type="button"
                  onClick={() => setSelectedBookmarkIds([])}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/60 bg-white/30 px-4 text-sm font-medium text-slate-700 backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white/45 active:translate-y-[1px]">
                  <span>{copy.clearSelection}</span>
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                <FieldBlock label={copy.moveSelectedTo} htmlFor={moveId}>
                  <SelectField
                    id={moveId}
                    value={bulkListId}
                    onChange={setBulkListId}
                    options={[
                      { value: "", label: copy.chooseList },
                      { value: INBOX_LIST_ID, label: copy.noList },
                      ...getVisibleLists(workspace.lists).map((list) => ({ value: list.id, label: list.name }))
                    ]}
                    className="workspace-field"
                  />
                </FieldBlock>
                <button
                  type="button"
                  onClick={() =>
                    void workspace.handleMoveBookmarksToList(selectedBookmarkIds, bulkListId).then(() => {
                      setSelectedBookmarkIds([])
                      setBulkListId("")
                    })
                  }
                  disabled={workspace.isSavingLists || !bulkListId || !hasBulkSelection}
                  className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-slate-900/90 bg-slate-950 px-5 text-sm font-medium text-white shadow-[0_18px_44px_-26px_rgba(15,23,42,0.45)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-[1px] active:scale-[0.985] self-end disabled:cursor-not-allowed disabled:opacity-60">
                  <span>{copy.moveSelected}</span>
                </button>
                <FieldBlock label={copy.tagSelectedWith} htmlFor={bulkTagIdField}>
                  <SelectField
                    id={bulkTagIdField}
                    value={bulkTagId}
                    onChange={setBulkTagId}
                    options={[
                      { value: "", label: copy.chooseTag },
                      ...workspace.tags.map((tag) => ({ value: tag.id, label: tag.name }))
                    ]}
                    className="workspace-field"
                  />
                </FieldBlock>
                <button
                  type="button"
                  onClick={() =>
                    void workspace.handleBulkAttachTag(selectedBookmarkIds, bulkTagId).then(() => {
                      setSelectedBookmarkIds([])
                      setBulkTagId("")
                    })
                  }
                  disabled={workspace.isSavingTags || !bulkTagId || !hasBulkSelection}
                  className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-white/60 bg-white/30 px-5 text-sm font-medium text-slate-700 backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white/45 active:translate-y-[1px] self-end disabled:cursor-not-allowed disabled:opacity-60">
                  <span>{copy.applyTag}</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div data-testid="library-results-summary" className="workspace-summary-bar flex items-center justify-between gap-3 px-5 py-4 md:px-6">
          <span className="workspace-meta">{copy.showing} {visibleBookmarks.length} {copy.of} {workspace.bookmarks.length}</span>
          {selectedListId ? <span className="workspace-meta">{copy.scopedTo} {currentScopeLabel}</span> : null}
        </div>

        <div data-testid="library-results-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto px-5 pb-5 pr-6 md:px-6">
          {visibleBookmarks.length ? (
            <div data-testid="results-stack" className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-2">
              {visibleBookmarks.map((bookmark, index) => {
                const currentTagNames = tagNamesByBookmarkId.get(bookmark.tweetId) ?? []
                const currentListName = getDisplayListName(
                  getListIdByBookmarkId(bookmark.tweetId, bookmarkListByBookmarkId),
                  listNamesById,
                  copy
                )
                const isSelected = selectedBookmarkId === bookmark.tweetId
                const isChecked = selectedBookmarkIds.includes(bookmark.tweetId)

                return (
                  <BookmarkCard
                    key={bookmark.tweetId}
                    bookmark={bookmark}
                    index={index}
                    currentListName={currentListName}
                    currentTagNames={currentTagNames}
                    selected={isSelected}
                    checked={isChecked}
                    locale={locale}
                    copy={copy}
                    onSelect={() => setSelectedBookmarkId(bookmark.tweetId)}
                    onToggle={() =>
                      setSelectedBookmarkIds((current) =>
                        current.includes(bookmark.tweetId)
                          ? current.filter((bookmarkId) => bookmarkId !== bookmark.tweetId)
                          : [...current, bookmark.tweetId]
                      )
                    }
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

function SidebarLoading({ copy }: { copy: OptionsCopy }) {
  return (
    <SurfaceCard title={copy.pageTitle} className="min-h-[420px] xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)]">
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-2xl bg-white/55" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="h-28 animate-pulse rounded-[1.6rem] bg-white/55" />
          <div className="h-28 animate-pulse rounded-[1.6rem] bg-white/55" />
        </div>
        <div className="space-y-2">
          <div className="h-11 animate-pulse rounded-2xl bg-white/55" />
          <div className="h-11 animate-pulse rounded-2xl bg-white/55" />
          <div className="h-11 animate-pulse rounded-2xl bg-white/55" />
        </div>
        <div className="h-28 animate-pulse rounded-[1.6rem] bg-white/55" />
      </div>
    </SurfaceCard>
  )
}

function OptionsScreen() {
  const workspace = useWorkspaceData()
  const { locale, themePreference, setLocale, setThemePreference } = useExtensionUi()
  const copy = getOptionsCopy(locale)
  const [selectedListId, setSelectedListId] = useState("")
  const [query, setQuery] = useState("")
  const [selectedAuthorHandle, setSelectedAuthorHandle] = useState("")
  const [selectedTagId, setSelectedTagId] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [timeRange, setTimeRange] = useState<SavedTimeRange>("all")
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([])
  const [bulkListId, setBulkListId] = useState("")
  const [bulkTagId, setBulkTagId] = useState("")
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListName, setEditingListName] = useState("")
  const [pendingCreatedListId, setPendingCreatedListId] = useState<string | null>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showPreferencesPanel, setShowPreferencesPanel] = useState(false)

  const bookmarkListByBookmarkId = useMemo(
    () => new Map(workspace.bookmarkLists.map((bookmarkList) => [bookmarkList.bookmarkId, bookmarkList.listId])),
    [workspace.bookmarkLists]
  )
  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const listNamesById = useMemo(() => new Map(workspace.lists.map((list) => [list.id, list.name])), [workspace.lists])
  const visibleLists = useMemo(() => getVisibleLists(workspace.lists), [workspace.lists])
  const visibleBookmarks = useMemo(
    () =>
      applyBookmarkFilters(workspace.bookmarks, {
        query,
        bookmarkLists: workspace.bookmarkLists,
        selectedListId: selectedListId || undefined,
        bookmarkTags: workspace.bookmarkTags,
        selectedAuthorHandles: selectedAuthorHandle ? [selectedAuthorHandle] : [],
        authorMatchMode: "any",
        selectedTagIds: selectedTagId ? [selectedTagId] : [],
        tagMatchMode: "all",
        timeRange,
        onlyWithMedia,
        onlyLongform,
        sortOrder
      }),
    [
      onlyLongform,
      onlyWithMedia,
      query,
      selectedAuthorHandle,
      selectedListId,
      selectedTagId,
      sortOrder,
      timeRange,
      workspace.bookmarkLists,
      workspace.bookmarkTags,
      workspace.bookmarks
    ]
  )

  useEffect(() => {
    const visibleBookmarkIds = new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId))
    setSelectedBookmarkIds((current) => current.filter((bookmarkId) => visibleBookmarkIds.has(bookmarkId)))

    if (!visibleBookmarks.length) {
      setSelectedBookmarkId(undefined)
      return
    }

    if (!selectedBookmarkId || !visibleBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(visibleBookmarks[0].tweetId)
    }
  }, [selectedBookmarkId, visibleBookmarks])

  useEffect(() => {
    if (selectedListId && !workspace.lists.some((list) => list.id === selectedListId)) {
      setSelectedListId("")
    }
  }, [selectedListId, workspace.lists])

  const selectedBookmark =
    visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ??
    workspace.bookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ??
    null

  const authorOptions = useMemo(() => {
    const values = new Map<string, string>()

    for (const bookmark of workspace.bookmarks) {
      values.set(bookmark.authorHandle, `${bookmark.authorName} (@${bookmark.authorHandle})`)
    }

    return [...values.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([value, label]) => ({ value, label }))
  }, [workspace.bookmarks])

  const tagNamesByBookmarkId = useMemo(() => {
    const map = new Map<string, string[]>()

    for (const bookmark of workspace.bookmarks) {
      const tags = getTagNamesForBookmark(bookmark.tweetId, workspace.bookmarkTags, tagsById).map((tag) => tag.name)
      map.set(bookmark.tweetId, tags)
    }

    return map
  }, [tagsById, workspace.bookmarkTags, workspace.bookmarks])

  const searchId = createFieldId("filters", "search")
  const authorId = createFieldId("filters", "author")
  const tagId = createFieldId("filters", "tag")
  const sortId = createFieldId("filters", "sort")
  const timeId = createFieldId("filters", "time")
  const moveId = createFieldId("actions", "move")
  const bulkTagIdField = createFieldId("actions", "tag")
  const hasBulkSelection = selectedBookmarkIds.length > 0
  const lastSyncLabel = formatTimestamp(workspace.summary.lastSyncedAt, locale)
  const hasAdvancedRefinements = Boolean(selectedAuthorHandle) || Boolean(selectedTagId)
  const hasActiveRefinements =
    Boolean(query.trim()) ||
    Boolean(selectedAuthorHandle) ||
    Boolean(selectedTagId) ||
    timeRange !== "all" ||
    onlyWithMedia ||
    onlyLongform
  const currentScopeLabel = selectedListId ? getDisplayListName(selectedListId, listNamesById, copy) : copy.allBookmarks
  const activeRefinementChips = [
    query.trim() ? { key: "query", label: `${copy.searchPrefix}: ${truncateText(query.trim(), 24)}` } : null,
    selectedAuthorHandle
      ? {
          key: "author",
          label: `${copy.authorPrefix}: ${authorOptions.find((option) => option.value === selectedAuthorHandle)?.label ?? selectedAuthorHandle}`
        }
      : null,
    selectedTagId
      ? {
          key: "tag",
          label: `${copy.tagPrefix}: ${workspace.tags.find((tag) => tag.id === selectedTagId)?.name ?? selectedTagId}`
        }
      : null,
    timeRange !== "all"
      ? {
          key: "time",
          label:
            timeRange === "7d"
              ? copy.last7Days
              : timeRange === "30d"
                ? copy.last30Days
                : copy.last90Days
        }
      : null,
    onlyWithMedia ? { key: "media", label: copy.hasMedia } : null,
    onlyLongform ? { key: "longform", label: copy.longform } : null
  ].filter(Boolean) as Array<{ key: string; label: string }>

  function clearRefinement(key: string) {
    if (key === "query") {
      setQuery("")
      return
    }

    if (key === "author") {
      setSelectedAuthorHandle("")
      return
    }

    if (key === "tag") {
      setSelectedTagId("")
      return
    }

    if (key === "time") {
      setTimeRange("all")
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
    setSelectedAuthorHandle("")
    setSelectedTagId("")
    setTimeRange("all")
    setOnlyWithMedia(false)
    setOnlyLongform(false)
  }

  useEffect(() => {
    if (hasAdvancedRefinements) {
      setShowAdvancedFilters(true)
    }
  }, [hasAdvancedRefinements])

  useEffect(() => {
    if (!editingListId) {
      return
    }

    const editingList = workspace.lists.find((list) => list.id === editingListId)
    if (!editingList) {
      setEditingListId(null)
      setEditingListName("")
    }
  }, [editingListId, workspace.lists])

  function handleStartListRename(listId: string, name: string) {
    setEditingListId(listId)
    setEditingListName(name)
  }

  async function handleCreateListInline() {
    const defaultListName = getNextAvailableListName(copy.newList, workspace.lists)
    const list = await workspace.handleCreateList(defaultListName)
    if (!list) {
      return
    }

    setEditingListId(list.id)
    setEditingListName(list.name)
    setPendingCreatedListId(list.id)
  }

  async function handleCommitListRename(nextNameOverride?: string) {
    if (!editingListId) {
      return
    }

    const nextName = (nextNameOverride ?? editingListName).trim() || copy.newList
    const listId = editingListId

    try {
      await workspace.handleRenameList(listId, nextName)
      if (pendingCreatedListId === listId) {
        setSelectedListId(listId)
      }
      setEditingListId(null)
      setEditingListName("")
      setPendingCreatedListId(null)
    } catch {
      // Keep the input active so the user can correct the name.
    }
  }

  function handleCancelListRename() {
    setEditingListId(null)
    setEditingListName("")
    setPendingCreatedListId(null)
  }

  return (
    <>
      <BackgroundScene />
      <main className="min-h-[100dvh] px-4 py-6 md:px-8 lg:px-10">
        <div data-testid="workspace-shell" className="mx-auto max-w-[1400px]">
          <div
            data-testid="workspace-overview"
            className="grid gap-6 xl:min-h-0 xl:h-[calc(100dvh-3rem)] xl:grid-cols-[232px_minmax(0,1fr)_340px] xl:items-start 2xl:grid-cols-[248px_minmax(0,1fr)_360px]">
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
                setLocale={setLocale}
                setThemePreference={setThemePreference}
                copy={copy}
                lastSyncLabel={lastSyncLabel}
                selectedListId={selectedListId}
                setSelectedListId={setSelectedListId}
                editingListId={editingListId}
                editingListName={editingListName}
                setEditingListName={setEditingListName}
                onCreateList={handleCreateListInline}
                onStartListRename={handleStartListRename}
                onCommitListRename={handleCommitListRename}
                onCancelListRename={handleCancelListRename}
                showPreferencesPanel={showPreferencesPanel}
                setShowPreferencesPanel={setShowPreferencesPanel}
              />

              <BookmarkResultsPane
                workspace={workspace}
                locale={locale}
                copy={copy}
                selectedListId={selectedListId}
                currentScopeLabel={currentScopeLabel}
                searchId={searchId}
                authorId={authorId}
                tagId={tagId}
                sortId={sortId}
                timeId={timeId}
                moveId={moveId}
                bulkTagIdField={bulkTagIdField}
                query={query}
                setQuery={setQuery}
                selectedAuthorHandle={selectedAuthorHandle}
                setSelectedAuthorHandle={setSelectedAuthorHandle}
                selectedTagId={selectedTagId}
                setSelectedTagId={setSelectedTagId}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                onlyWithMedia={onlyWithMedia}
                setOnlyWithMedia={setOnlyWithMedia}
                onlyLongform={onlyLongform}
                setOnlyLongform={setOnlyLongform}
                selectedBookmarkId={selectedBookmarkId}
                setSelectedBookmarkId={setSelectedBookmarkId}
                selectedBookmarkIds={selectedBookmarkIds}
                setSelectedBookmarkIds={setSelectedBookmarkIds}
                bulkListId={bulkListId}
                setBulkListId={setBulkListId}
                bulkTagId={bulkTagId}
                setBulkTagId={setBulkTagId}
                showAdvancedFilters={showAdvancedFilters}
                setShowAdvancedFilters={setShowAdvancedFilters}
                visibleBookmarks={visibleBookmarks}
                authorOptions={authorOptions}
                activeRefinementChips={activeRefinementChips}
                hasActiveRefinements={hasActiveRefinements}
                hasAdvancedRefinements={hasAdvancedRefinements}
                hasBulkSelection={hasBulkSelection}
                bookmarkListByBookmarkId={bookmarkListByBookmarkId}
                tagNamesByBookmarkId={tagNamesByBookmarkId}
                listNamesById={listNamesById}
                clearRefinement={clearRefinement}
                clearAllRefinements={clearAllRefinements}
              />

              <section data-testid="workspace-inspector">
                <BookmarkInspector
                  bookmark={selectedBookmark}
                  lists={visibleLists}
                  tags={workspace.tags}
                  bookmarkTags={workspace.bookmarkTags}
                  currentListId={selectedBookmark ? getListIdByBookmarkId(selectedBookmark.tweetId, bookmarkListByBookmarkId) : INBOX_LIST_ID}
                  isSavingTags={workspace.isSavingTags}
                  locale={locale}
                  copy={copy}
                  onMoveToList={async (listId) => {
                    if (!selectedBookmark) {
                      return
                    }

                    await workspace.handleMoveBookmarkToList(selectedBookmark.tweetId, listId)
                  }}
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
                  onCreateTag={async (name) => {
                    const tag = await workspace.handleCreateTag(name)
                    if (selectedBookmark && tag) {
                      await workspace.handleAttachTag(selectedBookmark.tweetId, tag.id)
                    }
                  }}
                  onDeleteTag={async (tagId) => {
                    await workspace.handleDeleteTag(tagId)
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
