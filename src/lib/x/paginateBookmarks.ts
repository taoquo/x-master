import type { BookmarkRecord } from "../types.ts"

interface FetchPageResult {
  bookmarks: Array<Partial<BookmarkRecord>>
  nextCursor: string | null
  failedCount?: number
}

interface FetchAllBookmarksOptions {
  fetchPage: (args: { cursor?: string | null }) => Promise<FetchPageResult>
  limit?: number
  stopAfterConsecutiveKnownPages?: number
  isExistingBookmark?: (bookmark: Partial<BookmarkRecord>) => boolean
}

export async function fetchAllBookmarks({
  fetchPage,
  limit = Number.POSITIVE_INFINITY,
  stopAfterConsecutiveKnownPages,
  isExistingBookmark
}: FetchAllBookmarksOptions) {
  const bookmarks: Array<Partial<BookmarkRecord>> = []
  let failedCount = 0
  let cursor: string | null | undefined = undefined
  let consecutiveKnownPages = 0

  while (bookmarks.length < limit) {
    try {
      const page = await fetchPage({ cursor })
      const remaining = Number.isFinite(limit) ? limit - bookmarks.length : page.bookmarks.length
      const pageBookmarks = Number.isFinite(limit) ? page.bookmarks.slice(0, remaining) : page.bookmarks
      bookmarks.push(...pageBookmarks)
      failedCount += page.failedCount ?? 0

      if (typeof stopAfterConsecutiveKnownPages === "number" && stopAfterConsecutiveKnownPages > 0) {
        const hasNewBookmark = pageBookmarks.some((bookmark) => !isExistingBookmark?.(bookmark))
        consecutiveKnownPages = hasNewBookmark ? 0 : consecutiveKnownPages + 1
      }

      if (
        !page.nextCursor ||
        page.nextCursor === cursor ||
        bookmarks.length >= limit ||
        consecutiveKnownPages >= (stopAfterConsecutiveKnownPages ?? Number.POSITIVE_INFINITY)
      ) {
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
