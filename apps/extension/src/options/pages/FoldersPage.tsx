import React, { useEffect, useMemo, useState } from "react"
import { filterBookmarks, sortBookmarks, type BookmarkSortOrder } from "../../lib/search/searchBookmarks.ts"
import { buildFolderTree, INBOX_FOLDER_ID } from "../../lib/storage/foldersStore.ts"
import type { FolderRecord } from "../../lib/types.ts"
import { BookmarkDetail } from "../../popup/components/BookmarkDetail.tsx"
import { BookmarkList } from "../../popup/components/BookmarkList.tsx"
import { SettingsPanel } from "../../popup/components/SettingsPanel.tsx"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"
import { getBookmarkTagsForBookmark, getCurrentFolderForBookmark } from "../lib/pageHelpers.ts"

function FolderNode({
  node,
  depth,
  selectedFolderId,
  onSelectFolder
}: {
  node: FolderRecord & { children: Array<FolderRecord & { children: never[] }> }
  depth: number
  selectedFolderId?: string
  onSelectFolder: (folderId: string) => void
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
        {node.name}
      </button>
      {node.children.map((childNode) => (
        <FolderNode
          key={childNode.id}
          node={childNode}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  )
}

export function FoldersPage() {
  const workspace = useWorkspaceData()
  const [selectedFolderId, setSelectedFolderId] = useState<string>(INBOX_FOLDER_ID)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState("")
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>("saved-desc")
  const [query, setQuery] = useState("")

  const folderTree = useMemo(() => buildFolderTree(workspace.folders), [workspace.folders])
  const visibleBookmarks = useMemo(() => {
    const bookmarkIds = new Set(
      workspace.bookmarkFolders.filter((bookmarkFolder) => bookmarkFolder.folderId === selectedFolderId).map((bookmarkFolder) => bookmarkFolder.bookmarkId)
    )

    return sortBookmarks(filterBookmarks(workspace.bookmarks.filter((bookmark) => bookmarkIds.has(bookmark.tweetId)), query), sortOrder)
  }, [query, selectedFolderId, sortOrder, workspace.bookmarkFolders, workspace.bookmarks])

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

  async function handleCreateFolder(parentId?: string) {
    if (!newFolderName.trim()) {
      return
    }

    await workspace.handleCreateFolder(newFolderName, parentId)
    setNewFolderName("")
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
        <h2 style={{ margin: 0, fontSize: 28 }}>Folders</h2>
        <p style={{ margin: 0, color: "#52606d" }}>Build and browse your folder tree, then move bookmarks into their permanent home.</p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "300px minmax(320px, 420px) minmax(360px, 1fr)",
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
            <h3 style={{ margin: 0 }}>Folder tree</h3>
            <input value={newFolderName} placeholder="New folder name" onChange={(event) => setNewFolderName(event.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => void handleCreateFolder()}>
                New root folder
              </button>
              <button type="button" onClick={() => void handleCreateFolder(selectedFolderId)} disabled={!selectedFolderId}>
                New child folder
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {folderTree.map((folderNode) => (
              <FolderNode
                key={folderNode.id}
                node={folderNode as FolderRecord & { children: Array<FolderRecord & { children: never[] }> }}
                depth={0}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
              />
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
            <h3 style={{ margin: 0 }}>Folder contents</h3>
            <input value={query} placeholder="Search within folder" onChange={(event) => setQuery(event.target.value)} />
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
            sortLabel={sortOrder}
            folderLabel={workspace.foldersById.get(selectedFolderId)?.name ?? "Folder"}
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
