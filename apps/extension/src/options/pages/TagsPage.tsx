import React, { useEffect, useMemo, useState } from "react"
import { filterBookmarks, sortBookmarks, type BookmarkSortOrder } from "../../lib/search/searchBookmarks.ts"
import { BookmarkDetail } from "../../popup/components/BookmarkDetail.tsx"
import { BookmarkList } from "../../popup/components/BookmarkList.tsx"
import { SettingsPanel } from "../../popup/components/SettingsPanel.tsx"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { getBookmarkTagsForBookmark, getCurrentFolderForBookmark, getSortLabel } from "../lib/pageHelpers.ts"

function countBookmarksByTag(tagId: string, bookmarkTags: Array<{ tagId: string }>) {
  return bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === tagId).length
}

export function TagsPage() {
  const workspace = useWorkspaceData()
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [newTagName, setNewTagName] = useState("")
  const [query, setQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")

  useEffect(() => {
    setSelectedTagId((current) => current ?? workspace.tags[0]?.id)
  }, [workspace.tags])

  const visibleBookmarks = useMemo(() => {
    const bookmarkIds = new Set(
      workspace.bookmarkTags.filter((bookmarkTag) => bookmarkTag.tagId === selectedTagId).map((bookmarkTag) => bookmarkTag.bookmarkId)
    )

    return sortBookmarks(
      filterBookmarks(workspace.bookmarks.filter((bookmark) => bookmarkIds.has(bookmark.tweetId)), query),
      sortOrder
    )
  }, [query, selectedTagId, sortOrder, workspace.bookmarkTags, workspace.bookmarks])

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

  async function handleCreateTag() {
    if (!newTagName.trim()) {
      return
    }

    await workspace.handleCreateTag(newTagName)
    setNewTagName("")
  }

  const tagsById = useMemo(() => new Map(workspace.tags.map((tag) => [tag.id, tag])), [workspace.tags])
  const selectedBookmarkTags = useMemo(
    () => getBookmarkTagsForBookmark(selectedBookmark?.tweetId, workspace.bookmarkTags, tagsById),
    [selectedBookmark?.tweetId, tagsById, workspace.bookmarkTags]
  )
  const currentFolder = useMemo(
    () => getCurrentFolderForBookmark(selectedBookmark?.tweetId, workspace.bookmarkFolders, workspace.foldersById),
    [selectedBookmark?.tweetId, workspace.bookmarkFolders, workspace.foldersById]
  )

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 28 }}>Tags</h2>
        <p style={{ margin: 0, color: "#52606d" }}>Browse bookmarks through cross-cutting tags and keep your labeling system clean.</p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(320px, 420px) minmax(360px, 1fr)",
          gap: 16
        }}>
        <aside
          style={{
            display: "grid",
            gap: 16,
            alignContent: "start",
            padding: 16,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff"
          }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Tag library</h3>
            <input value={newTagName} placeholder="New tag name" onChange={(event) => setNewTagName(event.target.value)} />
            <button type="button" onClick={() => void handleCreateTag()}>
              Create tag
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {workspace.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedTagId(tag.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: tag.id === selectedTagId ? "1px solid #486581" : "1px solid #d9e2ec",
                  background: tag.id === selectedTagId ? "#e3f2fd" : "#ffffff",
                  textAlign: "left"
                }}>
                {tag.name} ({countBookmarksByTag(tag.id, workspace.bookmarkTags)})
              </button>
            ))}
          </div>
        </aside>

        <section
          style={{
            display: "grid",
            gap: 12,
            padding: 16,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff"
          }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Tagged bookmarks</h3>
            <input value={query} placeholder="Search within selected tag" onChange={(event) => setQuery(event.target.value)} />
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as BookmarkSortOrder)}>
              <option value="saved-desc">Newest saved</option>
              <option value="saved-asc">Oldest saved</option>
              <option value="created-desc">Newest on X</option>
              <option value="likes-desc">Most likes</option>
            </select>
          </div>
          <BookmarkList
            bookmarks={visibleBookmarks}
            selectedBookmarkId={selectedBookmark?.tweetId}
            resultCount={visibleBookmarks.length}
            sortLabel={getSortLabel(sortOrder)}
            folderLabel={workspace.tags.find((tag) => tag.id === selectedTagId)?.name ?? "Tag"}
            onSelectBookmark={setSelectedBookmarkId}
          />
        </section>

        <section
          style={{
            display: "grid",
            alignContent: "start",
            gap: 16,
            padding: 16,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff",
            overflowY: "auto"
          }}>
          <BookmarkDetail
            bookmark={selectedBookmark}
            currentFolder={currentFolder}
            availableFolders={workspace.folders}
            tags={selectedBookmarkTags}
            availableTags={workspace.tags}
            onCreateFolder={workspace.handleCreateFolder}
            onMoveToFolder={(folderId) => workspace.handleMoveToFolder(selectedBookmark?.tweetId ?? "", folderId)}
            onCreateTag={workspace.handleCreateTag}
            onAttachTag={(tagId) => workspace.handleAttachTag(selectedBookmark?.tweetId ?? "", tagId)}
            onDetachTag={(tagId) => workspace.handleDetachTag(selectedBookmark?.tweetId ?? "", tagId)}
            isSaving={workspace.isSavingTag || workspace.isSavingFolder}
          />
          <SettingsPanel
            bookmarks={workspace.bookmarks}
            tags={workspace.tags}
            latestSyncRun={workspace.latestSyncRun}
            onExport={workspace.handleExport}
            onReset={workspace.handleReset}
            isResetting={workspace.isResetting}
            compact
          />
        </section>
      </section>
    </div>
  )
}
