import type { BookmarkRecord } from "../types.ts"

interface FetchPageResult {
  bookmarks: Array<Partial<BookmarkRecord>>
  nextCursor: string | null
  failedCount?: number
}

interface FetchAllBookmarksOptions {
  fetchPage: (args: { cursor?: string | null }) => Promise<FetchPageResult>
  limit: number
}

export async function fetchAllBookmarks({ fetchPage, limit }: FetchAllBookmarksOptions) {
  const bookmarks: Array<Partial<BookmarkRecord>> = []
  let failedCount = 0
  let cursor: string | null | undefined = undefined

  while (bookmarks.length < limit) {
    try {
      const page = await fetchPage({ cursor })
      const remaining = limit - bookmarks.length
      bookmarks.push(...page.bookmarks.slice(0, remaining))
      failedCount += page.failedCount ?? 0

      if (!page.nextCursor || bookmarks.length >= limit) {
        break
      }

      cursor = page.nextCursor
    } catch (error) {
      if (!bookmarks.length) {
        throw error
      }

      failedCount += 1
      break
    }
  }

  return {
    bookmarks,
    failedCount
  }
}
