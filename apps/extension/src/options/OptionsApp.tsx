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
      pageDescription: "在列表、标签和最近同步之间搜索、排序并整理已保存内容。",
      lastSync: "上次同步",
      syncNow: "立即同步",
      syncing: "同步中...",
      totalBookmarks: "总书签数",
      totalBookmarksHint: "当前本地库存。",
      unclassified: "未分类",
      unclassifiedHint: "仍在等待标签覆盖。",
      preferencesTitle: "偏好设置",
      preferencesDescription: "调整整个扩展的语言和主题外观。",
      languageLabel: "语言",
      themeLabel: "主题",
      listsTitle: "列表",
      allBookmarks: "全部书签",
      newList: "新建列表",
      newListDescription: "仅支持平铺分组，暂不提供嵌套文件夹。",
      createList: "创建列表",
      libraryTitle: "资料库",
      libraryDescription: "在一个工作面板里搜索、筛选并整理已保存内容。",
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
      noActiveFilters: "当前没有启用筛选，可添加作者、标签、时间或内容条件。",
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
      noBookmarksDescription: "调整搜索或筛选条件，或者再次同步以补充资料库。",
      detailsTitle: "详情",
      detailsDescription: "查看书签上下文并完成归档操作。",
      noBookmarkSelectedTitle: "尚未选择书签",
      noBookmarkSelectedDescription: "从中间的卡片列表中选择一条书签，查看详情、列表归属和标签。",
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
      createTagDescription: "一步创建新标签并附加到当前书签。",
      create: "创建",
      tagLibrary: "标签库",
      noTagsCreated: "还没有创建任何标签。",
      results: "结果",
      selected: "已选择",
      inbox: "收件箱",
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
    pageDescription: "Search, sort, and file saved posts across lists, tags, and recent syncs.",
    lastSync: "Last sync",
    syncNow: "Sync now",
    syncing: "Syncing...",
    totalBookmarks: "Total bookmarks",
    totalBookmarksHint: "Current local inventory.",
    unclassified: "Unclassified",
    unclassifiedHint: "Still waiting for tag coverage.",
    preferencesTitle: "Preferences",
    preferencesDescription: "Control language and appearance across the extension.",
    languageLabel: "Language",
    themeLabel: "Theme",
    listsTitle: "Lists",
    allBookmarks: "All bookmarks",
    newList: "New list",
    newListDescription: "Flat groups only. Nested folders are intentionally removed.",
    createList: "Create list",
    libraryTitle: "Library",
    libraryDescription: "Search, refine, and sort saved posts from one control surface.",
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
    noActiveFilters: "No active filters. Add author, tag, time, or content filters.",
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
    noBookmarksDescription: "Adjust search, change filter chips, or run another sync to refill the library.",
    detailsTitle: "Details",
    detailsDescription: "Refined bookmark context and filing controls.",
    noBookmarkSelectedTitle: "No bookmark selected",
    noBookmarkSelectedDescription: "Choose a bookmark card from the gallery to inspect its details, list assignment, and tags.",
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
    createTagDescription: "Create a new tag and attach it to this bookmark in one move.",
    create: "Create",
    tagLibrary: "Tag library",
    noTagsCreated: "No tags created yet.",
    results: "results",
    selected: "selected",
    inbox: "Inbox",
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

function createFieldId(scope: string, name: string) {
  return `${scope}-${name}`
}

function BackgroundScene() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(234,214,160,0.42),transparent_70%)] blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(170,226,222,0.34),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-10 left-1/4 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(193,224,161,0.28),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(171,204,245,0.28),transparent_70%)] blur-3xl" />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.12))]" />
    </>
  )
}

function LoadingPanel({ title, description }: { title: string; description: string }) {
  return (
    <SurfaceCard title={title} description={description}>
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white/55" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/55" />
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/55" />
      </div>
    </SurfaceCard>
  )
}

