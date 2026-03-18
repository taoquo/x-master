import React from "react"
import { INBOX_FOLDER_ID, type FolderTreeNode } from "../../lib/storage/foldersStore.ts"

interface InboxFolderNavigationProps {
  folderTree: FolderTreeNode[]
  selectedFolderId?: string
  selectedFolderLabel: string
  visibleCount: number
  totalCount: number
  onSelectFolder: (folderId: string) => void
}

function FolderNode({
  node,
  depth,
  selectedFolderId,
  onSelectFolder
}: {
  node: FolderTreeNode
  depth: number
  selectedFolderId?: string
  onSelectFolder: (folderId: string) => void
}) {
  const isSelected = node.id === selectedFolderId

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button
        type="button"
        onClick={() => onSelectFolder(node.id)}
        style={{
          marginLeft: depth * 14,
          padding: "8px 10px",
          borderRadius: 10,
          border: isSelected ? "1px solid #486581" : "1px solid #d9e2ec",
          background: isSelected ? "#e3f2fd" : "#ffffff",
          textAlign: "left",
          fontWeight: isSelected ? 600 : 500
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

export function InboxFolderNavigation({
  folderTree,
  selectedFolderId,
  selectedFolderLabel,
  visibleCount,
  totalCount,
  onSelectFolder
}: InboxFolderNavigationProps) {
  const nestedFolders = folderTree.filter((folder) => folder.id !== INBOX_FOLDER_ID)
  const inboxSelected = (selectedFolderId ?? INBOX_FOLDER_ID) === INBOX_FOLDER_ID

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
      <header style={{ display: "grid", gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Folders</h3>
        <p style={{ margin: 0, color: "#52606d" }}>Inbox stays first. Folders are the primary way to file work.</p>
      </header>

      <section style={{ display: "grid", gap: 8 }}>
        <button
          type="button"
          onClick={() => onSelectFolder(INBOX_FOLDER_ID)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: inboxSelected ? "1px solid #486581" : "1px solid #d9e2ec",
            background: inboxSelected ? "#e3f2fd" : "#ffffff",
            textAlign: "left",
            fontWeight: inboxSelected ? 600 : 500
          }}>
          Inbox
        </button>
        {nestedFolders.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#52606d", textTransform: "uppercase" }}>Folder tree</p>
            {nestedFolders.map((folderNode) => (
              <FolderNode
                key={folderNode.id}
                node={folderNode}
                depth={0}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section
        style={{
          display: "grid",
          gap: 6,
          padding: 12,
          border: "1px solid #e6edf5",
          borderRadius: 12,
          background: "#f8fbfd"
        }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#52606d", textTransform: "uppercase" }}>Current context</p>
        <p style={{ margin: 0, fontWeight: 600 }}>{selectedFolderLabel}</p>
        <p style={{ margin: 0, color: "#52606d" }}>
          {visibleCount} visible of {totalCount} total bookmarks
        </p>
      </section>
    </aside>
  )
}
