import React from "react"
import { Badge, Button, Checkbox, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core"
import type { BookmarkSortOrder, MultiValueMatchMode, SavedTimeRange } from "../../lib/search/searchBookmarks.ts"
import type { TagRecord } from "../../lib/types.ts"
import { AppIcon } from "../../ui/icons.tsx"

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
  bulkTagId: string
  onBulkTagIdChange: (tagId: string) => void
  onBulkTag: () => void
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
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as MultiValueMatchMode)}
      style={{
        height: 30,
        borderRadius: 8,
        border: "1px solid #e4e4e7",
        padding: "0 8px",
        background: "#ffffff"
      }}>
      <option value="any">Match any</option>
      <option value="all">Match all</option>
    </select>
  )
}

const chipLabelStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "8px 10px",
  border: "1px solid #e4e4e7",
  borderRadius: 8,
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
  bulkTagId,
  onBulkTagIdChange,
  onBulkTag,
  isSavingTag,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onClearFilters
}: InboxWorkbenchToolbarProps) {
  const selectionDisabled = selectedCount === 0
  const advancedFilterCount = selectedAuthorHandles.length + selectedTagIds.length
  const hasActiveFilters = Boolean(
    query ||
      selectedAuthorHandles.length ||
      selectedTagIds.length ||
      selectedPublishedDate ||
      onlyWithMedia ||
      onlyLongform ||
      timeRange !== "all"
  )
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
      <Paper p="sm" radius="md" withBorder style={{ background: "#ffffff" }}>
        <Stack gap="sm">
          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Text fw={600} size="sm">
                Source queue
              </Text>
              <Badge variant="light" color="dark">
                {resultCount} visible
              </Badge>
              <Badge variant="light" color="gray">
                {totalCount} in queue
              </Badge>
              {selectedCount ? (
                <Badge variant="light" color="blue">
                  {selectedCount} selected
                </Badge>
              ) : null}
            </Group>

            <Button type="button" variant="light" color="gray" size="sm" leftSection={<AppIcon name="filter" size={15} />} onClick={onToggleAdvancedFilters}>
              {showAdvancedFilters ? "Hide filters" : `More filters${advancedFilterCount ? ` (${advancedFilterCount})` : ""}`}
            </Button>
          </Group>

          <Group align="end" gap="sm" wrap="wrap">
            <div style={{ display: "grid", gap: 4, flex: "1 1 280px", minWidth: 220 }}>
              <Text size="xs" fw={600} c="dimmed">
                Search
              </Text>
              <TextInput
                type="search"
                value={query}
                placeholder="Search source material"
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                leftSection={<AppIcon name="search" size={16} />}
              />
            </div>

            <NativeSelect value={sortOrder} onChange={(event) => onSortOrderChange(event.currentTarget.value as BookmarkSortOrder)} label="Sort" style={{ minWidth: 152 }}>
              <option value="saved-desc">Newest saved</option>
              <option value="saved-asc">Oldest saved</option>
              <option value="created-desc">Newest on X</option>
              <option value="likes-desc">Most likes</option>
            </NativeSelect>

            <NativeSelect value={timeRange} onChange={(event) => onTimeRangeChange(event.currentTarget.value as SavedTimeRange)} label="Saved time" style={{ minWidth: 140 }}>
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </NativeSelect>
          </Group>

          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              {publishedDateLabel ? (
                <Badge variant="light" color="blue">
                  {publishedDateLabel}
                </Badge>
              ) : null}
            </Group>

            <Group gap="sm" wrap="wrap">
              <Checkbox size="sm" checked={onlyWithMedia} label="Only with media" onChange={(event) => onOnlyWithMediaChange(event.currentTarget.checked)} />
              <Checkbox size="sm" checked={onlyLongform} label="Only longform" onChange={(event) => onOnlyLongformChange(event.currentTarget.checked)} />
              <Button type="button" size="sm" variant="subtle" color="gray" onClick={onSelectAllVisible} disabled={!resultCount}>
                Select all visible
              </Button>
              <Button type="button" size="sm" variant="subtle" color="gray" onClick={onClearFilters} disabled={!hasActiveFilters && !selectedCount}>
                Clear filters
              </Button>
            </Group>
          </Group>

          {publishedDateLabel ? (
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                Focused published date: {publishedDateLabel}
              </Text>
              <Button type="button" size="compact-sm" variant="subtle" color="gray" onClick={onClearPublishedDate}>
                Clear date focus
              </Button>
            </Group>
          ) : null}

          {showAdvancedFilters ? (
            <Paper p="md" radius="md" withBorder style={{ background: "#fafafa" }}>
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <div style={{ display: "grid", gap: 8 }}>
                    <Group justify="space-between" align="center">
                      <Text fw={600} size="sm">
                        Author filters
                      </Text>
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
                          <Checkbox checked={selectedAuthorHandles.includes(author.handle)} onChange={() => onToggleAuthor(author.handle)} />
                          <span>
                            {author.label} ({author.count})
                          </span>
                        </label>
                      ))}
                    </Group>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <Group justify="space-between" align="center">
                      <Text fw={600} size="sm">
                        Tag filters
                      </Text>
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
                          <Checkbox checked={selectedTagIds.includes(tag.id)} onChange={() => onToggleTag(tag.id)} />
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
      </Paper>

      {selectedCount ? (
        <Paper p="md" radius="md" withBorder style={{ background: "#ffffff" }}>
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="xs" wrap="wrap">
                <Badge variant="filled" color="dark">
                  {selectedCount} selected
                </Badge>
                <Text size="sm" c="dimmed">
                  Batch actions stay scoped to the current inbox view.
                </Text>
              </Group>
              <Button type="button" variant="subtle" color="gray" onClick={onClearSelection} disabled={selectionDisabled}>
                Clear selection
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <NativeSelect label="Tag selected sources with" value={bulkTagId} onChange={(event) => onBulkTagIdChange(event.currentTarget.value)}>
                <option value="">Select a tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" color="dark" onClick={onBulkTag} disabled={!bulkTagId || isSavingTag} style={{ alignSelf: "end" }}>
                Tag sources
              </Button>
            </SimpleGrid>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  )
}
