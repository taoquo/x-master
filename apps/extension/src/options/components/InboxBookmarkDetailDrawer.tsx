import React from "react"
import { Drawer } from "@mantine/core"
import type { BookmarkRecord, TagRecord } from "../../lib/types.ts"
import { isUiTestEnv } from "../../ui/testEnv.ts"
import { InboxBookmarkDetailContent } from "./InboxBookmarkDetailContent.tsx"

interface InboxBookmarkDetailDrawerProps {
  opened: boolean
  onClose: () => void
  bookmark: BookmarkRecord | null
  tags: TagRecord[]
  availableTags: TagRecord[]
  onAttachTag: (tagId: string) => Promise<void> | void
  onDetachTag: (tagId: string) => Promise<void> | void
  isSaving: boolean
}

export function InboxBookmarkDetailDrawer({
  opened,
  onClose,
  bookmark,
  tags,
  availableTags,
  onAttachTag,
  onDetachTag,
  isSaving
}: InboxBookmarkDetailDrawerProps) {
  const testEnv = isUiTestEnv()

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={460}
      withinPortal={!testEnv}
      lockScroll={!testEnv}
      trapFocus={!testEnv}
      returnFocus={!testEnv}
      transitionProps={testEnv ? { duration: 0, exitDuration: 0 } : undefined}
      title={null}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.18, blur: 1 }}
      styles={{
        body: {
          padding: 0,
          background: "#fafafa"
        },
        content: {
          background: "#fafafa"
        }
      }}>
      <InboxBookmarkDetailContent
        bookmark={bookmark}
        tags={tags}
        availableTags={availableTags}
        onAttachTag={onAttachTag}
        onDetachTag={onDetachTag}
        isSaving={isSaving}
        onClearSelection={onClose}
      />
    </Drawer>
  )
}
