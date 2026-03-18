import type { BookmarkRecord } from "../types.ts"

export function exportBookmarks(bookmarks: BookmarkRecord[]) {
  return JSON.stringify(bookmarks, null, 2)
}
