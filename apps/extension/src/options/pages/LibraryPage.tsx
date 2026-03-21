import React, { useEffect, useMemo, useState } from "react"
import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import {
  applyBookmarkFilters,
  type BookmarkSortOrder,
  type MultiValueMatchMode,
  type SavedTimeRange
} from "../../lib/search/searchBookmarks.ts"
import { InboxBookmarkDetailDrawer } from "../components/InboxBookmarkDetailDrawer.tsx"
import { InboxDetailPanel } from "../components/InboxDetailPanel.tsx"
import { InboxTable } from "../components/InboxTable.tsx"
import { InboxWorkbenchToolbar } from "../components/InboxWorkbenchToolbar.tsx"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { getAuthorOptions, getBookmarkTagsForBookmark } from "../lib/pageHelpers.ts"
import type { LibraryView } from "../lib/navigation.ts"
import { SectionHeader, SurfaceCard } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"
import { isUiTestEnv } from "../../ui/testEnv.ts"

function countBookmarksByTag(tagId: string, bookmarkTags: Array<{ tagId: string }>) {
  return bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === tagId).length
}

interface LibraryPageProps {
  view: LibraryView
  onViewChange: (view: LibraryView) => void
}

export function LibraryPage({ view, onViewChange }: LibraryPageProps) {
  const workspace = useWorkspaceData()
  const testEnv = isUiTestEnv()
  const showDetailPane = !testEnv && (useMediaQuery("(min-width: 1120px)", false, { getInitialValueInEffect: false }) ?? false)
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [selectedAuthorHandles, setSelectedAuthorHandles] = useState<string[]>([])
  const [authorMatchMode, setAuthorMatchMode] = useState<MultiValueMatchMode>("any")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagMatchMode, setTagMatchMode] = useState<MultiValueMatchMode>("all")
  const [timeRange, setTimeRange] = useState<SavedTimeRange>("all")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [bulkTagId, setBulkTagId] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  useEffect(() => {
    if (view === "tags") {
      setSelectedTagId((current) => current ?? workspace.tags[0]?.id)
    }
  }, [workspace.tags, view])

  const scopedBookmarks = useMemo(() => {
    switch (view) {
      case "tags": {
        if (!selectedTagId) {
          return []
        }

        const bookmarkIds = new Set(
          workspace.bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === selectedTagId).map((bookmarkTag) => bookmarkTag.bookmarkId)
        )

        return workspace.bookmarks.filter((bookmark) => bookmarkIds.has(bookmark.tweetId))
      }
      case "all":
      default:
        return workspace.bookmarks
      }
  }, [selectedTagId, view, workspace.bookmarkTags, workspace.bookmarks])

  function handleClearFilters() {
    setQuery("")
    setSelectedAuthorHandles([])
    setAuthorMatchMode("any")
    setSelectedTagIds([])
    setTagMatchMode("all")
    setTimeRange("all")
    setSortOrder("saved-desc")
    setOnlyWithMedia(false)
    setOnlyLongform(false)
    setSelectedBookmarkIds([])
    setBulkTagId("")
  }

  function handleToggleAuthor(authorHandle: string) {
    setSelectedAuthorHandles((current) =>
      current.includes(authorHandle) ? current.filter((value) => value !== authorHandle) : [...current, authorHandle]
    )
  }

  function handleToggleTag(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId]))
  }

  function handleToggleBookmarkSelection(bookmarkId: string) {
    setSelectedBookmarkIds((current) =>
      current.includes(bookmarkId) ? current.filter((value) => value !== bookmarkId) : [...current, bookmarkId]
    )
  }

  function handleSelectAllVisible() {
    setSelectedBookmarkIds(visibleBookmarks.map((bookmark) => bookmark.tweetId))
  }

  function handleClearSelection() {
    setSelectedBookmarkIds([])
  }

  const authorOptions = useMemo(() => getAuthorOptions(scopedBookmarks), [scopedBookmarks])
  const visibleBookmarks = useMemo(
    () =>
      applyBookmarkFilters(scopedBookmarks, {
        query,
        bookmarkTags: workspace.bookmarkTags,
        selectedPublishedDate: undefined,
        selectedAuthorHandles,
        authorMatchMode,
        selectedTagIds,
        tagMatchMode,
        timeRange,
        onlyWithMedia,
        onlyLongform,
        sortOrder
      }),
    [
      authorMatchMode,
      onlyLongform,
      onlyWithMedia,
      query,
      scopedBookmarks,
      selectedAuthorHandles,
      selectedTagIds,
      sortOrder,
      tagMatchMode,
      timeRange,
      workspace.bookmarkTags
    ]
  )

  const selectedBookmark = useMemo(
    () => visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ?? null,
    [selectedBookmarkId, visibleBookmarks]
  )

  const visibleBookmarkIds = useMemo(() => new Set(visibleBookmarks.map((bookmark) => bookmark.tweetId)), [visibleBookmarks])

  useEffect(() => {
    setSelectedBookmarkIds((current) => current.filter((bookmarkId) => visibleBookmarkIds.has(bookmarkId)))
  }, [visibleBookmarkIds])

  useEffect(() => {
    if (selectedBookmarkId && !visibleBookmarkIds.has(selectedBookmarkId)) {
      setSelectedBookmarkId(showDetailPane ? visibleBookmarks[0]?.tweetId : undefined)
    }
  }, [selectedBookmarkId, showDetailPane, visibleBookmarkIds, visibleBookmarks])

  useEffect(() => {
    if (showDetailPane && visibleBookmarks.length && !selectedBookmarkId) {
      setSelectedBookmarkId(visibleBookmarks[0]?.tweetId)
    }
  }, [selectedBookmarkId, showDetailPane, visibleBookmarks])

  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const selectedBookmarkTags = useMemo(
    () => getBookmarkTagsForBookmark(selectedBookmark?.tweetId, workspace.bookmarkTags, tagsById),
    [workspace.bookmarkTags, selectedBookmark?.tweetId, tagsById]
  )
  const selectedBookmarkIndex = useMemo(
    () => visibleBookmarks.findIndex((bookmark) => bookmark.tweetId === selectedBookmark?.tweetId),
    [selectedBookmark?.tweetId, visibleBookmarks]
  )

  async function handleBulkTag() {
    if (!selectedBookmarkIds.length || !bulkTagId) {
      return
    }

    await workspace.handleBulkAttachTag(selectedBookmarkIds, bulkTagId)
    setSelectedBookmarkIds([])
  }

  function handleSelectPrevious() {
    if (selectedBookmarkIndex <= 0) {
      return
    }

    setSelectedBookmarkId(visibleBookmarks[selectedBookmarkIndex - 1]?.tweetId)
  }

  function handleSelectNext() {
    if (selectedBookmarkIndex < 0 || selectedBookmarkIndex >= visibleBookmarks.length - 1) {
      return
    }

    setSelectedBookmarkId(visibleBookmarks[selectedBookmarkIndex + 1]?.tweetId)
  }

  const currentViewLabel =
    view === "tags"
      ? workspace.tags.find((tag) => tag.id === selectedTagId)?.name ?? "Tag"
      : "All bookmarks"

  return (
    <ExtensionUiProvider>
      <Stack gap="md" style={{ minHeight: 0, height: testEnv ? "auto" : "calc(100vh - 32px)" }}>
        <SectionHeader
          title="Library"
          description="Review the full collection in the same card-based workbench flow as Inbox, with tags as a browsing and filtering surface."
          actions={
            <Paper
              p={4}
              radius="md"
              withBorder
              style={{
                display: "inline-flex",
                gap: 3,
                background: "#f3f3f4"
              }}>
              <Button type="button" variant={view === "all" ? "white" : "subtle"} color={view === "all" ? "dark" : "gray"} onClick={() => onViewChange("all")} disabled={view === "all"}>
                All
              </Button>
              <Button type="button" variant={view === "tags" ? "white" : "subtle"} color={view === "tags" ? "dark" : "gray"} onClick={() => onViewChange("tags")} disabled={view === "tags"}>
                Tags
              </Button>
            </Paper>
          }
        />

        <SurfaceCard title="Library scope" description={`${currentViewLabel} · ${visibleBookmarks.length} visible of ${scopedBookmarks.length} in scope.`}>
          <Stack gap="md">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="dark">
                {workspace.bookmarks.length} bookmarks
              </Badge>
              <Badge variant="light" color="gray">
                {workspace.tags.length} tags in use
              </Badge>
              <Badge variant="light" color="blue">
                {new Set(workspace.bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId)).size} tagged
              </Badge>
            </Group>

            {view === "tags" ? (
              <Stack gap="xs">
            <Text fw={600}>Tag browser</Text>
            {!workspace.tags.length ? <Text c="dimmed">No tags available yet.</Text> : null}
                <Group gap="xs" wrap="wrap">
                  {workspace.tags.map((tag) => (
                    <Button key={tag.id} type="button" variant={tag.id === selectedTagId ? "filled" : "light"} color={tag.id === selectedTagId ? "dark" : "gray"} onClick={() => setSelectedTagId(tag.id)}>
                      {tag.name} ({countBookmarksByTag(tag.id, workspace.bookmarkTags)})
                    </Button>
              ))}
            </Group>
            <Text size="sm" c="dimmed">
              Tag creation lives in Settings.
            </Text>
          </Stack>
        ) : null}
          </Stack>
        </SurfaceCard>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: showDetailPane ? "minmax(360px, 460px) minmax(0, 1fr)" : "1fr",
            gap: 16,
            flex: 1,
            minHeight: 0
          }}>
          <Stack gap="md" style={{ minHeight: 0 }}>
            <InboxWorkbenchToolbar
              query={query}
              onQueryChange={setQuery}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              selectedPublishedDate={undefined}
              onClearPublishedDate={() => {}}
              onlyWithMedia={onlyWithMedia}
              onOnlyWithMediaChange={setOnlyWithMedia}
              onlyLongform={onlyLongform}
              onOnlyLongformChange={setOnlyLongform}
              authorOptions={authorOptions}
              selectedAuthorHandles={selectedAuthorHandles}
              authorMatchMode={authorMatchMode}
              onToggleAuthor={handleToggleAuthor}
              onAuthorMatchModeChange={setAuthorMatchMode}
              tags={workspace.tags}
              selectedTagIds={selectedTagIds}
              tagMatchMode={tagMatchMode}
              onToggleTag={handleToggleTag}
              onTagMatchModeChange={setTagMatchMode}
              resultCount={visibleBookmarks.length}
              totalCount={scopedBookmarks.length}
              selectedCount={selectedBookmarkIds.length}
              onSelectAllVisible={handleSelectAllVisible}
              onClearSelection={handleClearSelection}
              bulkTagId={bulkTagId}
              onBulkTagIdChange={setBulkTagId}
              onBulkTag={() => void handleBulkTag()}
              isSavingTag={workspace.isSavingTag}
              showAdvancedFilters={showAdvancedFilters}
              onToggleAdvancedFilters={() => setShowAdvancedFilters((current) => !current)}
              onClearFilters={handleClearFilters}
            />

            <InboxTable
              bookmarks={visibleBookmarks}
              selectedBookmarkId={selectedBookmark?.tweetId}
              selectedBookmarkIds={selectedBookmarkIds}
              onSelectBookmark={setSelectedBookmarkId}
              onToggleBookmarkSelection={handleToggleBookmarkSelection}
            />
          </Stack>

          {showDetailPane ? (
            <InboxDetailPanel
              bookmark={selectedBookmark}
              tags={selectedBookmarkTags}
              availableTags={workspace.tags}
              onAttachTag={(tagId) => workspace.handleAttachTag(selectedBookmark?.tweetId ?? "", tagId)}
              onDetachTag={(tagId) => workspace.handleDetachTag(selectedBookmark?.tweetId ?? "", tagId)}
              isSaving={workspace.isSavingTag}
              onSelectPrevious={handleSelectPrevious}
              onSelectNext={handleSelectNext}
              hasPrevious={selectedBookmarkIndex > 0}
              hasNext={selectedBookmarkIndex >= 0 && selectedBookmarkIndex < visibleBookmarks.length - 1}
              onClearSelection={() => setSelectedBookmarkId(undefined)}
            />
          ) : null}
        </div>

        <InboxBookmarkDetailDrawer
          opened={!showDetailPane && Boolean(selectedBookmark)}
          onClose={() => setSelectedBookmarkId(undefined)}
          bookmark={selectedBookmark}
          tags={selectedBookmarkTags}
          availableTags={workspace.tags}
          onAttachTag={(tagId) => workspace.handleAttachTag(selectedBookmark?.tweetId ?? "", tagId)}
          onDetachTag={(tagId) => workspace.handleDetachTag(selectedBookmark?.tweetId ?? "", tagId)}
          isSaving={workspace.isSavingTag}
        />
      </Stack>
    </ExtensionUiProvider>
  )
}
