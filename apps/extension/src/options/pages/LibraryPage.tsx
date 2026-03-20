import React, { useEffect, useMemo, useState } from "react"
import { Button, Grid, Group, NativeSelect, Stack, Text } from "@mantine/core"
import { filterBookmarks, filterBookmarksByFolder, sortBookmarks, type BookmarkSortOrder } from "../../lib/search/searchBookmarks.ts"
import { buildFolderTree, INBOX_FOLDER_ID } from "../../lib/storage/foldersStore.ts"
import type { FolderRecord } from "../../lib/types.ts"
import { BookmarkDetail } from "../../popup/components/BookmarkDetail.tsx"
import { BookmarkList } from "../../popup/components/BookmarkList.tsx"
import { useWorkspaceCommands } from "../hooks/useWorkspaceCommands.ts"
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries.ts"
import { getBookmarkTagsForBookmark, getCurrentFolderForBookmark, getSortLabel } from "../lib/pageHelpers.ts"
import type { LibraryView } from "../lib/navigation.ts"
import { SectionHeader, SurfaceCard } from "../../ui/components.tsx"

function countBookmarksByTag(tagId: string, bookmarkTags: Array<{ tagId: string }>) {
  return bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === tagId).length
}

function FolderNode({
  node,
  depth,
  selectedFolderId,
  onSelectFolder,
  bookmarkCountByFolderId
}: {
  node: FolderRecord & { children: Array<FolderRecord & { children: never[] }> }
  depth: number
  selectedFolderId?: string
  onSelectFolder: (folderId: string) => void
  bookmarkCountByFolderId: Map<string, number>
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button
        type="button"
        onClick={() => onSelectFolder(node.id)}
        style={{
          marginLeft: depth * 14,
          padding: "8px 10px",
          borderRadius: 8,
          border: node.id === selectedFolderId ? "1px solid #486581" : "1px solid #d9e2ec",
          background: node.id === selectedFolderId ? "#e3f2fd" : "#ffffff",
          textAlign: "left"
        }}>
        {node.name} ({bookmarkCountByFolderId.get(node.id) ?? 0})
      </button>
      {node.children.map((childNode) => (
        <FolderNode
          key={childNode.id}
          node={childNode}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          bookmarkCountByFolderId={bookmarkCountByFolderId}
        />
      ))}
    </div>
  )
}

interface LibraryPageProps {
  view: LibraryView
  onViewChange: (view: LibraryView) => void
}

