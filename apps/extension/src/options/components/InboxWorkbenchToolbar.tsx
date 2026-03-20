import React from "react"
import { Badge, Button, Card, Checkbox, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core"
import type { BookmarkSortOrder, MultiValueMatchMode, SavedTimeRange } from "../../lib/search/searchBookmarks.ts"
import type { FolderRecord, TagRecord } from "../../lib/types.ts"

interface AuthorOption {
  handle: string
  label: string
  count: number
}

interface InboxWorkbenchToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  sortOrder: BookmarkSortOrder
  onSortOrderChange: (sortOrder: BookmarkSortOrder) => void
  timeRange: SavedTimeRange
  onTimeRangeChange: (timeRange: SavedTimeRange) => void
  selectedPublishedDate?: string
  onClearPublishedDate: () => void
  onlyWithMedia: boolean
  onOnlyWithMediaChange: (value: boolean) => void
  onlyLongform: boolean
  onOnlyLongformChange: (value: boolean) => void
  authorOptions: AuthorOption[]
  selectedAuthorHandles: string[]
  authorMatchMode: MultiValueMatchMode
  onToggleAuthor: (authorHandle: string) => void
  onAuthorMatchModeChange: (matchMode: MultiValueMatchMode) => void
  tags: TagRecord[]
  selectedTagIds: string[]
  tagMatchMode: MultiValueMatchMode
  onToggleTag: (tagId: string) => void
  onTagMatchModeChange: (matchMode: MultiValueMatchMode) => void
  resultCount: number
  totalCount: number
  selectedCount: number
  onSelectAllVisible: () => void
  onClearSelection: () => void
  bulkFolderId: string
  onBulkFolderIdChange: (folderId: string) => void
  bulkTagId: string
  onBulkTagIdChange: (tagId: string) => void
  folders: FolderRecord[]
  onBulkMove: () => void
  onBulkTag: () => void
  isSavingFolder: boolean
  isSavingTag: boolean
  showAdvancedFilters: boolean
  onToggleAdvancedFilters: () => void
  onClearFilters: () => void
}

function renderMatchModeControl({
  id,
  value,
  onChange
}: {
  id: string
  value: MultiValueMatchMode
  onChange: (nextValue: MultiValueMatchMode) => void
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as MultiValueMatchMode)}>
      <option value="any">Match any</option>
      <option value="all">Match all</option>
    </select>
  )
}

const fieldLabelStyle = { display: "grid", gap: 6 } as const
const chipLabelStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "6px 10px",
  border: "1px solid #d9e2ec",
  borderRadius: 999,
  background: "#ffffff"
} as const

