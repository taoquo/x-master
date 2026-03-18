import React from "react"
import { INBOX_FOLDER_ID } from "../../lib/storage/foldersStore.ts"
import { useWorkspaceData } from "../hooks/useWorkspaceData.ts"

interface DashboardPageProps {
  onNavigate: (section: "dashboard" | "inbox" | "tags") => void
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <section
      style={{
        display: "grid",
        gap: 6,
        padding: 16,
        border: "1px solid #d7e3ee",
        borderRadius: 14,
        background: "#ffffff"
      }}>
      <p style={{ margin: 0, color: "#52606d", fontSize: 13 }}>{label}</p>
      <strong style={{ fontSize: 28 }}>{value}</strong>
    </section>
  )
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const workspace = useWorkspaceData()
  const inboxCount = workspace.bookmarkFolders.filter((bookmarkFolder) => bookmarkFolder.folderId === INBOX_FOLDER_ID).length

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 28 }}>Dashboard</h2>
        <p style={{ margin: 0, color: "#52606d" }}>Monitor sync health, inbox flow, and recent activity before jumping into the Inbox workbench.</p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16
        }}>
        <StatCard label="Sync status" value={workspace.summary.status} />
        <StatCard label="Bookmarks" value={String(workspace.bookmarks.length)} />
        <StatCard label="Inbox" value={String(inboxCount)} />
        <StatCard label="Folders / Tags" value={`${workspace.folders.length} / ${workspace.tags.length}`} />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(260px, 0.8fr)",
          gap: 16
        }}>
        <section
          style={{
            display: "grid",
            gap: 12,
            padding: 18,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff"
          }}>
          <div>
            <h3 style={{ margin: 0 }}>Save heatmap</h3>
            <p style={{ margin: "6px 0 0", color: "#52606d" }}>Bookmark saves over the recent window.</p>
          </div>
          <div
            style={{
              minHeight: 220,
              borderRadius: 12,
              border: "1px dashed #c9d4e0",
              background:
                "linear-gradient(90deg, rgba(72,101,129,0.08) 1px, transparent 1px) 0 0 / 32px 100%, linear-gradient(rgba(72,101,129,0.08) 1px, transparent 1px) 0 0 / 100% 32px"
            }}
          />
        </section>

        <section
          style={{
            display: "grid",
            gap: 12,
            padding: 18,
            border: "1px solid #d7e3ee",
            borderRadius: 16,
            background: "#ffffff"
          }}>
          <div>
            <h3 style={{ margin: 0 }}>Quick actions</h3>
            <p style={{ margin: "6px 0 0", color: "#52606d" }}>Use Inbox for folder organization and Tags for cross-cutting review.</p>
          </div>
          <button type="button" onClick={() => onNavigate("inbox")}>
            Open Inbox
          </button>
          <button type="button" onClick={() => onNavigate("tags")}>
            Open Tags
          </button>
        </section>
      </section>
    </div>
  )
}