function PreferencesPanel({
  locale,
  themePreference,
  setLocale,
  setThemePreference,
  copy
}: {
  locale: Locale
  themePreference: "system" | "light" | "dark"
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (themePreference: "system" | "light" | "dark") => Promise<void>
  copy: OptionsCopy
}) {
  const localeFieldId = createFieldId("preferences-tip", "locale")
  const themeFieldId = createFieldId("preferences-tip", "theme")

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/55 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <AppIcon name="info" size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{copy.preferencesTitle}</div>
          <p className="mt-2 max-w-[30ch] text-sm leading-6 text-slate-600">{copy.preferencesDescription}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBlock label={copy.languageLabel} htmlFor={localeFieldId}>
          <SelectField
            id={localeFieldId}
            value={locale}
            onChange={(value) => void setLocale(value as Locale)}
            options={localeOptions.map((option) => ({ value: option.value, label: option.label[locale] }))}
          />
        </FieldBlock>

        <FieldBlock label={copy.themeLabel} htmlFor={themeFieldId}>
          <SelectField
            id={themeFieldId}
            value={themePreference}
            onChange={(value) => void setThemePreference(value as typeof themePreference)}
            options={themeOptions.map((option) => ({ value: option.value, label: option.label[locale] }))}
          />
        </FieldBlock>
      </div>
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
      <label htmlFor={htmlFor} className={cn("block text-sm font-medium text-slate-800", labelClassName)}>
        {label}
      </label>
      {children}
      {description ? <p className="text-xs leading-5 text-slate-600/80">{description}</p> : null}
    </div>
  )
}

