import test from "node:test"
import assert from "node:assert/strict"
import { buildDashboardModel } from "../../src/options/lib/dashboard.ts"

test("buildDashboardModel derives dashboard pressure and recommendation from workspace data", () => {
  const model = buildDashboardModel({
    bookmarks: [
      {
        tweetId: "1",
        tweetUrl: "https://x.com/alice/status/1",
        authorName: "Alice",
        authorHandle: "alice",
        text: "alpha",
        createdAtOnX: "2026-03-10T00:00:00.000Z",
        savedAt: "2026-03-17T01:00:00.000Z",
        rawPayload: {}
      },
      {
        tweetId: "2",
        tweetUrl: "https://x.com/bob/status/2",
        authorName: "Bob",
        authorHandle: "bob",
        text: "beta",
        createdAtOnX: "2026-03-18T00:00:00.000Z",
        savedAt: "2026-03-18T01:00:00.000Z",
        rawPayload: {}
      },
      {
        tweetId: "3",
        tweetUrl: "https://x.com/cara/status/3",
        authorName: "Cara",
        authorHandle: "cara",
        text: "gamma",
        createdAtOnX: "2026-03-18T06:00:00.000Z",
        savedAt: "2026-03-18T06:00:00.000Z",
        rawPayload: {}
      }
    ],
    bookmarkFolders: [
      { bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-17T01:00:00.000Z" },
      { bookmarkId: "2", folderId: "folder-research", updatedAt: "2026-03-18T01:00:00.000Z" },
      { bookmarkId: "3", folderId: "folder-research", updatedAt: "2026-03-18T06:00:00.000Z" }
    ],
    tags: [
      { id: "tag-1", name: "research", createdAt: "2026-03-18T00:00:00.000Z" }
    ],
    bookmarkTags: [
      { id: "bookmark-tag-1", bookmarkId: "2", tagId: "tag-1", createdAt: "2026-03-18T02:00:00.000Z" }
    ],
    folders: [
      { id: "folder-inbox", name: "Inbox", createdAt: "2026-03-10T00:00:00.000Z" },
      { id: "folder-research", name: "Research", createdAt: "2026-03-18T00:00:00.000Z" }
    ],
    summary: {
      status: "success",
      fetchedCount: 3,
      insertedCount: 3,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-03-18T08:00:00.000Z"
    },
    latestSyncRun: {
      id: "sync-1",
      status: "success",
      startedAt: "2026-03-18T07:59:00.000Z",
      finishedAt: "2026-03-18T08:00:00.000Z",
      fetchedCount: 3,
      insertedCount: 3,
      updatedCount: 0,
      failedCount: 0
    },
    now: new Date("2026-03-19T12:00:00.000Z")
  })

  assert.equal(model.metrics.totalBookmarks, 3)
  assert.equal(model.metrics.inboxCount, 1)
  assert.equal(model.metrics.organizedCount, 2)
  assert.equal(model.metrics.taggedCount, 1)
  assert.equal(model.metrics.untaggedCount, 2)
  assert.equal(model.pressure.inboxShare, 33)
  assert.equal(model.pressure.taggedShare, 33)
  assert.equal(model.pressure.untaggedShare, 67)
  assert.equal(model.recommendation.action, "library-tags")
  assert.equal(model.recent.latestFolderName, "Research")
  assert.equal(model.recent.savedLast7Days, 3)
  assert.equal(model.recent.activeDaysLast7Days, 2)
  assert.equal(model.authors.topAuthors[0]?.handle, "alice")
  assert.equal(model.authors.topAuthors[0]?.untaggedCount, 1)
  assert.equal(model.heatmap.totalPublishedInWindow, 3)
  assert.equal(model.heatmap.busiestDayCount, 2)
  assert.equal(model.heatmap.weeks.length, 12)

  const march18Cell = model.heatmap.weeks.flatMap((week) => week.days).find((cell) => cell.date === "2026-03-18")
  assert.ok(march18Cell)
  assert.equal(march18Cell.count, 2)
  assert.equal(march18Cell.level, 4)
})

test("buildDashboardModel escalates sync failures ahead of filing recommendations", () => {
  const model = buildDashboardModel({
    bookmarks: [
      {
        tweetId: "1",
        tweetUrl: "https://x.com/alice/status/1",
        authorName: "Alice",
        authorHandle: "alice",
        text: "alpha",
        createdAtOnX: "2026-03-10T00:00:00.000Z",
        savedAt: "2026-03-17T01:00:00.000Z",
        rawPayload: {}
      }
    ],
    bookmarkFolders: [{ bookmarkId: "1", folderId: "folder-inbox", updatedAt: "2026-03-17T01:00:00.000Z" }],
    tags: [],
    bookmarkTags: [],
    folders: [{ id: "folder-inbox", name: "Inbox", createdAt: "2026-03-10T00:00:00.000Z" }],
    summary: {
      status: "error",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 1,
      lastSyncedAt: "2026-03-18T08:00:00.000Z",
      errorSummary: "Missing auth"
    },
    latestSyncRun: {
      id: "sync-1",
      status: "error",
      startedAt: "2026-03-18T07:59:00.000Z",
      finishedAt: "2026-03-18T08:00:00.000Z",
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      failedCount: 1,
      errorSummary: "Missing auth"
    },
    now: new Date("2026-03-19T12:00:00.000Z")
  })

  assert.equal(model.recommendation.action, "settings")
  assert.match(model.recommendation.title, /Resolve sync health/)
  assert.equal(model.sync.errorSummary, "Missing auth")
})
