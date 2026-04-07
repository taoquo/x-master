import React, { useEffect, useMemo, useRef, useState } from "react"
import type {
  BookmarkRecord,
  BookmarkTagRecord,
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
import { ExtensionUiProvider } from "../ui/provider.tsx"
import { AppIcon } from "../ui/icons.tsx"

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "Not synced yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed)
}

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

function LoadingPanel({ title }: { title: string }) {
  return (
    <SurfaceCard title={title} description="Loading local state from the extension runtime.">
      <div className="space-y-4">
        <div className="h-12 animate-pulse rounded-2xl bg-white/55" />
        <div className="h-12 animate-pulse rounded-2xl bg-white/55" />
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/55" />
      </div>
    </SurfaceCard>
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
  onChange
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={cn("chip-button", checked && "chip-button-active")}>
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
  onSelect,
  onToggle
}: {
  bookmark: BookmarkRecord
  index: number
  currentListName: string
  currentTagNames: string[]
  selected: boolean
  checked: boolean
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
          aria-label={`Select ${bookmark.authorHandle}`}
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
              {formatTimestamp(bookmark.savedAt)}
            </div>
          </div>
          <p className="mt-2 text-[0.95rem] leading-6 text-slate-900/92">{truncateText(bookmark.text, 108)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip-button !cursor-default !px-3 !py-1.5">{currentListName}</span>
            {bookmark.media?.length ? <span className="chip-button !cursor-default !px-3 !py-1.5">Has media</span> : null}
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
        title="No bookmark selected"
        description="Choose a bookmark card from the gallery to inspect its details, list assignment, and tags."
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
      title="Details"
      description="Refined bookmark context and filing controls."
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
          {formatTimestamp(bookmark.createdAtOnX)}
        </div>

        <button type="button" className="glass-button mt-6 justify-center" onClick={() => window.open(bookmark.tweetUrl, "_blank", "noopener,noreferrer")}>
          <AppIcon name="external" size={16} />
          <span>Open on X</span>
        </button>

        <div className="mt-7 border-t border-slate-200/60 pt-6">
          <h3 className="font-medium text-slate-900">Tags</h3>
          <div data-testid="current-tags" className="mt-4 flex flex-wrap gap-2">
            {!currentTags.length ? <span className="text-sm text-slate-600">No tags yet.</span> : null}
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
            <FieldBlock label="Attach existing tag" htmlFor={attachSelectId}>
              <SelectField
                id={attachSelectId}
                dataTestId="attach-tag-select"
                value={selectedTagId}
                onChange={setSelectedTagId}
                options={[
                  { value: "", label: "Select a tag" },
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
              <span>Add tag</span>
            </button>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200/60 pt-6">
          <h3 className="font-medium text-slate-900">Assignment</h3>
          <div className="mt-4 grid gap-4">
            <FieldBlock label="Bookmark focus" htmlFor={focusId}>
              <TextInputField
                id={focusId}
                value={truncateText(bookmark.text, 90)}
                onChange={() => {}}
                className="cursor-default"
              />
            </FieldBlock>

            <FieldBlock label="Primary list" htmlFor={listSelectId}>
              <SelectField
                id={listSelectId}
                value={currentListId}
                onChange={(value) => void onMoveToList(value)}
                options={lists.map((list) => ({ value: list.id, label: list.name }))}
              />
            </FieldBlock>

            <FieldBlock
              label="Create tag"
              htmlFor={createTagId}
              description="Create a new tag and attach it to this bookmark in one move.">
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
              <span>Create</span>
            </button>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200/60 pt-6">
          <h3 className="font-medium text-slate-900">Tag library</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {!tags.length ? <span className="text-sm text-slate-600">No tags created yet.</span> : null}
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

export function OptionsApp() {
  const workspace = useWorkspaceData()
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
  const lastSyncLabel = workspace.summary.lastSyncedAt ? formatTimestamp(workspace.summary.lastSyncedAt) : "Not synced yet"
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
    selectedListId ? { key: "list", label: `List: ${listNamesById.get(selectedListId) ?? "Unknown"}` } : null,
    query.trim() ? { key: "query", label: `Search: ${truncateText(query.trim(), 24)}` } : null,
    selectedAuthorHandle ? { key: "author", label: `Author: ${authorOptions.find((option) => option.value === selectedAuthorHandle)?.label ?? selectedAuthorHandle}` } : null,
    selectedTagId ? { key: "tag", label: `Tag: ${workspace.tags.find((tag) => tag.id === selectedTagId)?.name ?? selectedTagId}` } : null,
    timeRange !== "all"
      ? {
          key: "time",
          label:
            timeRange === "7d"
              ? "Last 7 days"
              : timeRange === "30d"
                ? "Last 30 days"
                : "Last 90 days"
        }
      : null,
    onlyWithMedia ? { key: "media", label: "Has media" } : null,
    onlyLongform ? { key: "longform", label: "Longform" } : null
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
    <ExtensionUiProvider>
      <BackgroundScene />
      <main className="min-h-[100dvh] px-4 py-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <section className="space-y-5">
              <div className="inline-flex items-center rounded-full border border-white/65 bg-white/35 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-600 backdrop-blur-xl">
                Bookmark workspace
              </div>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h1 className="text-[clamp(2.8rem,6vw,5.1rem)] font-sans font-semibold leading-[0.92] tracking-[-0.07em] text-slate-950">
                    Bookmarks
                  </h1>
                  <p className="mt-3 max-w-[36ch] text-base leading-7 text-slate-700/82 md:text-lg">
                    Search, sort, and file saved posts across lists, tags, and recent syncs.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={workspace.summary.status} />
                  <div className="rounded-full border border-white/65 bg-white/35 px-4 py-2 text-sm text-slate-600 backdrop-blur-xl">
                    Last sync {lastSyncLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => void workspace.handleSync()}
                    disabled={workspace.isSyncing}
                    className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
                    <AppIcon name="sync" size={16} />
                    <span>{workspace.isSyncing ? "Syncing..." : "Sync now"}</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="glass-panel overflow-hidden p-0">
              <div className="grid divide-y divide-white/40 md:grid-cols-2 md:divide-x md:divide-y-0">
                <div className="p-5 md:p-6">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total bookmarks</p>
                  <div className="mt-3 text-[3.4rem] leading-none tracking-[-0.08em] text-slate-800">{workspace.stats.totalBookmarks}</div>
                  <p className="mt-3 max-w-[16ch] text-sm leading-6 text-slate-600">Current local inventory.</p>
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Unclassified</p>
                  <div className="mt-3 text-[3.4rem] leading-none tracking-[-0.08em] text-slate-800">{workspace.stats.unclassifiedCount}</div>
                  <p className="mt-3 max-w-[16ch] text-sm leading-6 text-slate-600">Still waiting for tag coverage.</p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[232px_minmax(0,1fr)_340px] xl:items-start 2xl:grid-cols-[248px_minmax(0,1fr)_360px]">
            {workspace.isLoading && !workspace.bookmarks.length ? (
              <>
                <LoadingPanel title="Lists" />
                <LoadingPanel title="Bookmarks" />
                <LoadingPanel title="Details" />
              </>
            ) : (
              <>
                <SurfaceCard
                  title="Lists"
                  className="min-h-[420px] xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]"
                  bodyClassName="scroll-shell min-h-0 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    <button
                      type="button"
                      data-list-button="all"
                      onClick={() => setSelectedListId("")}
                      className={cn("flex w-full items-center justify-between rounded-full px-4 py-3 text-left transition duration-300",
                        selectedListId === "" ? "bg-sky-500 text-white shadow-soft" : "bg-white/45 text-slate-900 hover:bg-white/65"
                      )}>
                      <span>All bookmarks</span>
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
                              aria-label={`Delete ${list.name}`}
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
                    <FieldBlock label="New list" htmlFor={newListId} description="Flat groups only. Nested folders are intentionally removed.">
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
                      <span>Create list</span>
                    </button>
                  </div>
                </SurfaceCard>

                <section className="min-h-[420px]">
                  <div className="glass-panel p-5 md:p-6">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h2 className="text-[1.35rem] font-medium tracking-[-0.03em] text-slate-900">Library</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">Search, refine, and sort saved posts from one control surface.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="rounded-full border border-white/60 bg-white/30 px-3 py-1.5 backdrop-blur-xl">
                          {visibleBookmarks.length} results
                        </span>
                        {hasBulkSelection ? (
                          <span className="rounded-full border border-white/60 bg-white/30 px-3 py-1.5 backdrop-blur-xl">
                            {selectedBookmarkIds.length} selected
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                      <FieldBlock label="Search" htmlFor={searchId} labelClassName="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        <div className="relative min-w-0">
                          <AppIcon name="search" size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                          <TextInputField
                            id={searchId}
                            type="search"
                            value={query}
                            placeholder="Search bookmarks, authors, and notes"
                            onChange={setQuery}
                            className="min-h-[52px] pl-11 pr-4"
                          />
                        </div>
                      </FieldBlock>
                      <FieldBlock label="Sort by" htmlFor={sortId} labelClassName="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        <SelectField
                          id={sortId}
                          value={sortOrder}
                          onChange={(value) => setSortOrder(value as BookmarkSortOrder)}
                          options={[
                            { value: "saved-desc", label: "Newest saved" },
                            { value: "saved-asc", label: "Oldest saved" },
                            { value: "created-desc", label: "Newest published" },
                            { value: "likes-desc", label: "Most liked" }
                          ]}
                          className="min-h-[52px] py-2.5"
                        />
                      </FieldBlock>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                      <FieldBlock
                        label="Saved time"
                        htmlFor={timeId}
                        className="w-full xl:w-[220px]"
                        labelClassName="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        <SelectField
                          id={timeId}
                          value={timeRange}
                          onChange={(value) => setTimeRange(value as SavedTimeRange)}
                          options={[
                            { value: "all", label: "Any time" },
                            { value: "7d", label: "Last 7 days" },
                            { value: "30d", label: "Last 30 days" },
                            { value: "90d", label: "Last 90 days" }
                          ]}
                          className="min-h-[52px] py-2.5"
                        />
                      </FieldBlock>
                      <div className="flex flex-wrap items-center gap-2 xl:pb-1">
                        <ToggleChip checked={onlyWithMedia} label="Has media" onChange={setOnlyWithMedia} />
                        <ToggleChip checked={onlyLongform} label="Longform" onChange={setOnlyLongform} />
                        <button
                          type="button"
                          onClick={() => setShowAdvancedFilters((current) => !current)}
                          className={cn("chip-button", showAdvancedFilters && "chip-button-active")}>
                          <span>{showAdvancedFilters ? "Hide advanced filters" : "Advanced filters"}</span>
                          {hasAdvancedRefinements ? (
                            <span className={cn("rounded-full px-2 py-0.5 text-xs", showAdvancedFilters ? "bg-white/20 text-white" : "bg-slate-900 text-white")}>
                              {Number(Boolean(selectedAuthorHandle)) + Number(Boolean(selectedTagId))}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    </div>

                    {showAdvancedFilters ? (
                      <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-white/50 bg-white/16 p-4 xl:grid-cols-2">
                        <FieldBlock label="Author" htmlFor={authorId}>
                          <SelectField
                            id={authorId}
                            value={selectedAuthorHandle}
                            onChange={setSelectedAuthorHandle}
                            options={[{ value: "", label: "All authors" }, ...authorOptions]}
                            className="min-h-[52px] py-2.5"
                          />
                        </FieldBlock>
                        <FieldBlock label="Tag" htmlFor={tagId}>
                          <SelectField
                            id={tagId}
                            value={selectedTagId}
                            onChange={setSelectedTagId}
                            options={[{ value: "", label: "All tags" }, ...workspace.tags.map((tag) => ({ value: tag.id, label: tag.name }))]}
                            className="min-h-[52px] py-2.5"
                          />
                        </FieldBlock>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/45 pt-4">
                      <div className="flex flex-wrap gap-2">
                        {hasActiveRefinements ? (
                          activeRefinementChips.map((chip) => (
                            <button
                              key={chip.key}
                              type="button"
                              onClick={() => clearRefinement(chip.key)}
                              className="chip-button">
                              <span>{chip.label}</span>
                              <AppIcon name="close" size={12} />
                            </button>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No active filters. Add author, tag, time, or content filters.</span>
                        )}
                      </div>

                      {hasActiveRefinements ? (
                        <button type="button" onClick={clearAllRefinements} className="glass-button">
                          <span>Clear all</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {hasBulkSelection ? (
                    <div className="glass-panel mt-4 p-4 md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{selectedBookmarkIds.length} bookmarks selected</div>
                          <p className="mt-1 text-sm text-slate-600">Apply list and tag changes in one pass.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedBookmarkIds([])}
                          className="glass-button">
                          <span>Clear selection</span>
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                        <FieldBlock label="Move selected to" htmlFor={moveId}>
                          <SelectField
                            id={moveId}
                            value={bulkListId}
                            onChange={setBulkListId}
                            options={[
                              { value: "", label: "Choose list" },
                              ...workspace.lists.map((list) => ({ value: list.id, label: list.name }))
                            ]}
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
                          className="glass-button justify-center self-end disabled:cursor-not-allowed disabled:opacity-60">
                          <span>Move selected</span>
                        </button>
                        <FieldBlock label="Tag selected with" htmlFor={bulkTagIdField}>
                          <SelectField
                            id={bulkTagIdField}
                            value={bulkTagId}
                            onChange={setBulkTagId}
                            options={[
                              { value: "", label: "Choose tag" },
                              ...workspace.tags.map((tag) => ({ value: tag.id, label: tag.name }))
                            ]}
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
                          className="glass-button justify-center self-end disabled:cursor-not-allowed disabled:opacity-60">
                          <span>Apply tag</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-600">Showing {visibleBookmarks.length} of {workspace.bookmarks.length}</span>
                      {selectedListId ? (
                        <span className="text-sm text-slate-500">Scoped to {listNamesById.get(selectedListId) ?? "selected list"}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBookmarkIds(visibleBookmarks.map((bookmark) => bookmark.tweetId))}
                        disabled={!visibleBookmarks.length}
                        className="glass-button disabled:cursor-not-allowed disabled:opacity-60">
                        <span>Select visible</span>
                      </button>
                    </div>
                  </div>

                  {visibleBookmarks.length ? (
                    <div className="scroll-shell mt-4 grid max-h-[780px] content-start gap-4 overflow-y-auto pb-1 pr-1 sm:grid-cols-2 2xl:grid-cols-3">
                      {visibleBookmarks.map((bookmark, index) => {
                        const currentTagNames = tagNamesByBookmarkId.get(bookmark.tweetId) ?? []
                        const currentListName = listNamesById.get(getListIdByBookmarkId(bookmark.tweetId, bookmarkListByBookmarkId)) ?? "Inbox"
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
                        title="No bookmarks match the current filters"
                        description="Adjust search, change filter chips, or run another sync to refill the library."
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
    </ExtensionUiProvider>
  )
}