function SelectField({
  id,
  value,
  onChange,
  options,
  className,
  dataTestId
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
  dataTestId?: string
}) {
  return (
    <select
      id={id}
      data-testid={dataTestId}
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
  className
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={cn("field-shell w-full", className)}
    />
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
    "from-slate-200 via-emerald-100 to-slate-100",
    "from-slate-900 via-slate-800 to-black",
    "from-slate-100 via-sky-100 to-cyan-50",
    "from-[#6a7ca3] via-[#8fb3f4] to-[#dfeafe]",
    "from-[#6b5d89] via-[#9aa7dd] to-[#edf3ff]"
  ]
  const palette = palettes[index % palettes.length]
  const mediaUrl = bookmark.media?.[0]?.url

  return (
    <div
      className={cn(
        "relative h-44 overflow-hidden rounded-[1.6rem] border border-white/70 bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:h-40 lg:h-44 2xl:h-48",
        palette
      )}>
      {mediaUrl ? (
        <img
          src={mediaUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.16))]" />
      {mediaUrl ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/32 text-white shadow-soft backdrop-blur-xl">
            <AppIcon name="play" size={28} />
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-4 bottom-4">
          <div className="max-w-[18ch] text-[1.05rem] font-medium leading-6 tracking-[-0.02em] text-slate-900/78">
            {truncateText(bookmark.text, 58)}
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
        "glass-panel group relative flex min-h-[290px] flex-col overflow-hidden rounded-[2rem] p-3.5 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-soft sm:min-h-[276px] 2xl:min-h-[304px]",
        selected && "ring-2 ring-sky-300/80",
        index < 6 && "animate-float-card"
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
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-slate-950 text-sm font-medium text-white shadow-soft">
          {bookmark.authorName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[0.95rem] font-medium text-slate-900">{bookmark.authorName}</div>
              <div className="truncate text-sm text-slate-600">@{bookmark.authorHandle}</div>
            </div>
            <div className="shrink-0 rounded-full bg-white/65 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-600">
              {formatTimestamp(bookmark.savedAt, locale)}
            </div>
          </div>
          <p className="mt-2 text-[0.95rem] leading-6 text-slate-900/92">{truncateText(bookmark.text, 108)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip-button !cursor-default !px-3 !py-1.5">{currentListName}</span>
            {bookmark.media?.length ? <span className="chip-button !cursor-default !px-3 !py-1.5">{copy.hasMedia}</span> : null}
            {currentTagNames.slice(0, 2).map((tagName) => (
              <span key={tagName} className="chip-button !cursor-default !px-3 !py-1.5">
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
      description={copy.detailsDescription}
      className="bg-white/42 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]">
      <div ref={inspectorScrollRef} className="scroll-shell flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-slate-950 text-white shadow-soft">
            {bookmark.authorName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xl font-medium tracking-[-0.03em] text-slate-900">{bookmark.authorName}</div>
            <div className="text-sm text-slate-600">@{bookmark.authorHandle}</div>
          </div>
        </div>

        <p className="mt-5 text-[1.05rem] leading-7 text-slate-900/86">{truncateText(bookmark.text, 180)}</p>

        <div className="mt-4 text-sm text-slate-600">
          {formatTimestamp(bookmark.createdAtOnX, locale)}
        </div>

        <button type="button" className="glass-button mt-6 justify-center" onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
          <AppIcon name="external" size={16} />
          <span>{copy.openOnX}</span>
        </button>

        <div className="mt-7 border-t border-slate-200/60 pt-6">
          <h3 className="font-medium text-slate-900">{copy.tagsTitle}</h3>
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
              />
            </FieldBlock>
            <button
              type="button"
              onClick={() => void onAttachTag(selectedTagId)}
              disabled={isSavingTags || !selectedTagId}
              className="glass-button justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="tag" size={16} />
              <span>{copy.addTag}</span>
            </button>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200/60 pt-6">
          <h3 className="font-medium text-slate-900">{copy.assignmentTitle}</h3>
          <div className="mt-4 grid gap-4">
            <FieldBlock label={copy.bookmarkFocus} htmlFor={focusId}>
              <TextInputField
                id={focusId}
                value={truncateText(bookmark.text, 90)}
                onChange={() => {}}
                className="cursor-default"
              />
            </FieldBlock>

            <FieldBlock label={copy.primaryList} htmlFor={listSelectId}>
              <SelectField
                id={listSelectId}
                value={currentListId}
                onChange={(value) => void onMoveToList(value)}
                options={lists.map((list) => ({ value: list.id, label: list.name }))}
              />
            </FieldBlock>

            <FieldBlock
              label={copy.createTagLabel}
              htmlFor={createTagId}
              description={copy.createTagDescription}>
              <TextInputField
                id={createTagId}
                value={newTagName}
                placeholder="research"
                onChange={setNewTagName}
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
              className="primary-button justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <AppIcon name="sparkle" size={16} />
              <span>{copy.create}</span>
            </button>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200/60 pt-6">
          <h3 className="font-medium text-slate-900">{copy.tagLibrary}</h3>
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
        </div>
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
  const [newListName, setNewListName] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const bookmarkListByBookmarkId = useMemo(
    () => new Map(workspace.bookmarkLists.map((bookmarkList) => [bookmarkList.bookmarkId, bookmarkList.listId])),
    [workspace.bookmarkLists]
  )
  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const listNamesById = useMemo(() => new Map(workspace.lists.map((list) => [list.id, list.name])), [workspace.lists])
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
  const newListId = createFieldId("lists", "new")
  const hasBulkSelection = selectedBookmarkIds.length > 0
  const lastSyncLabel = formatTimestamp(workspace.summary.lastSyncedAt, locale)
  const hasAdvancedRefinements = Boolean(selectedAuthorHandle) || Boolean(selectedTagId)
  const hasActiveRefinements =
    Boolean(selectedListId) ||
    Boolean(query.trim()) ||
    Boolean(selectedAuthorHandle) ||
    Boolean(selectedTagId) ||
    timeRange !== "all" ||
    onlyWithMedia ||
    onlyLongform
  const activeRefinementChips = [
    selectedListId ? { key: "list", label: `${copy.listPrefix}: ${listNamesById.get(selectedListId) ?? copy.inbox}` } : null,
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
    if (key === "list") {
      setSelectedListId("")
      return
    }

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
    setSelectedListId("")
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

  return (
    <>
      <BackgroundScene />
      <main className="min-h-[100dvh] px-4 py-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px] xl:items-stretch">
            <section className="glass-panel relative overflow-hidden p-6 md:p-8 lg:min-h-[300px] lg:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.56),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.14),transparent_62%)]" />
              <div className="relative flex h-full flex-col justify-between gap-8">
                <div className="min-w-0">
                  <div className="inline-flex items-center rounded-full border border-white/65 bg-white/35 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-600 backdrop-blur-xl">
                    {copy.workspaceBadge}
                  </div>
                  <h1 className="mt-5 max-w-[8ch] text-[clamp(3.2rem,6vw,5.4rem)] font-sans font-semibold leading-[0.9] tracking-[-0.08em] text-slate-950">
                    {copy.pageTitle}
                  </h1>
                  <p className="mt-4 max-w-[34ch] text-base leading-7 text-slate-700/82 md:text-lg">
                    {copy.pageDescription}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-white/45 pt-5">
                  <StatusBadge status={workspace.summary.status} />
                  <div className="rounded-full border border-white/65 bg-white/35 px-4 py-2 text-sm text-slate-600 backdrop-blur-xl">
                    {copy.lastSync} {lastSyncLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => void workspace.handleSync()}
                    disabled={workspace.isSyncing}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-900/90 bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_44px_-26px_rgba(15,23,42,0.45)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60">
                    <AppIcon name="sync" size={16} />
                    <span>{workspace.isSyncing ? copy.syncing : copy.syncNow}</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="glass-panel overflow-hidden p-0">
              <div className="grid divide-y divide-white/40 md:grid-cols-2 md:divide-x md:divide-y-0">
                <div className="p-5 md:p-6">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{copy.totalBookmarks}</p>
                  <div className="mt-3 text-[3.4rem] leading-none tracking-[-0.08em] text-slate-800">{workspace.stats.totalBookmarks}</div>
                  <p className="mt-3 max-w-[16ch] text-sm leading-6 text-slate-600">{copy.totalBookmarksHint}</p>
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{copy.unclassified}</p>
                  <div className="mt-3 text-[3.4rem] leading-none tracking-[-0.08em] text-slate-800">{workspace.stats.unclassifiedCount}</div>
                  <p className="mt-3 max-w-[16ch] text-sm leading-6 text-slate-600">{copy.unclassifiedHint}</p>
                </div>
              </div>
              <div className="border-t border-white/45 p-5 md:p-6">
                <PreferencesPanel
                  locale={locale}
                  themePreference={themePreference}
                  setLocale={setLocale}
                  setThemePreference={setThemePreference}
                  copy={copy}
                />
              </div>
            </section>
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-[232px_minmax(0,1fr)_340px] xl:items-start 2xl:grid-cols-[248px_minmax(0,1fr)_360px]">
            {workspace.isLoading && !workspace.bookmarks.length ? (
              <>
                <LoadingPanel title={copy.listsTitle} description={copy.loadingStateDescription} />
                <LoadingPanel title={copy.pageTitle} description={copy.loadingStateDescription} />
                <LoadingPanel title={copy.detailsTitle} description={copy.loadingStateDescription} />
              </>
            ) : (
              <>
                <SurfaceCard
                  title={copy.listsTitle}
                  className="min-h-[420px] xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]"
                  bodyClassName="scroll-shell min-h-0 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    <button
                      type="button"
                      data-list-button="all"
                      onClick={() => setSelectedListId("")}
                      className={cn("flex w-full items-center justify-between rounded-full px-4 py-3 text-left transition duration-300",
                        selectedListId === "" ? "bg-slate-950 text-white shadow-soft" : "bg-white/45 text-slate-900 hover:bg-white/65"
                      )}>
                      <span>{copy.allBookmarks}</span>
                      <span className="font-mono">{workspace.stats.totalBookmarks}</span>
                    </button>
                    {workspace.stats.listCounts.map((list) => {
                      const isSelected = selectedListId === list.listId
                      return (
                        <div key={list.listId} className="flex items-center gap-2">
                          <button
                            type="button"
                            data-list-button={list.listId}
                            onClick={() => setSelectedListId(list.listId)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-full px-4 py-3 text-left transition duration-300",
                              isSelected ? "bg-slate-900 text-white shadow-soft" : "bg-white/45 text-slate-900 hover:bg-white/65"
                            )}>
                            <span>{list.name}</span>
                            <span className="font-mono">{list.count}</span>
                          </button>
                          {list.listId !== INBOX_LIST_ID ? (
                            <button
                              type="button"
                              aria-label={`${copy.deleteLabel} ${list.name}`}
                              onClick={() => void workspace.handleDeleteList(list.listId)}
                              className="chip-button">
                              <AppIcon name="trash" size={14} />
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-8 space-y-4">
                    <FieldBlock label={copy.newList} htmlFor={newListId} description={copy.newListDescription}>
                      <TextInputField id={newListId} value={newListName} placeholder="Research" onChange={setNewListName} />
                    </FieldBlock>
                    <button
                      type="button"
                      onClick={() =>
                        void workspace.handleCreateList(newListName).then(() => {
                          setNewListName("")
                        })
                      }
                      disabled={workspace.isSavingLists || !newListName.trim()}
                      className="glass-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
                      <AppIcon name="bookmark" size={16} />
                      <span>{copy.createList}</span>
                    </button>
                  </div>
                </SurfaceCard>

                <section className="min-h-[420px]">
                  <div className="glass-panel p-5 md:p-6">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 border-b border-white/45 pb-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-[1.35rem] font-medium tracking-[-0.03em] text-slate-900">{copy.libraryTitle}</h2>
                          <p className="mt-1 max-w-[34rem] text-sm leading-6 text-slate-600">{copy.libraryDescription}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span className="rounded-full border border-white/60 bg-white/30 px-3 py-1.5 backdrop-blur-xl">
                            {visibleBookmarks.length} {copy.results}
                          </span>
                          {hasBulkSelection ? (
                            <span className="rounded-full border border-white/60 bg-white/30 px-3 py-1.5 backdrop-blur-xl">
                              {selectedBookmarkIds.length} {copy.selected}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_220px_220px]">
                        <FieldBlock label={copy.search} htmlFor={searchId} labelClassName="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                          <div className="relative min-w-0">
                            <AppIcon name="search" size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <TextInputField
                              id={searchId}
                              type="search"
                              value={query}
                              placeholder={copy.searchPlaceholder}
                              onChange={setQuery}
                              className="min-h-[50px] rounded-[1.2rem] pl-11 pr-4"
                            />
                          </div>
                        </FieldBlock>
                        <FieldBlock label={copy.sortBy} htmlFor={sortId} labelClassName="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                          <SelectField
                            id={sortId}
                            value={sortOrder}
                            onChange={(value) => setSortOrder(value as BookmarkSortOrder)}
                            options={[
                              { value: "saved-desc", label: copy.newestSaved },
                              { value: "saved-asc", label: copy.oldestSaved },
                              { value: "created-desc", label: copy.newestPublished },
                              { value: "likes-desc", label: copy.mostLiked }
                            ]}
                            className="min-h-[50px] rounded-[1.2rem] py-2.5"
                          />
                        </FieldBlock>
                        <FieldBlock label={copy.savedTime} htmlFor={timeId} labelClassName="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                          <SelectField
                            id={timeId}
                            value={timeRange}
                            onChange={(value) => setTimeRange(value as SavedTimeRange)}
                            options={[
                              { value: "all", label: copy.anyTime },
                              { value: "7d", label: copy.last7Days },
                              { value: "30d", label: copy.last30Days },
                              { value: "90d", label: copy.last90Days }
                            ]}
                            className="min-h-[50px] rounded-[1.2rem] py-2.5"
                          />
                        </FieldBlock>
                      </div>

                      <div className="grid gap-4 border-t border-white/45 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <ToggleChip
                            checked={onlyWithMedia}
                            label={copy.hasMedia}
                            onChange={setOnlyWithMedia}
                            className="!px-3.5 !py-2 text-sm"
                          />
                          <ToggleChip
                            checked={onlyLongform}
                            label={copy.longform}
                            onChange={setOnlyLongform}
                            className="!px-3.5 !py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdvancedFilters((current) => !current)}
                            className={cn("chip-button !px-3.5 !py-2 text-sm", showAdvancedFilters && "chip-button-active")}>
                            <span>{showAdvancedFilters ? copy.hideAdvancedFilters : copy.advancedFilters}</span>
                            {hasAdvancedRefinements ? (
                              <span className={cn("rounded-full px-2 py-0.5 text-xs", showAdvancedFilters ? "bg-white/20 text-white" : "bg-slate-900 text-white")}>
                                {Number(Boolean(selectedAuthorHandle)) + Number(Boolean(selectedTagId))}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedBookmarkIds(visibleBookmarks.map((bookmark) => bookmark.tweetId))}
                            disabled={!visibleBookmarks.length}
                            className="chip-button !px-3.5 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                            <span>{copy.selectVisible}</span>
                          </button>
                        </div>

                        {showAdvancedFilters ? (
                          <div className="grid gap-3 rounded-[1.5rem] border border-white/50 bg-white/16 p-4 md:grid-cols-2">
                            <FieldBlock label={copy.author} htmlFor={authorId}>
                              <SelectField
                                id={authorId}
                                value={selectedAuthorHandle}
                                onChange={setSelectedAuthorHandle}
                                options={[{ value: "", label: copy.allAuthors }, ...authorOptions]}
                                className="min-h-[50px] rounded-[1.2rem] py-2.5"
                              />
                            </FieldBlock>
                            <FieldBlock label={copy.tag} htmlFor={tagId}>
                              <SelectField
                                id={tagId}
                                value={selectedTagId}
                                onChange={setSelectedTagId}
                                options={[{ value: "", label: copy.allTags }, ...workspace.tags.map((tag) => ({ value: tag.id, label: tag.name }))]}
                                className="min-h-[50px] rounded-[1.2rem] py-2.5"
                              />
                            </FieldBlock>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          {hasActiveRefinements ? (
                            activeRefinementChips.map((chip) => (
                              <button
                                key={chip.key}
                                type="button"
                                onClick={() => clearRefinement(chip.key)}
                                className="chip-button !px-3 !py-1.5 !text-xs">
                                <span>{chip.label}</span>
                                <AppIcon name="close" size={12} />
                              </button>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">{copy.noActiveFilters}</span>
                          )}

                          {hasActiveRefinements ? (
                            <button
                              type="button"
                              onClick={clearAllRefinements}
                              className="ml-auto inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/60 bg-white/30 px-4 text-sm font-medium text-slate-700 backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white/45 active:translate-y-[1px]">
                              <span>{copy.clearAll}</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {hasBulkSelection ? (
                    <div className="glass-panel mt-4 overflow-hidden p-0">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/45 px-4 py-3 md:px-5">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{selectedBookmarkIds.length} {copy.selectedCount}</div>
                          <p className="mt-0.5 text-sm text-slate-600">{locale === "zh-CN" ? "一次性应用列表和标签变更。" : "Apply list and tag changes in one pass."}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedBookmarkIds([])}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/60 bg-white/30 px-4 text-sm font-medium text-slate-700 backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white/45 active:translate-y-[1px]">
                          <span>{copy.clearSelection}</span>
                        </button>
                      </div>

                      <div className="grid gap-3 p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                        <FieldBlock label={copy.moveSelectedTo} htmlFor={moveId}>
                          <SelectField
                            id={moveId}
                            value={bulkListId}
                            onChange={setBulkListId}
                            options={[
                              { value: "", label: copy.chooseList },
                              ...workspace.lists.map((list) => ({ value: list.id, label: list.name }))
                            ]}
                            className="min-h-[50px] rounded-[1.2rem]"
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
                            className="min-h-[50px] rounded-[1.2rem]"
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
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-600">{copy.showing} {visibleBookmarks.length} {copy.of} {workspace.bookmarks.length}</span>
                      {selectedListId ? (
                        <span className="text-sm text-slate-500">{copy.scopedTo} {listNamesById.get(selectedListId) ?? copy.listsTitle}</span>
                      ) : null}
                    </div>
                  </div>

                  {visibleBookmarks.length ? (
                    <div className="scroll-shell mt-4 grid max-h-[780px] content-start gap-4 overflow-y-auto pb-1 pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                      {visibleBookmarks.map((bookmark, index) => {
                        const currentTagNames = tagNamesByBookmarkId.get(bookmark.tweetId) ?? []
                        const currentListName = listNamesById.get(getListIdByBookmarkId(bookmark.tweetId, bookmarkListByBookmarkId)) ?? copy.inbox
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
                    <div className="mt-4">
                      <EmptyState
                        title={copy.noBookmarksTitle}
                        description={copy.noBookmarksDescription}
                      />
                    </div>
                  )}
                </section>

                <BookmarkInspector
                  bookmark={selectedBookmark}
                  lists={workspace.lists}
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
