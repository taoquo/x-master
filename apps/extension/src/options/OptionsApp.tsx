import React, { useMemo, useState } from "react"
import { DashboardPage } from "./pages/DashboardPage.tsx"
import { InboxPage } from "./pages/InboxPage.tsx"
import { TagsPage } from "./pages/TagsPage.tsx"

type OptionsSection = "dashboard" | "inbox" | "tags"

const NAV_ITEMS: Array<{ id: OptionsSection; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inbox", label: "Inbox" },
  { id: "tags", label: "Tags" }
]

export function OptionsApp() {
  const [section, setSection] = useState<OptionsSection>("dashboard")

  const content = useMemo(() => {
    switch (section) {
      case "inbox":
        return <InboxPage />
      case "tags":
        return <TagsPage />
      case "dashboard":
      default:
        return <DashboardPage onNavigate={setSection} />
    }
  }, [section])

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "260px minmax(0, 1fr)",
        background: "#eef4f8",
        color: "#102a43"
      }}>
      <aside
        style={{
          display: "grid",
          alignContent: "start",
          gap: 12,
          padding: 24,
          borderRight: "1px solid #d7e3ee",
          background: "#ffffff"
        }}>
        <header style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>X Bookmark Manager</h1>
          <p style={{ margin: 0, color: "#52606d" }}>A workspace for syncing, triaging, and organizing bookmarks.</p>
        </header>

        <nav style={{ display: "grid", gap: 8 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === section
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: isActive ? "1px solid #486581" : "1px solid #d9e2ec",
                  background: isActive ? "#e3f2fd" : "#ffffff",
                  textAlign: "left",
                  fontWeight: isActive ? 600 : 500
                }}>
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <section
        style={{
          minWidth: 0,
          minHeight: "100vh",
          padding: 24,
          boxSizing: "border-box"
        }}>
        {content}
      </section>
    </main>
  )
}
