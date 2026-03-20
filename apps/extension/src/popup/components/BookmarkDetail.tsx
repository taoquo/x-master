import React, { useEffect, useMemo, useState } from "react"
import { Anchor, Badge, Button, Card, Group, Image, NativeSelect, Stack, Text, TextInput, Title } from "@mantine/core"
import type { FolderRecord, BookmarkRecord, TagRecord } from "../../lib/types.ts"
import { EmptyState } from "../../ui/components.tsx"
import { ExtensionUiProvider } from "../../ui/provider.tsx"

interface BookmarkDetailProps {
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

export function BookmarkDetail({
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
}: BookmarkDetailProps) {
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
      <ExtensionUiProvider>
        <Stack gap="md">
          <div>
            <Title order={2}>Details</Title>
            <Text c="dimmed">Select a bookmark from the list to inspect metadata, media, and tags.</Text>
          </div>
          <EmptyState title="No bookmark selected." description="Select a bookmark from the list to inspect metadata, media, and tags." />
        </Stack>
      </ExtensionUiProvider>
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
    <ExtensionUiProvider>
      <Stack gap="md">
        <Stack gap="xs">
          <Group justify="space-between" align="start">
            <div>
              <Title order={2}>{bookmark.authorName}</Title>
              <Text c="dimmed">@{bookmark.authorHandle}</Text>
            </div>
            <Anchor href={bookmark.tweetUrl} target="_blank" rel="noreferrer">
              Open on X
            </Anchor>
          </Group>
          <Group gap="xs">
            <Badge variant="light">Saved: {bookmark.savedAt}</Badge>
            <Badge variant="light">Created: {bookmark.createdAtOnX}</Badge>
            <Badge variant="light">Likes: {bookmark.metrics?.likes ?? 0}</Badge>
            <Badge variant="light">Retweets: {bookmark.metrics?.retweets ?? 0}</Badge>
            <Badge variant="light">Replies: {bookmark.metrics?.replies ?? 0}</Badge>
            <Badge color={bookmark.text.trim().length > 280 ? "sand" : "gray"} variant="light">
              {bookmark.text.trim().length > 280 ? "Longform bookmark" : "Standard bookmark"}
            </Badge>
          </Group>
        </Stack>
        <Card padding="lg">
          <Stack gap="xs">
            <Title order={3}>Text</Title>
            <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{bookmark.text}</Text>
          </Stack>
        </Card>
      {hasMedia ? (
        <Card padding="lg">
          <Stack gap="sm">
            <Title order={3}>Media</Title>
          {bookmark.media?.map((item, index) => (
            <figure
              key={`${item.url}-${index}`}
              style={{ margin: 0 }}>
              <Image
                src={item.url}
                alt={item.altText ?? `Bookmark media ${index + 1}`}
                radius="md"
              />
              <Text component="figcaption" size="sm" c="dimmed" mt="xs">
                {item.type}
              </Text>
            </figure>
          ))}
          </Stack>
        </Card>
      ) : null}
      <Card padding="lg">
        <Stack gap="sm">
          <Title order={3}>Folder</Title>
          <Text>Current folder: {currentFolder?.name ?? "Inbox"}</Text>
          <label>
            Move to folder
            <NativeSelect value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.currentTarget.value)} disabled={isSaving}>
              {availableFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button type="button" onClick={() => void handleMoveToFolder()} disabled={isSaving || !selectedFolderId}>
            Move bookmark
          </Button>
          <TextInput label="New child folder" value={newFolderName} onChange={(event) => setNewFolderName(event.currentTarget.value)} />
          <Button type="button" variant="light" onClick={() => void handleCreateFolder()} disabled={isSaving || !newFolderName.trim()}>
            Create child folder
          </Button>
        </Stack>
      </Card>
      <Card padding="lg">
        <Stack gap="sm">
          <Title order={3}>Tags</Title>
          {!tags.length ? <Text>No tags yet.</Text> : null}
        {tags.map((tag) => (
          <Group
            key={tag.id}
            justify="space-between"
            align="center">
            <Text>{tag.name}</Text>
            <Button type="button" variant="subtle" onClick={() => void onDetachTag(tag.id)} disabled={isSaving}>
              Remove
            </Button>
          </Group>
        ))}
          <label>
            Existing tag
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
          <TextInput label="New tag" value={newTagName} onChange={(event) => setNewTagName(event.currentTarget.value)} />
          <Button type="button" variant="light" onClick={() => void handleCreateTag()} disabled={isSaving || !newTagName.trim()}>
            Create tag
          </Button>
        </Stack>
      </Card>
      </Stack>
    </ExtensionUiProvider>
  )
}
