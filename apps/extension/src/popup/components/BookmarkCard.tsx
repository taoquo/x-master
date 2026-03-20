import React from "react"
import { Badge, Button, Card, Checkbox, Group, Image, Stack, Text, Title } from "@mantine/core"
import type { BookmarkRecord } from "../../lib/types.ts"

interface BookmarkCardProps {
  bookmark: BookmarkRecord
  isSelected: boolean
  onSelect: (bookmarkId: string) => void
  selectionEnabled?: boolean
  isChecked?: boolean
  onToggleChecked?: (bookmarkId: string) => void
}

export function BookmarkCard({
  bookmark,
  isSelected,
  onSelect,
  selectionEnabled = false,
  isChecked = false,
  onToggleChecked
}: BookmarkCardProps) {
  const previewMedia = bookmark.media?.[0]
  const previewText = bookmark.text.length > 160 ? `${bookmark.text.slice(0, 160)}...` : bookmark.text

  return (
    <Card
      component="article"
      padding="lg"
      style={{
        borderColor: isSelected ? "#1f2937" : undefined
      }}>
      {selectionEnabled ? (
        <Checkbox
          checked={isChecked}
          label="Select"
          onChange={() => onToggleChecked?.(bookmark.tweetId)}
        />
      ) : null}
      <Stack gap="sm">
        <div>
          <Title order={3}>{bookmark.authorName}</Title>
          <Text c="dimmed">@{bookmark.authorHandle}</Text>
        </div>
        <Text lineClamp={4}>{previewText}</Text>
        <Group gap="xs">
          <Badge variant="light">Saved: {bookmark.savedAt}</Badge>
          <Badge variant="light" color="gray">
            On X: {bookmark.createdAtOnX}
          </Badge>
        </Group>
        <Text size="sm">
          Likes: {bookmark.metrics?.likes ?? 0} Retweets: {bookmark.metrics?.retweets ?? 0} Replies: {bookmark.metrics?.replies ?? 0}
        </Text>
      {previewMedia ? (
          <figure style={{ margin: 0 }}>
            <Image src={previewMedia.url} alt={previewMedia.altText ?? "Bookmark media preview"} radius="md" />
            <Text component="figcaption" size="sm" c="dimmed" mt="xs">
              {bookmark.media?.length ?? 0} media item(s)
            </Text>
          </figure>
      ) : null}
        <Button type="button" variant={isSelected ? "filled" : "light"} aria-pressed={isSelected} onClick={() => onSelect(bookmark.tweetId)}>
          {isSelected ? "Selected" : "View details"}
        </Button>
      </Stack>
    </Card>
  )
}
