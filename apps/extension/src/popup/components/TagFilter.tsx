import React from "react"
import type { TagRecord } from "../../lib/types.ts"

interface TagFilterProps {
  tags: TagRecord[]
  selectedTagIds: string[]
  onToggleTag: (tagId: string) => void
}

export function TagFilter({ tags, selectedTagIds, onToggleTag }: TagFilterProps) {
  return (
    <section>
      <h3>Filter by tags</h3>
      {!tags.length ? <p>No tags available.</p> : null}
      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id)

        return (
          <label key={tag.id}>
            <input type="checkbox" checked={isSelected} onChange={() => onToggleTag(tag.id)} />
            {tag.name}
          </label>
        )
      })}
    </section>
  )
}
