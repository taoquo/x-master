import React, { useCallback, useMemo, useState } from "react"
import type { InboxRouteState, LibraryRouteState, LibraryView, OptionsSection } from "./lib/navigation.ts"
import { DashboardPage } from "./pages/DashboardPage.tsx"
import { InboxPage } from "./pages/InboxPage.tsx"
import { LibraryPage } from "./pages/LibraryPage.tsx"
import { SettingsPage } from "./pages/SettingsPage.tsx"
import { ExtensionUiProvider } from "../ui/provider.tsx"
import { WorkspaceShell } from "../ui/components.tsx"

const NAV_ITEMS: Array<{ id: OptionsSection; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inbox", label: "Inbox" },
  { id: "library", label: "Library" },
  { id: "settings", label: "Settings" }
]

export function OptionsApp() {
  const [section, setSection] = useState<OptionsSection>("dashboard")
  const [libraryView, setLibraryView] = useState<LibraryView>("all")
  const [libraryRouteState, setLibraryRouteState] = useState<LibraryRouteState | undefined>(undefined)
  const [inboxRouteState, setInboxRouteState] = useState<InboxRouteState | undefined>(undefined)

  const openInbox = useCallback((routeState?: InboxRouteState) => {
    setInboxRouteState(routeState)
    setSection("inbox")
  }, [])

  const handleSelectSection = useCallback((nextSection: OptionsSection) => {
    if (nextSection !== "inbox") {
      setInboxRouteState(undefined)
    } else if (section !== "inbox") {
      setInboxRouteState(undefined)
    }

    if (nextSection !== "library") {
      setLibraryRouteState(undefined)
    }

    setSection(nextSection)
  }, [section])

  const content = useMemo(() => {
    switch (section) {
      case "inbox":
        return <InboxPage initialRouteState={inboxRouteState} />
      case "library":
        return <LibraryPage view={libraryView} onViewChange={setLibraryView} initialRouteState={libraryRouteState} />
      case "settings":
        return <SettingsPage />
      case "dashboard":
      default:
        return <DashboardPage onOpenInbox={openInbox} />
    }
  }, [inboxRouteState, libraryRouteState, libraryView, openInbox, section])

  return (
    <ExtensionUiProvider>
      <WorkspaceShell
        section={section}
        navItems={NAV_ITEMS}
        onSelectSection={handleSelectSection}>
        {content}
      </WorkspaceShell>
    </ExtensionUiProvider>
  )
}
