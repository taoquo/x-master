import React, { useEffect, useMemo, useState } from "react"
import { Anchor, Badge, Button, Drawer, Group, Image, NativeSelect, Paper, Stack, Text, TextInput, Title } from "@mantine/core"
import type { BookmarkRecord, TagRecord } from "../../lib/types.ts"

interface InboxBookmarkDetailDrawerProps {
  opened: boolean
  onClose: () => void
  bookmark: BookmarkRecord | null
  tags: TagRecord[]
  availableTags: TagRecord[]
  onCreateTag: (name: string) => Promise<void> | void
  onAttachTag: (tagId: string) => Promise<void> | void
  onDetachTag: (tagId: string) => Promise<void> | void
  isSaving: boolean
}

const fieldLabelStyle = { display: "grid", gap: 6 } as const

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date)
}

export function InboxBookmarkDetailDrawer({
  opened,
  onClose,
  bookmark,
  tags,
  availableTags,
  onCreateTag,
  onAttachTag,
  onDetachTag,
  isSaving
}: InboxBookmarkDetailDrawerProps) {
  const [newTagName, setNewTagName] = useState("")
  const [selectedAvailableTagId, setSelectedAvailableTagId] = useState("")
  const hasMedia = Array.isArray(bookmark?.media) && bookmark.media.length > 0

  const selectableTags = useMemo(() => {
    const attachedTagIds = new Set(tags.map((tag) => tag.id))
    return availableTags.filter((tag) => !attachedTagIds.has(tag.id))
  }, [availableTags, tags])

  useEffect(() => {
    if (!opened) {
      setNewTagName("")
      setSelectedAvailableTagId("")
    }
  }, [opened])

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

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={420}
      title={bookmark ? "Bookmark details" : "Details"}
      withCloseButton
      overlayProps={{ backgroundOpacity: 0.2, blur: 1 }}
      styles={{
        body: {
          paddingTop: 0
        }
      }}>
      {bookmark ? (
        <Stack gap="md">
          <Paper p="md" radius="lg" withBorder>
            <Stack gap="sm">
              <Group justify="space-between" align="start" wrap="wrap">
                <div>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Details
                  </Text>
                  <Title order={3}>{bookmark.authorName}</Title>
                  <Text c="dimmed">@{bookmark.authorHandle}</Text>
                </div>
                <Anchor href={bookmark.tweetUrl} target="_blank" rel="noreferrer">
                  Open on X
                </Anchor>
              </Group>

              <Group gap="xs" wrap="wrap">
                <Badge variant="light">Saved {formatDateTime(bookmark.savedAt)}</Badge>
                <Badge variant="light">{bookmark.metrics?.likes ?? 0} likes</Badge>
              </Group>

              <Text c="dark.6" style={{ lineHeight: 1.6 }}>
                {bookmark.text.trim().length > 180 ? `${bookmark.text.trim().slice(0, 180)}...` : bookmark.text.trim()}
              </Text>
            </Stack>
          </Paper>

          <Paper p="md" radius="lg" withBorder>
            <Stack gap="sm">
              <Title order={4}>Tags</Title>
              {!tags.length ? <Text c="dimmed">No tags yet.</Text> : null}
              {tags.map((tag) => (
                <Group key={tag.id} justify="space-between" align="center">
                  <Text>{tag.name}</Text>
                  <Button type="button" variant="subtle" onClick={() => void onDetachTag(tag.id)} disabled={isSaving}>
                    Remove
                  </Button>
                </Group>
              ))}
              <label style={fieldLabelStyle}>
                <span>Existing tag</span>
                <NativeSelect
                  value={selectedAvailableTagId}
                  onChange={(event) => setSelectedAvailableTagId(event.currentTarget.value)}
                  disabled={isSaving || !selectableTags.length}>
                  <option value="">Select a tag</option>
                  {selectableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button type="button" onClick={() => void handleAttachTag()} disabled={isSaving || !selectedAvailableTagId}>
                Add tag
              </Button>
              <label style={fieldLabelStyle}>
                <span>New tag</span>
                <TextInput value={newTagName} onChange={(event) => setNewTagName(event.currentTarget.value)} />
              </label>
              <Button type="button" variant="light" onClick={() => void handleCreateTag()} disabled={isSaving || !newTagName.trim()}>
                Create tag
              </Button>
            </Stack>
          </Paper>

          <Paper p="md" radius="lg" withBorder>
            <Stack gap="sm">
              <Title order={4}>Full text</Title>
              <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{bookmark.text}</Text>
            </Stack>
          </Paper>

          {hasMedia ? (
            <Paper p="md" radius="lg" withBorder>
              <Stack gap="sm">
                <Title order={4}>Media</Title>
                {bookmark.media?.map((item, index) => (
                  <figure key={`${item.url}-${index}`} style={{ margin: 0 }}>
                    <Image src={item.url} alt={item.altText ?? `Bookmark media ${index + 1}`} radius="md" />
                    <Text component="figcaption" size="sm" c="dimmed" mt="xs">
                      {item.type}
                    </Text>
                  </figure>
                ))}
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      ) : null}
    </Drawer>
  )
}
