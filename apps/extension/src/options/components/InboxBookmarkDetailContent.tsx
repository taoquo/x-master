import React, { useMemo, useState } from "react"
import { ActionIcon, Badge, Button, Group, Image, NativeSelect, Stack, Text } from "@mantine/core"
import type { BookmarkRecord, TagRecord } from "../../lib/types.ts"
import { getSourceKindLabel, inferSourceKindFromBookmark } from "../../lib/sourceMaterials.ts"
import { EmptyState } from "../../ui/components.tsx"
import { AppIcon } from "../../ui/icons.tsx"

interface InboxBookmarkDetailContentProps {
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

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date)
}

function getSubject(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "Untitled bookmark"
  }

  const firstSentence = normalized.split(/(?<=[.!?])\s/)[0] ?? normalized
  return firstSentence.length > 72 ? `${firstSentence.slice(0, 69)}...` : firstSentence
}

export function InboxBookmarkDetailContent({
  bookmark,
  tags,
  availableTags,
  onAttachTag,
  onDetachTag,
  isSaving,
  onSelectPrevious,
  onSelectNext,
  hasPrevious = false,
  hasNext = false,
  onClearSelection
}: InboxBookmarkDetailContentProps) {
  const [selectedAvailableTagId, setSelectedAvailableTagId] = useState("")

  const selectableTags = useMemo(() => {
    const attachedTagIds = new Set(tags.map((tag) => tag.id))
    return availableTags.filter((tag) => !attachedTagIds.has(tag.id))
  }, [availableTags, tags])

  if (!bookmark) {
    return <EmptyState title="No source selected." description="Choose a saved post or note from the inbox to inspect the raw content, media, and source-level tagging actions." />
  }

  const currentBookmark = bookmark
  const hasMedia = Array.isArray(currentBookmark.media) && currentBookmark.media.length > 0
  const subject = getSubject(currentBookmark.text)
  const sourceKindLabel = getSourceKindLabel(inferSourceKindFromBookmark(currentBookmark))

  async function handleAttachTag() {
    if (!selectedAvailableTagId) {
      return
    }

    await onAttachTag(selectedAvailableTagId)
    setSelectedAvailableTagId("")
  }

  async function handleCopyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return
    }

    await navigator.clipboard.writeText(currentBookmark.tweetUrl)
  }

  return (
    <Stack gap={0} h="100%" style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e4e4e7", overflow: "hidden" }}>
      <Group justify="space-between" p={8} style={{ borderBottom: "1px solid #e4e4e7" }}>
        <Group gap={8}>
          <ActionIcon component="a" href={currentBookmark.tweetUrl} target="_blank" rel="noreferrer" variant="subtle" color="gray" radius="md" aria-label="Open on X">
            <AppIcon name="external" size={16} />
          </ActionIcon>
          <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Copy link" onClick={() => void handleCopyLink()}>
            <AppIcon name="copy" size={16} />
          </ActionIcon>
          <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Media count" disabled={!hasMedia}>
            <AppIcon name="image" size={16} />
          </ActionIcon>
            <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Like count" disabled={(currentBookmark.metrics?.likes ?? 0) <= 0}>
            <AppIcon name="heart" size={16} />
          </ActionIcon>
        </Group>

        <Group gap={8}>
          <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Previous bookmark" onClick={onSelectPrevious} disabled={!hasPrevious}>
            <AppIcon name="chevron-left" size={16} />
          </ActionIcon>
          <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Next bookmark" onClick={onSelectNext} disabled={!hasNext}>
            <AppIcon name="chevron-right" size={16} />
          </ActionIcon>
          {onClearSelection ? (
            <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Close details" onClick={onClearSelection}>
              <AppIcon name="close" size={16} />
            </ActionIcon>
          ) : null}
        </Group>
      </Group>

      <Group justify="space-between" align="start" p={16} style={{ borderBottom: "1px solid #e4e4e7" }}>
        <Group align="start" gap={16} wrap="nowrap">
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: 42,
              height: 42,
              borderRadius: 999,
              background: "#f4f4f5",
              color: "#18181b",
              fontWeight: 700
            }}>
            {currentBookmark.authorName.slice(0, 1).toUpperCase()}
          </div>

          <Stack gap={6}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Source material
            </Text>
            <Text fw={600} size="sm">
              {currentBookmark.authorName}
            </Text>
            <Text size="xs">{subject}</Text>
            <Text size="xs" c="dimmed">
              @{currentBookmark.authorHandle}
            </Text>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">
          {formatDateTime(currentBookmark.savedAt)}
        </Text>
      </Group>

      <Stack gap="xs" p={14} style={{ borderBottom: "1px solid #e4e4e7" }}>
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="gray">
            Saved {formatDateTime(currentBookmark.savedAt)}
          </Badge>
          <Badge variant="light" color="gray">
            {(currentBookmark.metrics?.likes ?? 0).toLocaleString()} likes
          </Badge>
          <Badge variant="light" color="gray">
            {sourceKindLabel}
          </Badge>
          {hasMedia ? (
            <Badge variant="light" color="blue">
              {currentBookmark.media?.length} media
            </Badge>
          ) : null}
          {tags.map((tag) => (
            <Badge key={tag.id} variant="filled" color="dark">
              {tag.name}
            </Badge>
          ))}
        </Group>
      </Stack>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Stack gap="md" p={16}>
          <Text size="sm" style={{ lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {currentBookmark.text}
          </Text>

          {hasMedia ? (
            <Stack gap="sm">
              {currentBookmark.media?.map((item, index) => (
                <figure key={`${item.url}-${index}`} style={{ margin: 0 }}>
                  <Image src={item.url} alt={item.altText ?? `Bookmark media ${index + 1}`} radius="md" />
                  <Text component="figcaption" size="xs" c="dimmed" mt={6}>
                    {item.type}
                  </Text>
                </figure>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </div>

      <Stack gap="sm" p={14} style={{ borderTop: "1px solid #e4e4e7", background: "#ffffff" }}>
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" fw={500}>
            Tags
          </Text>
          {tags.length ? (
            <Group gap="xs" wrap="wrap">
              {tags.map((tag) => (
                <Button key={tag.id} type="button" size="compact-xs" variant="subtle" color="dark" onClick={() => void onDetachTag(tag.id)} disabled={isSaving}>
                  Remove {tag.name}
                </Button>
              ))}
            </Group>
          ) : (
            <Text size="xs" c="dimmed">
              No tags attached
            </Text>
          )}
        </Group>

        {selectableTags.length ? (
          <Group align="end" wrap="wrap">
            <label style={{ display: "grid", gap: 4, flex: "1 1 220px", minWidth: 180 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>Add existing tag</span>
              <NativeSelect
                value={selectedAvailableTagId}
                onChange={(event) => setSelectedAvailableTagId(event.currentTarget.value)}
                disabled={isSaving}>
                <option value="">Select a tag</option>
                {selectableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <Button type="button" color="dark" onClick={() => void handleAttachTag()} disabled={isSaving || !selectedAvailableTagId}>
              Tag source
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Stack>
  )
}
