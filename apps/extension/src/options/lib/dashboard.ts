import type { BookmarkRecord, BookmarkTagRecord, SyncSummary, TagRecord } from "../../lib/types.ts"

const HEATMAP_WEEKS = 12
const DAYS_PER_WEEK = 7

export interface DashboardHeatmapCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isFuture: boolean
}

export interface DashboardHeatmapWeek {
  key: string
  days: DashboardHeatmapCell[]
}

export interface DashboardRecommendation {
  title: string
  description: string
  action: "sync" | "inbox" | "library-tags" | "settings"
  actionLabel: string
}

export interface DashboardModel {
  metrics: {
    totalBookmarks: number
    inboxCount: number
    organizedCount: number
    taggedCount: number
    untaggedCount: number
    tagsCount: number
  }
  sync: {
    status: SyncSummary["status"]
    lastSyncedAt?: string
    fetchedCount: number
    insertedCount: number
    updatedCount: number
    failedCount: number
    errorSummary?: string
  }
  pressure: {
    inboxShare: number
    taggedShare: number
    untaggedShare: number
  }
  recent: {
    latestTagName?: string
    savedLast7Days: number
    activeDaysLast7Days: number
  }
  authors: {
    topAuthors: Array<{
      handle: string
      label: string
      count: number
      inboxCount: number
      untaggedCount: number
    }>
  }
  recommendation: DashboardRecommendation
  heatmap: {
    totalPublishedInWindow: number
    busiestDayCount: number
    busiestDayDate?: string
    weeks: DashboardHeatmapWeek[]
  }
}

interface BuildDashboardModelOptions {
  bookmarks: BookmarkRecord[]
  tags: TagRecord[]
  bookmarkTags: BookmarkTagRecord[]
  summary: SyncSummary
  now?: Date
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return startOfUtcDay(next)
}

function startOfUtcWeek(date: Date) {
  const day = date.getUTCDay()
  const diffToMonday = (day + 6) % 7
  return addUtcDays(date, -diffToMonday)
}

function toDateKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10)
}

function toIsoDateKey(value?: string) {
  if (!value) {
    return null
  }

  const directMatch = value.match(/^\d{4}-\d{2}-\d{2}/)
  if (directMatch) {
    return directMatch[0]
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return toDateKey(parsed)
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function pickLatestByCreatedAt<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0]
}

function getHeatLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || maxCount <= 0) {
    return 0
  }

  if (count === maxCount) {
    return 4
  }

  const ratio = count / maxCount
  if (ratio >= 0.7 || count >= 4) {
    return 4
  }

  if (ratio >= 0.45 || count >= 3) {
    return 3
  }

  if (ratio >= 0.2 || count >= 2) {
    return 2
  }

  return 1
}

function buildRecommendation({
  totalBookmarks,
  inboxCount,
  tagsCount,
  summaryStatus,
  failedCount,
  inboxShare
}: {
  totalBookmarks: number
  inboxCount: number
  tagsCount: number
  summaryStatus: SyncSummary["status"]
  failedCount: number
  inboxShare: number
}): DashboardRecommendation {
  if (totalBookmarks === 0) {
    return {
      title: "Run the first sync",
      description: "The workspace is empty. Pull bookmarks in first, then triage from Inbox.",
      action: "sync",
      actionLabel: "Sync now"
    }
  }

  if (summaryStatus === "error" || failedCount > 0) {
    return {
      title: "Resolve sync health before filing more",
      description: "The latest sync had failures. Verify access and refresh the workspace before relying on totals.",
      action: "settings",
      actionLabel: "Open Settings"
    }
  }

  if (inboxCount >= 12 || inboxShare >= 45) {
    return {
      title: "Inbox pressure is high",
      description: "Too much of the workspace is still untagged. Clear filing debt before doing broad library review.",
      action: "inbox",
      actionLabel: "Open Inbox"
    }
  }

  if (tagsCount === 0) {
    return {
      title: "Tag taxonomy needs setup",
      description: "You have bookmarks, but no shared tags yet. Create a small stable taxonomy before filing more.",
      action: "settings",
      actionLabel: "Open Settings"
    }
  }

  return {
    title: "Workspace is stable enough for review",
    description: "Operational pressure is under control. Move into the library and review the collection through tags.",
    action: "library-tags",
    actionLabel: "Open Library tags view"
  }
}

