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
    <Stack gap={0} h="100%" style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e4e4e7", overflow: "hidden" }}>
      <Group justify="space-between" p={10} style={{ borderBottom: "1px solid #e4e4e7", background: "#fcfcfd" }}>
        <Group gap={8}>
          <ActionIcon component="a" href={currentBookmark.tweetUrl} target="_blank" rel="noreferrer" variant="subtle" color="gray" radius="md" aria-label="Open on X">
            <AppIcon name="external" size={16} />
          </ActionIcon>
          <ActionIcon type="button" variant="subtle" color="gray" radius="md" aria-label="Copy link" onClick={() => void handleCopyLink()}>
            <AppIcon name="copy" size={16} />
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

      <Stack gap="md" p={20} style={{ borderBottom: "1px solid #e4e4e7" }}>
        <Group justify="space-between" align="start" wrap="wrap" gap="md">
          <Group align="start" gap={16} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "grid",
                placeItems: "center",
                width: 48,
                height: 48,
                borderRadius: 999,
                background: "#f4f4f5",
                color: "#18181b",
                fontWeight: 700
              }}>
              {currentBookmark.authorName.slice(0, 1).toUpperCase()}
            </div>

            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="dark">
                  {sourceKindLabel}
                </Badge>
                {(currentBookmark.metrics?.likes ?? 0) > 0 ? (
                  <Badge variant="light" color="gray">
                    {(currentBookmark.metrics?.likes ?? 0).toLocaleString()} likes
                  </Badge>
                ) : null}
                {hasMedia ? (
                  <Badge variant="light" color="blue">
                    {currentBookmark.media?.length} media
                  </Badge>
                ) : null}
              </Group>
              <Text fw={700} size="lg" style={{ lineHeight: 1.25 }}>
                {subject}
              </Text>
              <Group gap={8} wrap="wrap">
                <Text fw={600} size="sm">
                  {currentBookmark.authorName}
                </Text>
                <Text size="sm" c="dimmed">
                  @{currentBookmark.authorHandle}
                </Text>
              </Group>
            </Stack>
          </Group>

          <Text size="xs" c="dimmed">
            Saved {formatDateTime(currentBookmark.savedAt)}
          </Text>
        </Group>

        <Group gap="xs" wrap="wrap">
          {tags.map((tag) => (
            <Badge key={tag.id} variant="filled" color="dark">
              {tag.name}
            </Badge>
          ))}
        </Group>
      </Stack>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#fcfcfd" }}>
        <Stack gap="lg" p={20}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Full source
          </Text>

          <Text size="sm" style={{ lineHeight: 1.8, whiteSpace: "pre-wrap", color: "#18181b" }}>
            {currentBookmark.text}
          </Text>

          {hasMedia ? (
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                Media
              </Text>
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

      <Stack gap="sm" p={16} style={{ borderTop: "1px solid #e4e4e7", background: "#ffffff" }}>
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
