import React from "react"

interface SearchBarProps {
  query: string
  onQueryChange: (query: string) => void
}

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <label>
      Search
      <input
        type="search"
        value={query}
        placeholder="Search bookmarks"
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </label>
  )
}