export function buildDashboardModel({
  bookmarks,
  tags,
  bookmarkTags,
  summary,
  now = new Date()
}: BuildDashboardModelOptions): DashboardModel {
  const totalBookmarks = bookmarks.length
  const taggedBookmarkIds = new Set(bookmarkTags.map((bookmarkTag) => bookmarkTag.bookmarkId))
  const authorStatsByHandle = new Map<string, { handle: string; label: string; count: number; inboxCount: number; untaggedCount: number }>()
  const taggedCount = bookmarks.reduce((count, bookmark) => count + (taggedBookmarkIds.has(bookmark.tweetId) ? 1 : 0), 0)
  const inboxCount = totalBookmarks - taggedCount
  const organizedCount = taggedCount
  const untaggedCount = Math.max(totalBookmarks - taggedCount, 0)

  const inboxShare = totalBookmarks ? clampPercent((inboxCount / totalBookmarks) * 100) : 0
  const taggedShare = totalBookmarks ? clampPercent((taggedCount / totalBookmarks) * 100) : 0
  const untaggedShare = totalBookmarks ? clampPercent((untaggedCount / totalBookmarks) * 100) : 0

  const today = startOfUtcDay(now)
  const last7DaysThreshold = addUtcDays(today, -6)
  const currentWeekStart = startOfUtcWeek(today)
  const rangeStart = addUtcDays(currentWeekStart, -((HEATMAP_WEEKS - 1) * DAYS_PER_WEEK))
  const todayKey = toDateKey(today)
  const last7DaysThresholdKey = toDateKey(last7DaysThreshold)
  const publishedCountByDate = new Map<string, number>()
  const savedCountByDateLast7Days = new Map<string, number>()

  for (const bookmark of bookmarks) {
    const authorHandle = bookmark.authorHandle.trim()
    if (authorHandle) {
      const current = authorStatsByHandle.get(authorHandle) ?? {
        handle: authorHandle,
        label: bookmark.authorName ? `${bookmark.authorName} (@${authorHandle})` : `@${authorHandle}`,
        count: 0,
        inboxCount: 0,
        untaggedCount: 0
      }

      current.count += 1
      if (!taggedBookmarkIds.has(bookmark.tweetId)) {
        current.inboxCount += 1
        current.untaggedCount += 1
      }

      authorStatsByHandle.set(authorHandle, current)
    }

    const savedDateKey = toIsoDateKey(bookmark.savedAt)
    if (savedDateKey && savedDateKey >= last7DaysThresholdKey && savedDateKey <= todayKey) {
      savedCountByDateLast7Days.set(savedDateKey, (savedCountByDateLast7Days.get(savedDateKey) ?? 0) + 1)
    }

    const publishedDateKey = toIsoDateKey(bookmark.createdAtOnX)
    if (!publishedDateKey) {
      continue
    }

    if (publishedDateKey < toDateKey(rangeStart) || publishedDateKey > todayKey) {
      continue
    }

    publishedCountByDate.set(publishedDateKey, (publishedCountByDate.get(publishedDateKey) ?? 0) + 1)
  }

  const countsInWindow = [...publishedCountByDate.values()]
  const countsLast7Days = [...savedCountByDateLast7Days.values()]
  const busiestDayCount = countsInWindow.length ? Math.max(...countsInWindow) : 0
  const busiestDayDate = busiestDayCount
    ? [...publishedCountByDate.entries()].find(([, count]) => count === busiestDayCount)?.[0]
    : undefined

  const weeks: DashboardHeatmapWeek[] = []

  for (let weekIndex = 0; weekIndex < HEATMAP_WEEKS; weekIndex += 1) {
    const weekStart = addUtcDays(rangeStart, weekIndex * DAYS_PER_WEEK)
    const days: DashboardHeatmapCell[] = []

    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
      const date = addUtcDays(weekStart, dayIndex)
      const dateKey = toDateKey(date)
      const isFuture = dateKey > todayKey
      const count = isFuture ? 0 : publishedCountByDate.get(dateKey) ?? 0

      days.push({
        date: dateKey,
        count,
        level: isFuture ? 0 : getHeatLevel(count, busiestDayCount),
        isFuture
      })
    }

    weeks.push({
      key: toDateKey(weekStart),
      days
    })
  }

  return {
    metrics: {
      totalBookmarks,
      inboxCount,
      organizedCount,
      taggedCount,
      untaggedCount,
      tagsCount: tags.length
    },
    sync: {
      status: summary.status,
      lastSyncedAt: summary.lastSyncedAt,
      fetchedCount: summary.fetchedCount,
      insertedCount: summary.insertedCount,
      updatedCount: summary.updatedCount,
      failedCount: summary.failedCount,
      errorSummary: summary.errorSummary
    },
    pressure: {
      inboxShare,
      taggedShare,
      untaggedShare
    },
    recent: {
      latestTagName: pickLatestByCreatedAt(tags)?.name,
      savedLast7Days: countsLast7Days.reduce((sum, count) => sum + count, 0),
      activeDaysLast7Days: countsLast7Days.length
    },
    authors: {
      topAuthors: [...authorStatsByHandle.values()]
        .sort((left, right) => {
          if (right.untaggedCount !== left.untaggedCount) {
            return right.untaggedCount - left.untaggedCount
          }

          if (right.inboxCount !== left.inboxCount) {
            return right.inboxCount - left.inboxCount
          }

          if (right.count !== left.count) {
            return right.count - left.count
          }

          return left.label.localeCompare(right.label)
        })
        .slice(0, 4)
    },
    recommendation: buildRecommendation({
      totalBookmarks,
      inboxCount,
      tagsCount: tags.length,
      summaryStatus: summary.status,
      failedCount: summary.failedCount,
      inboxShare
    }),
    heatmap: {
      totalPublishedInWindow: countsInWindow.reduce((sum, count) => sum + count, 0),
      busiestDayCount,
      busiestDayDate,
      weeks
    }
  }
}
