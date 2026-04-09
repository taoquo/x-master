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

function getVisibleLists(lists: ListRecord[]) {
  return lists.filter((list) => list.id !== INBOX_LIST_ID)
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
      <SelectField
        id={id}
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options}
        className="options-toolbar-field px-4 pr-10"
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
        "options-result-card group relative flex min-h-[220px] flex-col overflow-hidden p-4",
        selected && "options-result-card-selected"
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
          className="h-4 w-4 rounded border-[var(--border-subtle)] bg-white"
        />
      </div>

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
      chrome="bare"
      className="options-inspector-shell xl:h-[100dvh]">
      <div
        ref={inspectorScrollRef}
        data-testid="inspector-section-stack"
        className="scroll-shell flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto">
        <section data-testid="inspector-meta-section" className="options-inspector-header">
          <div className="options-overline">{getSectionOverline(locale, "元数据", "Metadata")}</div>
          <h2 className="options-display-title-xs mt-3">{copy.detailsTitle}</h2>
          <p className="options-body-copy mt-3">
            {locale === "zh-CN" ? "查看书签上下文并完成归档操作。" : "Review bookmark context and complete archival actions."}
          </p>
        </section>

        <section data-testid="inspector-tags-section" className="options-inspector-section">
          <div className="options-section-kicker">{getSectionOverline(locale, "标签", "Tags")}</div>
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

        <section data-testid="inspector-assignment-section" className="options-inspector-section">
          <div className="options-section-kicker">{getSectionOverline(locale, "归档", "Archival")}</div>
          <div className="mt-4 grid gap-4">
            <FieldBlock label={copy.bookmarkFocus} htmlFor={focusId}>
              <ReadonlyField id={focusId} value={truncateText(bookmark.text, 90)} className="options-readonly-field" />
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
                className="options-inspector-field"
              />
            </FieldBlock>

            <button
              type="button"
              className="options-secondary-button justify-center"
              onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
              <AppIcon name="external" size={14} />
              <span>{copy.openOnX}</span>
            </button>
          </div>
        </section>

        <section data-testid="inspector-create-tag-section" className="options-inspector-section">
          <div className="options-section-kicker">{getSectionOverline(locale, "创建标签", "Create")}</div>
          <div className="mt-4 grid gap-4">
            <FieldBlock
              label={copy.createTagLabel}
              htmlFor={createTagId}>
              <TextInputField
                id={createTagId}
                value={newTagName}
                placeholder="research"
                onChange={setNewTagName}
                className="options-inspector-field"
              />
            </FieldBlock>
            <p className="options-meta-copy">{locale === "zh-CN" ? "一步创建新标签并附加到当前书签。" : "Create one tag and attach it to the current bookmark."}</p>
            <button
              type="button"
              onClick={() =>
                void onCreateTag(newTagName).then(() => {
                  setNewTagName("")
                })
              }
              disabled={isSavingTags || !newTagName.trim()}
              className="primary-button options-primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="sparkle" size={16} />
              <span>{copy.create}</span>
            </button>
          </div>
        </section>

        <section className="options-inspector-section">
          <div className="options-section-kicker">{getSectionOverline(locale, "标签库", "Library")}</div>
          <div className="mt-4 grid gap-1">
            {!tags.length ? <span className="options-meta-copy">{copy.noTagsCreated}</span> : null}
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void onDeleteTag(tag.id)}
                className="options-library-row">
                <span>{tag.name}</span>
                <AppIcon name="trash" size={11} />
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
  copy,
  lastSyncLabel,
  activeTagId,
  onTagSelect,
  setLocale,
  setThemePreference
}: {
  workspace: ReturnType<typeof useWorkspaceData>
  locale: Locale
  themePreference: "system" | "light" | "dark"
  copy: OptionsCopy
  lastSyncLabel: string
  activeTagId: string
  onTagSelect: (tagId: string) => void
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
}) {
  const tagCountById = workspace.bookmarkTags.reduce((map, bookmarkTag) => {
    map.set(bookmarkTag.tagId, (map.get(bookmarkTag.tagId) ?? 0) + 1)
    return map
  }, new Map<string, number>())

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
          <div className="options-overline">{getSectionOverline(locale, "标签", "Tags")}</div>
        </div>

        <div data-testid="sidebar-lists-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <div data-testid="sidebar-list-tree" className="space-y-1">
            <button
              type="button"
              data-list-button="all"
              onClick={() => onTagSelect("all")}
              className={cn(
                "options-nav-row w-full text-left",
                activeTagId === "all" && "options-nav-row-active"
              )}>
              <span>{copy.allBookmarks}</span>
              <span className="options-nav-count">{workspace.stats.totalBookmarks}</span>
            </button>

            {workspace.tags.map((tag) => {
              const isSelected = activeTagId === tag.id
              return (
                <button
                  key={tag.id}
                  type="button"
                  data-list-button={tag.id}
                  onClick={() => onTagSelect(tag.id)}
                  className={cn(
                    "options-nav-row w-full text-left",
                    isSelected && "options-nav-row-active"
                  )}>
                  <span className="truncate">{tag.name}</span>
                  <span className="options-nav-count">{tagCountById.get(tag.id) ?? 0}</span>
                </button>
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
              中/EN
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
  locale,
  copy,
  loadError,
  currentScopeLabel,
  visibleBookmarksCount,
  hasActiveRefinements,
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
  activeRefinementChips,
  clearRefinement,
  clearAllRefinements
}: {
  locale: Locale
  copy: OptionsCopy
  loadError: string | null
  currentScopeLabel: string
  visibleBookmarksCount: number
  hasActiveRefinements: boolean
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
  activeRefinementChips: Array<{ key: string; label: string }>
  clearRefinement: (key: string) => void
  clearAllRefinements: () => void
}) {
  return (
    <div data-testid="library-header-section" className="options-main-header">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="options-overline">{copy.libraryTitle} Archive</div>
            <h2 className="options-display-title-sm mt-3 truncate">{currentScopeLabel}</h2>
            <p className="options-body-copy mt-4 max-w-[54ch]">
              {loadError
                ? ""
                : locale === "zh-CN"
                  ? "在当前范围内搜索、筛选并整理已保存内容。当前没有启用筛选时，可添加作者、标签、时间或内容条件。"
                  : "Search, filter, and organize saved content in the current scope. Add author, tag, date, or content filters when needed."}
            </p>
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
              className="options-chip"
            />
            <ToggleChip
              checked={onlyLongform}
              label={copy.longform}
              onChange={setOnlyLongform}
              className="options-chip"
            />
          </div>

          {hasActiveRefinements ? (
            <div className="flex flex-wrap items-center gap-2">
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
                className="options-clear-button ml-auto">
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
  sortId,
  timeId,
  query,
  setQuery,
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
  visibleBookmarks,
  activeRefinementChips,
  hasActiveRefinements,
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
  sortId: string
  timeId: string
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
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
  visibleBookmarks: BookmarkRecord[]
  activeRefinementChips: Array<{ key: string; label: string }>
  hasActiveRefinements: boolean
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
          locale={locale}
          copy={copy}
          loadError={workspace.loadError}
          currentScopeLabel={currentScopeLabel}
          visibleBookmarksCount={visibleBookmarks.length}
          hasActiveRefinements={hasActiveRefinements}
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
          activeRefinementChips={activeRefinementChips}
          clearRefinement={clearRefinement}
          clearAllRefinements={clearAllRefinements}
        />

        <div data-testid="library-results-summary" className="options-results-summary flex items-center justify-between gap-3 px-12 py-5">
          <span className="options-meta-copy">{copy.showing} {visibleBookmarks.length} {copy.of} {workspace.bookmarks.length}</span>
          {selectedListId ? <span className="options-meta-copy">{copy.scopedTo} {currentScopeLabel}</span> : null}
        </div>

        <div data-testid="library-results-scroll" className="scroll-shell min-h-0 flex-1 overflow-y-auto px-12 pb-12 pt-8">
          {visibleBookmarks.length ? (
            <div data-testid="results-stack" className="grid content-start gap-8 sm:grid-cols-2 2xl:grid-cols-2">
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
  const [activeTagId, setActiveTagId] = useState("all")
  const [query, setQuery] = useState("")
  const [selectedAuthorHandle, setSelectedAuthorHandle] = useState("")
  const [selectedTagId, setSelectedTagId] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [timeRange, setTimeRange] = useState<SavedTimeRange>("all")
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([])

  const bookmarkListByBookmarkId = useMemo(
    () => new Map(workspace.bookmarkLists.map((bookmarkList) => [bookmarkList.bookmarkId, bookmarkList.listId])),
    [workspace.bookmarkLists]
  )
  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const listNamesById = useMemo(() => new Map(workspace.lists.map((list) => [list.id, list.name])), [workspace.lists])
  const visibleLists = useMemo(() => getVisibleLists(workspace.lists), [workspace.lists])
  const visibleBookmarks = useMemo(
    () =>
      applyBookmarkFilters(activeTagId === "all"
        ? workspace.bookmarks
        : workspace.bookmarks.filter((bookmark) =>
            workspace.bookmarkTags.some((bookmarkTag) => bookmarkTag.bookmarkId === bookmark.tweetId && bookmarkTag.tagId === activeTagId)
          ), {
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
      activeTagId,
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

  useEffect(() => {
    if (activeTagId !== "all" && !workspace.tags.some((tag) => tag.id === activeTagId)) {
      setActiveTagId("all")
    }
  }, [activeTagId, workspace.tags])

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
  const sortId = createFieldId("filters", "sort")
  const timeId = createFieldId("filters", "time")
  const lastSyncLabel = formatTimestamp(workspace.summary.lastSyncedAt, locale)
  const hasActiveRefinements =
    Boolean(query.trim()) ||
    Boolean(selectedAuthorHandle) ||
    Boolean(selectedTagId) ||
    timeRange !== "all" ||
    onlyWithMedia ||
    onlyLongform
  const currentScopeLabel = selectedListId
    ? getDisplayListName(selectedListId, listNamesById, copy)
    : activeTagId === "all"
      ? copy.allBookmarks
      : workspace.tags.find((tag) => tag.id === activeTagId)?.name ?? copy.allBookmarks
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
                activeTagId={activeTagId}
                onTagSelect={setActiveTagId}
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
                sortId={sortId}
                timeId={timeId}
                query={query}
                setQuery={setQuery}
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
                visibleBookmarks={visibleBookmarks}
                activeRefinementChips={activeRefinementChips}
                hasActiveRefinements={hasActiveRefinements}
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
