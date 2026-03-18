import React, { useEffect, useMemo, useState } from "react"
import type { FolderRecord, BookmarkRecord, TagRecord } from "../../lib/types.ts"

interface InboxBookmarkDetailDrawerProps {
  bookmark: BookmarkRecord | null
  currentFolder: FolderRecord | null
  availableFolders: FolderRecord[]
  tags: TagRecord[]
  availableTags: TagRecord[]
  onCreateFolder: (name: string, parentId?: string) => Promise<void> | void
  onMoveToFolder: (folderId: string) => Promise<void> | void
  onCreateTag: (name: string) => Promise<void> | void
  onAttachTag: (tagId: string) => Promise<void> | void
  onDetachTag: (tagId: string) => Promise<void> | void
  isSaving: boolean
}

function sectionCardStyle() {
  return {
    display: "grid",
    gap: 10,
    padding: 14,
    border: "1px solid #dde7f0",
    borderRadius: 12,
    background: "#ffffff"
  } as const
}

export function InboxBookmarkDetailDrawer({
  bookmark,
  currentFolder,
  availableFolders,
  tags,
  availableTags,
  onCreateFolder,
  onMoveToFolder,
  onCreateTag,
  onAttachTag,
  onDetachTag,
  isSaving
}: InboxBookmarkDetailDrawerProps) {
  const [newTagName, setNewTagName] = useState("")
  const [selectedAvailableTagId, setSelectedAvailableTagId] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState(currentFolder?.id ?? "")
  const hasMedia = Array.isArray(bookmark?.media) && bookmark.media.length > 0

  const selectableTags = useMemo(() => {
    const attachedTagIds = new Set(tags.map((tag) => tag.id))
    return availableTags.filter((tag) => !attachedTagIds.has(tag.id))
  }, [availableTags, tags])

  useEffect(() => {
    setSelectedFolderId(currentFolder?.id ?? availableFolders[0]?.id ?? "")
  }, [availableFolders, currentFolder])

  if (!bookmark) {
    return (
      <aside
        style={{
          minHeight: 0,
          display: "grid",
          alignContent: "start",
          gap: 16,
          padding: 16,
          border: "1px solid #d7e3ee",
          borderRadius: 16,
          background: "#ffffff"
        }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 20 }}>Details</h3>
          <p style={{ margin: 0, color: "#52606d" }}>Select a bookmark to inspect it and organize it without leaving the table.</p>
        </div>
        <div
          style={{
            border: "1px dashed #c9d4e0",
            borderRadius: 12,
            padding: 16,
            background: "#f7fafc",
            color: "#52606d"
          }}>
          No bookmark selected.
        </div>
      </aside>
    )
  }

  async function handleCreateTag() {
    const trimmedName = newTagName.trim()
    if (!trimmedName) {
      return
    }

    await onCreateTag(trimmedName)
    setNewTagName("")
  }

  async function handleAttachTag() {
    if (!selectedAvailableTagId) {
      return
    }

    await onAttachTag(selectedAvailableTagId)
    setSelectedAvailableTagId("")
  }

  async function handleMoveToFolder() {
    if (!selectedFolderId) {
      return
    }

    await onMoveToFolder(selectedFolderId)
  }

  async function handleCreateFolder() {
    const trimmedName = newFolderName.trim()
    if (!trimmedName) {
      return
    }

    await onCreateFolder(trimmedName, currentFolder?.id)
    setNewFolderName("")
  }

  return (
    <aside
      style={{
        minHeight: 0,
        display: "grid",
        alignContent: "start",
        gap: 16,
        padding: 16,
        border: "1px solid #d7e3ee",
        borderRadius: 16,
        background: "#ffffff",
        overflowY: "auto"
      }}>
      <header style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 22 }}>{bookmark.authorName}</h3>
            <p style={{ margin: "4px 0 0", color: "#52606d" }}>@{bookmark.authorHandle}</p>
          </div>
          <a href={bookmark.tweetUrl} target="_blank" rel="noreferrer">
            Open on X
          </a>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            fontSize: 13,
            color: "#52606d"
          }}>
          <span>Saved: {bookmark.savedAt}</span>
          <span>Created: {bookmark.createdAtOnX}</span>
          <span>Likes: {bookmark.metrics?.likes ?? 0}</span>
          <span>Retweets: {bookmark.metrics?.retweets ?? 0}</span>
          <span>Replies: {bookmark.metrics?.replies ?? 0}</span>
          <span>{currentFolder?.name ?? "Inbox"}</span>
        </div>
        <p
          style={{
            margin: 0,
            color: "#334e68",
            lineHeight: 1.5
          }}>
          {bookmark.text.trim().length > 220 ? `${bookmark.text.trim().slice(0, 220)}...` : bookmark.text.trim()}
        </p>
      </header>

      <section style={sectionCardStyle()}>
        <h4 style={{ margin: 0 }}>Folder</h4>
        <p style={{ margin: 0 }}>Current folder: {currentFolder?.name ?? "Inbox"}</p>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Move to folder</span>
          <select value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)} disabled={isSaving}>
            {availableFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void handleMoveToFolder()} disabled={isSaving || !selectedFolderId}>
          Move bookmark
        </button>
        <label style={{ display: "grid", gap: 4 }}>
          <span>New child folder</span>
          <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} />
        </label>
        <button type="button" onClick={() => void handleCreateFolder()} disabled={isSaving || !newFolderName.trim()}>
          Create child folder
        </button>
      </section>

      <section style={sectionCardStyle()}>
        <h4 style={{ margin: 0 }}>Tags</h4>
        {!tags.length ? <p style={{ margin: 0, color: "#52606d" }}>No tags yet.</p> : null}
        {tags.map((tag) => (
          <div
            key={tag.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "8px 10px",
              border: "1px solid #e6edf5",
              borderRadius: 10
            }}>
            <span>{tag.name}</span>
            <button type="button" onClick={() => void onDetachTag(tag.id)} disabled={isSaving}>
              Remove
            </button>
          </div>
        ))}
        <label style={{ display: "grid", gap: 4 }}>
          <span>Existing tag</span>
          <select
            value={selectedAvailableTagId}
            onChange={(event) => setSelectedAvailableTagId(event.target.value)}
            disabled={isSaving || !selectableTags.length}>
            <option value="">Select a tag</option>
            {selectableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void handleAttachTag()} disabled={isSaving || !selectedAvailableTagId}>
          Add tag
        </button>
        <label style={{ display: "grid", gap: 4 }}>
          <span>New tag</span>
          <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} />
        </label>
        <button type="button" onClick={() => void handleCreateTag()} disabled={isSaving || !newTagName.trim()}>
          Create tag
        </button>
      </section>

      <section style={sectionCardStyle()}>
        <h4 style={{ margin: 0 }}>Text</h4>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{bookmark.text}</p>
      </section>

      {hasMedia ? (
        <section style={sectionCardStyle()}>
          <h4 style={{ margin: 0 }}>Media</h4>
          {bookmark.media?.map((item, index) => (
            <figure
              key={`${item.url}-${index}`}
              style={{
                margin: 0,
                border: "1px solid #dde7f0",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff"
              }}>
              <img
                src={item.url}
                alt={item.altText ?? `Bookmark media ${index + 1}`}
                width="320"
                style={{ display: "block", width: "100%", maxWidth: 360, objectFit: "cover" }}
              />
              <figcaption style={{ padding: "8px 12px", fontSize: 13, color: "#52606d" }}>{item.type}</figcaption>
            </figure>
          ))}
        </section>
      ) : null}
    </aside>
  )
}
