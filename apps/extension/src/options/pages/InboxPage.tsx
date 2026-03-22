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
import { ExtensionUiProvider } from "../../ui/provider.tsx"
import type { InboxRouteState } from "../lib/navigation.ts"
import { isUiTestEnv } from "../../ui/testEnv.ts"
import { EmptyState, SectionHeader, SurfaceCard } from "../../ui/components.tsx"

type InboxViewMode = "all" | "longform"

export function InboxPage({ initialRouteState }: { initialRouteState?: InboxRouteState }) {
  const workspace = useWorkspaceData()
  const testEnv = isUiTestEnv()
  const showDetailPane = !testEnv && (useMediaQuery("(min-width: 1120px)", false, { getInitialValueInEffect: false }) ?? false)
  const inboxBookmarks = useMemo(() => {
    const taggedBookmarkIds = new Set(workspace.bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
    return workspace.bookmarks.filter((bookmark) => !taggedBookmarkIds.has(bookmark.tweetId))
  }, [workspace.bookmarkTags, workspace.bookmarks])
  const [viewMode, setViewMode] = useState<InboxViewMode>("all")
  const [query, setQuery] = useState("")
  const [selectedAuthorHandles, setSelectedAuthorHandles] = useState<string[]>([])
  const [authorMatchMode, setAuthorMatchMode] = useState<MultiValueMatchMode>("any")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagMatchMode, setTagMatchMode] = useState<MultiValueMatchMode>("all")
  const [timeRange, setTimeRange] = useState<SavedTimeRange>("all")
  const [selectedPublishedDate, setSelectedPublishedDate] = useState<string | undefined>(initialRouteState?.publishedDate)
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([])
  const [bulkTagId, setBulkTagId] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  function handleClearFilters() {
    setQuery("")
    setSelectedAuthorHandles([])
    setAuthorMatchMode("any")
    setSelectedTagIds([])
    setTagMatchMode("all")
    setTimeRange("all")
    setSelectedPublishedDate(undefined)
    setSortOrder("saved-desc")
    setOnlyWithMedia(false)
    setOnlyLongform(false)
    setSelectedBookmarkIds([])
    setBulkTagId("")
    setViewMode("all")
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

  const authorOptions = useMemo(() => getAuthorOptions(workspace.bookmarks), [workspace.bookmarks])
  const filteredBookmarks = useMemo(
    () =>
      applyBookmarkFilters(inboxBookmarks, {
        query,
        selectedPublishedDate,
        bookmarkTags: workspace.bookmarkTags,
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
      inboxBookmarks,
      onlyLongform,
      onlyWithMedia,
      query,
      selectedAuthorHandles,
      selectedPublishedDate,
      selectedTagIds,
      sortOrder,
      tagMatchMode,
      timeRange,
      workspace.bookmarkTags
    ]
  )

  const visibleBookmarks = useMemo(() => {
    if (viewMode === "longform") {
      return filteredBookmarks.filter((bookmark) => bookmark.text.trim().length > 280)
    }

    return filteredBookmarks
  }, [filteredBookmarks, viewMode])

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
    [selectedBookmark?.tweetId, tagsById, workspace.bookmarkTags]
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

  return (
    <ExtensionUiProvider>
      <Stack gap="sm" style={{ minHeight: 0, height: testEnv ? "auto" : "calc(100vh - 32px)" }}>
        <SectionHeader
          title="Inbox"
          description="Review raw source material, inspect the selected post in detail, and tag it before it lands in Library."
          actions={
            <Stack gap={8} align="end">
              <Group gap="xs" wrap="wrap" justify="flex-end">
                <Badge variant="light" color="dark">
                  {inboxBookmarks.length} raw in queue
                </Badge>
                {selectedBookmarkIds.length ? (
                  <Badge variant="light" color="blue">
                    {selectedBookmarkIds.length} selected
                  </Badge>
                ) : null}
              </Group>
              <Paper
                p={4}
                radius="xl"
                withBorder
                style={{
                  display: "inline-flex",
                  gap: 3,
                  background: "#f3f3f4"
                }}>
                <Button type="button" variant={viewMode === "all" ? "white" : "subtle"} color={viewMode === "all" ? "dark" : "gray"} onClick={() => setViewMode("all")}>
                  All sources
                </Button>
                <Button type="button" variant={viewMode === "longform" ? "white" : "subtle"} color={viewMode === "longform" ? "dark" : "gray"} onClick={() => setViewMode("longform")}>
                  Notes & long posts
                </Button>
              </Paper>
            </Stack>
          }
        />

        {!workspace.bookmarks.length ? (
          <EmptyState
            title="No source material yet."
            description="Run your first sync to pull saved X posts and note_tweets into the source queue. Once source material exists, you can tag it here and review generated cards in Library."
          />
        ) : null}

        {workspace.bookmarks.length > 0 && !workspace.knowledgeCards.length ? (
          <SurfaceCard title="First run" description="You already have source material. The next sync will generate your first knowledge card drafts.">
            <Text c="dimmed">The intended path is: sync source material, triage it here if needed, review generated cards in Library, then export the reviewed cards into your vault.</Text>
          </SurfaceCard>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: showDetailPane ? "minmax(320px, 0.84fr) minmax(0, 1.46fr)" : "1fr",
            gap: 16,
            flex: 1,
            minHeight: 0,
            overflow: "hidden"
          }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: "100%",
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: 16,
              overflow: "hidden"
            }}>
            <InboxWorkbenchToolbar
              query={query}
              onQueryChange={setQuery}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              selectedPublishedDate={selectedPublishedDate}
              onClearPublishedDate={() => setSelectedPublishedDate(undefined)}
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
              totalCount={inboxBookmarks.length}
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

            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: 12, background: "#fcfcfd" }}>
              <InboxTable
                bookmarks={visibleBookmarks}
                selectedBookmarkId={selectedBookmark?.tweetId}
                selectedBookmarkIds={selectedBookmarkIds}
                onSelectBookmark={setSelectedBookmarkId}
                onToggleBookmarkSelection={handleToggleBookmarkSelection}
              />
            </div>
          </div>

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