export function LibraryPage({ view, onViewChange }: LibraryPageProps) {
  const queries = useWorkspaceQueries()
  const commands = useWorkspaceCommands({
    bookmarks: queries.bookmarks,
    refreshData: queries.refreshData
  })
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined)
  const [selectedFolderId, setSelectedFolderId] = useState<string>(INBOX_FOLDER_ID)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")

  useEffect(() => {
    if (view === "tags") {
      setSelectedTagId((current) => current ?? queries.tags[0]?.id)
      return
    }

    if (view === "folders") {
      setSelectedFolderId((current) => current || queries.folders[0]?.id || INBOX_FOLDER_ID)
    }
  }, [queries.folders, queries.tags, view])

  const folderTree = useMemo(() => buildFolderTree(queries.folders), [queries.folders])
  const bookmarkCountByFolderId = useMemo(() => {
    const counts = new Map<string, number>()

    for (const bookmarkFolder of queries.bookmarkFolders) {
      counts.set(bookmarkFolder.folderId, (counts.get(bookmarkFolder.folderId) ?? 0) + 1)
    }

    return counts
  }, [queries.bookmarkFolders])

  const filteredBookmarks = useMemo(() => {
    switch (view) {
      case "tags": {
        if (!selectedTagId) {
          return []
        }

        const bookmarkIds = new Set(
          queries.bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === selectedTagId).map((bookmarkTag) => bookmarkTag.bookmarkId)
        )

        return queries.bookmarks.filter((bookmark) => bookmarkIds.has(bookmark.tweetId))
      }
      case "folders":
        return filterBookmarksByFolder(queries.bookmarks, queries.folders, queries.bookmarkFolders, selectedFolderId)
      case "all":
      default:
        return queries.bookmarks
    }
  }, [queries.bookmarkFolders, queries.bookmarkTags, queries.bookmarks, queries.folders, selectedFolderId, selectedTagId, view])

  const visibleBookmarks = useMemo(
    () => sortBookmarks(filterBookmarks(filteredBookmarks, query), sortOrder),
    [filteredBookmarks, query, sortOrder]
  )

  const selectedBookmark = useMemo(
    () => visibleBookmarks.find((bookmark) => bookmark.tweetId === selectedBookmarkId) ?? visibleBookmarks[0] ?? null,
    [selectedBookmarkId, visibleBookmarks]
  )

  useEffect(() => {
    if (!selectedBookmark && visibleBookmarks[0]) {
      setSelectedBookmarkId(visibleBookmarks[0].tweetId)
      return
    }

    if (selectedBookmark && selectedBookmark.tweetId !== selectedBookmarkId) {
      setSelectedBookmarkId(selectedBookmark.tweetId)
    }
  }, [selectedBookmark, selectedBookmarkId, visibleBookmarks])

  const tagsById = useMemo(() => new Map(queries.tags.map((tag) => [tag.id, tag])), [queries.tags])
  const selectedBookmarkTags = useMemo(
    () => getBookmarkTagsForBookmark(selectedBookmark?.tweetId, queries.bookmarkTags, tagsById),
    [queries.bookmarkTags, selectedBookmark?.tweetId, tagsById]
  )
  const currentFolder = useMemo(
    () => getCurrentFolderForBookmark(selectedBookmark?.tweetId, queries.bookmarkFolders, queries.foldersById),
    [queries.bookmarkFolders, queries.foldersById, selectedBookmark?.tweetId]
  )

  const currentViewLabel =
    view === "tags"
      ? queries.tags.find((tag) => tag.id === selectedTagId)?.name ?? "Tag"
      : view === "folders"
        ? queries.foldersById.get(selectedFolderId)?.name ?? "Folder"
        : "All bookmarks"

  return (
    <Stack gap="lg">
      <SectionHeader
        title="Library"
        description="Review organized bookmarks through all-items, tag, and folder views without leaving the main workspace."
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 3 }}>
          <SurfaceCard title="Library views">
            <Group gap="xs" wrap="wrap">
              <Button type="button" variant={view === "all" ? "filled" : "light"} onClick={() => onViewChange("all")} disabled={view === "all"}>
                All
              </Button>
              <Button type="button" variant={view === "tags" ? "filled" : "light"} onClick={() => onViewChange("tags")} disabled={view === "tags"}>
                Tags
              </Button>
              <Button type="button" variant={view === "folders" ? "filled" : "light"} onClick={() => onViewChange("folders")} disabled={view === "folders"}>
                Folders
              </Button>
            </Group>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Search</span>
              <input value={query} placeholder="Search library" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Sort</span>
              <NativeSelect value={sortOrder} onChange={(event) => setSortOrder(event.currentTarget.value as BookmarkSortOrder)}>
                <option value="saved-desc">Newest saved</option>
                <option value="saved-asc">Oldest saved</option>
                <option value="created-desc">Newest on X</option>
                <option value="likes-desc">Most likes</option>
              </NativeSelect>
            </label>

            {view === "all" ? (
              <Stack gap={4}>
                <Text fw={600}>Coverage</Text>
                <Text>Bookmarks: {queries.bookmarks.length}</Text>
                <Text>Tags in use: {queries.tags.length}</Text>
                <Text>Folders in use: {queries.folders.length}</Text>
              </Stack>
            ) : null}

            {view === "tags" ? (
              <Stack gap="xs">
                <Text fw={600}>Tag browser</Text>
                {!queries.tags.length ? <Text c="dimmed">No tags available yet.</Text> : null}
                {queries.tags.map((tag) => (
                  <Button key={tag.id} type="button" variant={tag.id === selectedTagId ? "filled" : "subtle"} justify="flex-start" onClick={() => setSelectedTagId(tag.id)}>
                    {tag.name} ({countBookmarksByTag(tag.id, queries.bookmarkTags)})
                  </Button>
                ))}
              </Stack>
            ) : null}

            {view === "folders" ? (
              <Stack gap="xs">
                <Text fw={600}>Folder browser</Text>
                {folderTree.map((folderNode) => (
                  <FolderNode
                    key={folderNode.id}
                    node={folderNode as FolderRecord & { children: Array<FolderRecord & { children: never[] }> }}
                    depth={0}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={setSelectedFolderId}
                    bookmarkCountByFolderId={bookmarkCountByFolderId}
                  />
                ))}
              </Stack>
            ) : null}
          </SurfaceCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 4 }}>
          <SurfaceCard title="Results" description={`${currentViewLabel} · sorted by ${getSortLabel(sortOrder)}`}>
            <BookmarkList
              bookmarks={visibleBookmarks}
              selectedBookmarkId={selectedBookmark?.tweetId}
              resultCount={visibleBookmarks.length}
              sortLabel={getSortLabel(sortOrder)}
              folderLabel={currentViewLabel}
              onSelectBookmark={setSelectedBookmarkId}
            />
          </SurfaceCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <SurfaceCard title="Details" description="Review the current bookmark without leaving the library view.">
            <BookmarkDetail
              bookmark={selectedBookmark}
              currentFolder={currentFolder}
              availableFolders={queries.folders}
              tags={selectedBookmarkTags}
              availableTags={queries.tags}
              onCreateFolder={commands.handleCreateFolder}
              onMoveToFolder={(folderId) => commands.handleMoveToFolder(selectedBookmark?.tweetId ?? "", folderId)}
              onCreateTag={commands.handleCreateTag}
              onAttachTag={(tagId) => commands.handleAttachTag(selectedBookmark?.tweetId ?? "", tagId)}
              onDetachTag={(tagId) => commands.handleDetachTag(selectedBookmark?.tweetId ?? "", tagId)}
              isSaving={commands.isSavingTag || commands.isSavingFolder}
            />
          </SurfaceCard>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