export function InboxWorkbenchToolbar({
  query,
  onQueryChange,
  sortOrder,
  onSortOrderChange,
  timeRange,
  onTimeRangeChange,
  selectedPublishedDate,
  onClearPublishedDate,
  onlyWithMedia,
  onOnlyWithMediaChange,
  onlyLongform,
  onOnlyLongformChange,
  authorOptions,
  selectedAuthorHandles,
  authorMatchMode,
  onToggleAuthor,
  onAuthorMatchModeChange,
  tags,
  selectedTagIds,
  tagMatchMode,
  onToggleTag,
  onTagMatchModeChange,
  resultCount,
  totalCount,
  selectedCount,
  onSelectAllVisible,
  onClearSelection,
  bulkFolderId,
  onBulkFolderIdChange,
  bulkTagId,
  onBulkTagIdChange,
  folders,
  onBulkMove,
  onBulkTag,
  isSavingFolder,
  isSavingTag,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onClearFilters
}: InboxWorkbenchToolbarProps) {
  const selectionDisabled = selectedCount === 0
  const advancedFilterCount = selectedAuthorHandles.length + selectedTagIds.length
  const hasActiveFilters = Boolean(query || selectedAuthorHandles.length || selectedTagIds.length || selectedPublishedDate || onlyWithMedia || onlyLongform || timeRange !== "all")
  const publishedDateLabel = selectedPublishedDate
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(`${selectedPublishedDate}T00:00:00.000Z`))
    : null

  return (
    <Stack gap="sm">
      <Card
        padding="md"
        style={{
          background: "rgba(255,255,255,0.96)"
        }}>
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <label style={{ ...fieldLabelStyle, flex: "1 1 320px", minWidth: 260 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Search</span>
              <TextInput type="search" value={query} placeholder="Search bookmarks" onChange={(event) => onQueryChange(event.currentTarget.value)} />
            </label>

            <label style={{ ...fieldLabelStyle, minWidth: 160 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Sort</span>
              <NativeSelect value={sortOrder} onChange={(event) => onSortOrderChange(event.currentTarget.value as BookmarkSortOrder)}>
                <option value="saved-desc">Newest saved</option>
                <option value="saved-asc">Oldest saved</option>
                <option value="created-desc">Newest on X</option>
                <option value="likes-desc">Most likes</option>
              </NativeSelect>
            </label>

            <label style={{ ...fieldLabelStyle, minWidth: 148 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Saved time</span>
              <NativeSelect value={timeRange} onChange={(event) => onTimeRangeChange(event.currentTarget.value as SavedTimeRange)}>
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </NativeSelect>
            </label>

            <Button type="button" variant="light" onClick={onToggleAdvancedFilters}>
              {showAdvancedFilters ? "Hide filters" : `More filters${advancedFilterCount ? ` (${advancedFilterCount})` : ""}`}
            </Button>
          </Group>

          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="ocean">
                {resultCount} visible
              </Badge>
              <Badge variant="light" color="gray">
                {totalCount} total
              </Badge>
              {publishedDateLabel ? (
                <Badge variant="light" color="ocean">
                  {publishedDateLabel}
                </Badge>
              ) : null}
            </Group>

            <Group gap="sm" wrap="wrap">
              <Checkbox checked={onlyWithMedia} label="Only with media" onChange={(event) => onOnlyWithMediaChange(event.currentTarget.checked)} />
              <Checkbox checked={onlyLongform} label="Only longform" onChange={(event) => onOnlyLongformChange(event.currentTarget.checked)} />
              <Button type="button" variant="subtle" onClick={onSelectAllVisible} disabled={!resultCount}>
                Select all visible
              </Button>
              <Button type="button" variant="subtle" onClick={onClearFilters} disabled={!hasActiveFilters && !selectedCount}>
                Clear filters
              </Button>
            </Group>
          </Group>

          {publishedDateLabel ? (
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                Focused published date: {publishedDateLabel}
              </Text>
              <Button type="button" size="xs" variant="subtle" onClick={onClearPublishedDate}>
                Clear date focus
              </Button>
            </Group>
          ) : null}

          {showAdvancedFilters ? (
            <Paper p="md" radius="lg" withBorder bg="slate.0">
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <div style={{ display: "grid", gap: 8 }}>
                    <Group justify="space-between" align="center">
                      <Text fw={600}>Author filters</Text>
                      {renderMatchModeControl({
                        id: "author-match-mode",
                        value: authorMatchMode,
                        onChange: onAuthorMatchModeChange
                      })}
                    </Group>
                    {!authorOptions.length ? <Text c="dimmed">No authors available.</Text> : null}
                    <Group gap="sm" wrap="wrap">
                      {authorOptions.map((author) => (
                        <label key={author.handle} style={chipLabelStyle}>
                          <Checkbox type="checkbox" checked={selectedAuthorHandles.includes(author.handle)} onChange={() => onToggleAuthor(author.handle)} />
                          <span>
                            {author.label} ({author.count})
                          </span>
                        </label>
                      ))}
                    </Group>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <Group justify="space-between" align="center">
                      <Text fw={600}>Tag filters</Text>
                      {renderMatchModeControl({
                        id: "tag-match-mode",
                        value: tagMatchMode,
                        onChange: onTagMatchModeChange
                      })}
                    </Group>
                    {!tags.length ? <Text c="dimmed">No tags available.</Text> : null}
                    <Group gap="sm" wrap="wrap">
                      {tags.map((tag) => (
                        <label key={tag.id} style={chipLabelStyle}>
                          <Checkbox type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => onToggleTag(tag.id)} />
                          <span>{tag.name}</span>
                        </label>
                      ))}
                    </Group>
                  </div>
                </SimpleGrid>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Card>

      {selectedCount ? (
        <Paper
          p="md"
          radius="xl"
          withBorder
          style={{ background: "#ffffff" }}>
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="xs" wrap="wrap">
                <Badge variant="filled" color="dark">
                  {selectedCount} selected
                </Badge>
                <Text size="sm" c="dimmed">
                  Batch actions stay scoped to the current table view.
                </Text>
              </Group>
              <Button type="button" variant="subtle" onClick={onClearSelection} disabled={selectionDisabled}>
                Clear selection
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
              <label style={fieldLabelStyle}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Move selected to</span>
                <NativeSelect value={bulkFolderId} onChange={(event) => onBulkFolderIdChange(event.currentTarget.value)}>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button type="button" onClick={onBulkMove} disabled={!bulkFolderId || isSavingFolder} style={{ alignSelf: "end" }}>
                Move selected
              </Button>

              <label style={fieldLabelStyle}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Tag selected with</span>
                <NativeSelect value={bulkTagId} onChange={(event) => onBulkTagIdChange(event.currentTarget.value)}>
                  <option value="">Select a tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button type="button" onClick={onBulkTag} disabled={!bulkTagId || isSavingTag} style={{ alignSelf: "end" }}>
                Apply tag
              </Button>
            </SimpleGrid>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  )
}
