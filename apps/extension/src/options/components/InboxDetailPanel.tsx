import React from "react"
import type { BookmarkRecord, TagRecord } from "../../lib/types.ts"
import { InboxBookmarkDetailContent } from "./InboxBookmarkDetailContent.tsx"

interface InboxDetailPanelProps {
  bookmark: BookmarkRecord | null
  tags: TagRecord[]
  availableTags: TagRecord[]
  onAttachTag: (tagId: string) => Promise<void> | void
  onDetachTag: (tagId: string) => Promise<void> | void
  isSaving: boolean
  onSelectPrevious?: () => void
  onSelectNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
  onClearSelection?: () => void
}

export function InboxDetailPanel(props: InboxDetailPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <InboxBookmarkDetailContent {...props} />
    </div>
  )
}
