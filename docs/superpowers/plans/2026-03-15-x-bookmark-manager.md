# X Bookmark Manager Local-First Extension Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP local-first X/Twitter bookmark manager as a browser extension that manually syncs bookmarks using the x2o-style internal GraphQL flow, stores them in IndexedDB, and provides local search and tag management without any backend.

**Architecture:** The extension owns the entire product surface: popup UI, bookmark sync, local persistence, search, and tags. X-specific request/auth/parsing logic is isolated in an adapter layer; persistence is split between IndexedDB for bookmark/tag/sync-run data and `chrome.storage.local` for lightweight settings and sync summaries. Search remains local and simple in MVP, using IndexedDB queries plus in-memory filtering rather than a separate search engine.

**Tech Stack:** Plasmo, React, TypeScript, IndexedDB, chrome.storage.local, Vitest, React Testing Library, Playwright

---

## File Structure

### Root structure
- Create: `package.json` — workspace root scripts
- Create: `pnpm-workspace.yaml` — workspace definition
- Create: `tsconfig.base.json` — shared TS configuration
- Create: `apps/extension/` — browser extension codebase

### Extension app files
- Create: `apps/extension/package.json` — extension package scripts/deps
- Create: `apps/extension/tsconfig.json` — extension TS config
- Create: `apps/extension/plasmo.config.ts` — extension build config
- Create: `apps/extension/src/popup/App.tsx` — popup UI root
- Create: `apps/extension/src/popup/components/SyncPanel.tsx` — manual sync UI
- Create: `apps/extension/src/popup/components/SearchBar.tsx` — bookmark search input
- Create: `apps/extension/src/popup/components/TagFilter.tsx` — tag filtering UI
- Create: `apps/extension/src/popup/components/BookmarkList.tsx` — bookmark list renderer
- Create: `apps/extension/src/popup/components/BookmarkCard.tsx` — bookmark summary card
- Create: `apps/extension/src/popup/components/BookmarkDetail.tsx` — full bookmark detail view
- Create: `apps/extension/src/popup/components/SettingsPanel.tsx` — local settings/export/reset UI
- Create: `apps/extension/src/background/index.ts` — background message entrypoint
- Create: `apps/extension/src/background/syncBookmarks.ts` — sync orchestration
- Create: `apps/extension/src/lib/x/auth.ts` — cookie/ct0 extraction helpers
- Create: `apps/extension/src/lib/x/client.ts` — X GraphQL request client
- Create: `apps/extension/src/lib/x/parseBookmarks.ts` — response parsing and normalization
- Create: `apps/extension/src/lib/x/paginateBookmarks.ts` — cursor pagination logic
- Create: `apps/extension/src/lib/storage/db.ts` — IndexedDB open/migration entrypoint
- Create: `apps/extension/src/lib/storage/bookmarksStore.ts` — bookmark CRUD/upsert/search helpers
- Create: `apps/extension/src/lib/storage/tagsStore.ts` — tag CRUD helpers
- Create: `apps/extension/src/lib/storage/syncRunsStore.ts` — sync run recording helpers
- Create: `apps/extension/src/lib/storage/settings.ts` — chrome.storage.local helpers
- Create: `apps/extension/src/lib/search/searchBookmarks.ts` — local query/filter logic
- Create: `apps/extension/src/lib/export/exportBookmarks.ts` — local JSON export helper
- Create: `apps/extension/src/lib/types.ts` — extension domain types
- Create: `apps/extension/tests/x/auth.test.ts` — auth helper tests
- Create: `apps/extension/tests/x/parseBookmarks.test.ts` — parser tests
- Create: `apps/extension/tests/x/paginateBookmarks.test.ts` — pagination tests
- Create: `apps/extension/tests/storage/bookmarksStore.test.ts` — IndexedDB bookmark tests
- Create: `apps/extension/tests/storage/tagsStore.test.ts` — IndexedDB tag tests
- Create: `apps/extension/tests/background/syncBookmarks.test.ts` — sync orchestration tests
- Create: `apps/extension/tests/search/searchBookmarks.test.ts` — local search tests
- Create: `apps/extension/tests/popup/SyncPanel.test.tsx` — sync UI tests
- Create: `apps/extension/tests/popup/BookmarkList.test.tsx` — bookmark list UI tests
- Create: `apps/extension/tests/e2e/popup-flow.spec.ts` — popup-level end-to-end flow tests

---

## Chunk 1: Workspace bootstrap and domain contracts

### Task 1: Create extension workspace skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/plasmo.config.ts`

- [ ] **Step 1: Write the failing workspace smoke test**

Run target command that should fail before setup:

```bash
npm --workspace @xbm/extension test
```

Expected: FAIL because workspace/package scripts do not exist yet.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test`
Expected: failure indicating missing workspace or missing extension package.

- [ ] **Step 3: Write minimal implementation**

Create:

`package.json`
```json
{
  "name": "x-bookmark-manager",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "test": "pnpm --filter @xbm/extension test",
    "lint": "pnpm --filter @xbm/extension lint",
    "typecheck": "pnpm --filter @xbm/extension typecheck"
  }
}
```

`pnpm-workspace.yaml`
```yaml
packages:
  - apps/*
```

`apps/extension/package.json`
```json
{
  "name": "@xbm/extension",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  }
}
```

Also add minimal TS config and `plasmo.config.ts` placeholders.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: extension test runner executes without workspace configuration errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json apps/extension/package.json apps/extension/tsconfig.json apps/extension/plasmo.config.ts
git commit -m "chore: initialize local-first extension workspace"
```

### Task 2: Define extension domain types

**Files:**
- Create: `apps/extension/src/lib/types.ts`
- Test: `apps/extension/tests/types/bookmark-types.test.ts`

- [ ] **Step 1: Write the failing type-level contract test**

```ts
import { describe, expect, it } from "vitest"
import { createEmptySyncSummary } from "../../src/lib/types"

describe("createEmptySyncSummary", () => {
  it("creates an idle sync summary object", () => {
    expect(createEmptySyncSummary()).toMatchObject({
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/types/bookmark-types.test.ts`
Expected: FAIL because domain helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

Define:
- `BookmarkRecord`
- `TagRecord`
- `BookmarkTagRecord`
- `SyncRunRecord`
- `SyncSummary`
- `ExtensionSettings`
- `createEmptySyncSummary()`

Minimal helper:

```ts
export function createEmptySyncSummary() {
  return {
    status: "idle" as const,
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 0
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/types/bookmark-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/types.ts apps/extension/tests/types/bookmark-types.test.ts
git commit -m "feat: add extension domain types"
```

---

## Chunk 2: X adapter and sync pipeline

### Task 3: Implement X auth extraction helpers

**Files:**
- Create: `apps/extension/src/lib/x/auth.ts`
- Test: `apps/extension/tests/x/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { extractCsrfToken } from "../../src/lib/x/auth"

describe("extractCsrfToken", () => {
  it("extracts ct0 from cookie header", () => {
    expect(extractCsrfToken("foo=bar; ct0=token123; baz=1")).toBe("token123")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/x/auth.test.ts`
Expected: FAIL because helper is missing.

- [ ] **Step 3: Write minimal implementation**

Implement:

```ts
export function extractCsrfToken(cookieHeader: string) {
  const match = cookieHeader.match(/(?:^|;\s*)ct0=([^;]+)/)
  if (!match) throw new Error("Missing ct0 cookie")
  return match[1]
}
```

Also add helper(s) to read the raw cookie string for `https://x.com` from the extension environment.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/x/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/x/auth.ts apps/extension/tests/x/auth.test.ts
git commit -m "feat: add x auth helpers"
```

### Task 4: Implement bookmark response parser

**Files:**
- Create: `apps/extension/src/lib/x/parseBookmarks.ts`
- Test: `apps/extension/tests/x/parseBookmarks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { parseBookmarkEntries } from "../../src/lib/x/parseBookmarks"

const response = {
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            type: "TimelineAddEntries",
            entries: [
              {
                entryId: "tweet-123",
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: "123",
                        legacy: {
                          full_text: "hello world",
                          created_at: "Mon Mar 15 00:00:00 +0000 2026",
                          favorite_count: 10,
                          retweet_count: 2,
                          reply_count: 1
                        },
                        core: {
                          user_results: {
                            result: {
                              legacy: {
                                name: "Alice",
                                screen_name: "alice"
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        ]
      }
    }
  }
}

describe("parseBookmarkEntries", () => {
  it("extracts normalized bookmark records", () => {
    const result = parseBookmarkEntries(response)
    expect(result.bookmarks[0]).toMatchObject({
      tweetId: "123",
      authorHandle: "alice",
      text: "hello world"
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/x/parseBookmarks.test.ts`
Expected: FAIL because parser is missing.

- [ ] **Step 3: Write minimal implementation**

Implement `parseBookmarkEntries(response)` that:
- reads `TimelineAddEntries`
- filters `entryId` starting with `tweet-`
- unwraps `TweetWithVisibilityResults` if present
- extracts `tweetId`, `tweetUrl`, `authorName`, `authorHandle`, `text`, `createdAtOnX`, `savedAt`, `media`, `metrics`, `rawPayload`
- returns `{ bookmarks, nextCursor }`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/x/parseBookmarks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/x/parseBookmarks.ts apps/extension/tests/x/parseBookmarks.test.ts
git commit -m "feat: parse x bookmark responses"
```

### Task 5: Implement paginated X client

**Files:**
- Create: `apps/extension/src/lib/x/client.ts`
- Create: `apps/extension/src/lib/x/paginateBookmarks.ts`
- Test: `apps/extension/tests/x/paginateBookmarks.test.ts`

- [ ] **Step 1: Write the failing pagination test**

```ts
import { describe, expect, it, vi } from "vitest"
import { fetchAllBookmarks } from "../../src/lib/x/paginateBookmarks"

describe("fetchAllBookmarks", () => {
  it("continues until next cursor is absent", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ bookmarks: [{ tweetId: "1" }], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ bookmarks: [{ tweetId: "2" }], nextCursor: null })

    const result = await fetchAllBookmarks({ fetchPage, limit: 100 })

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(result.bookmarks).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/x/paginateBookmarks.test.ts`
Expected: FAIL because pagination helper is missing.

- [ ] **Step 3: Write minimal implementation**

Implement:
- request builder for internal GraphQL bookmark endpoint
- `fetchBookmarksPage(...)`
- `fetchAllBookmarks({ fetchPage, limit })`

Requirements:
- cap page size at 20
- stop at configured limit
- stop when `nextCursor` is absent
- return partial results when a later page fails after earlier pages succeeded

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/x/paginateBookmarks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/x/client.ts apps/extension/src/lib/x/paginateBookmarks.ts apps/extension/tests/x/paginateBookmarks.test.ts
git commit -m "feat: add paginated x bookmarks client"
```

### Task 6: Implement sync orchestration without backend

**Files:**
- Create: `apps/extension/src/background/syncBookmarks.ts`
- Test: `apps/extension/tests/background/syncBookmarks.test.ts`

- [ ] **Step 1: Write the failing orchestration test**

```ts
import { describe, expect, it, vi } from "vitest"
import { runBookmarkSync } from "../../src/background/syncBookmarks"

describe("runBookmarkSync", () => {
  it("stores fetched bookmarks locally and returns sync stats", async () => {
    const fetchAllBookmarks = vi.fn().mockResolvedValue({
      bookmarks: [
        {
          tweetId: "123",
          tweetUrl: "https://x.com/a/status/123",
          authorName: "Alice",
          authorHandle: "alice",
          text: "hello",
          createdAtOnX: "2026-03-15T00:00:00.000Z",
          savedAt: "2026-03-15T01:00:00.000Z",
          rawPayload: {}
        }
      ],
      failedCount: 0
    })
    const upsertBookmarks = vi.fn().mockResolvedValue({ insertedCount: 1, updatedCount: 0 })

    const result = await runBookmarkSync({ fetchAllBookmarks, upsertBookmarks })

    expect(upsertBookmarks).toHaveBeenCalled()
    expect(result.insertedCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/background/syncBookmarks.test.ts`
Expected: FAIL because sync orchestration is missing.

- [ ] **Step 3: Write minimal implementation**

Implement `runBookmarkSync` that:
- retrieves X cookie state
- derives CSRF token
- fetches bookmarks
- records a sync run entry
- upserts bookmarks into IndexedDB
- updates local sync summary in `chrome.storage.local`
- returns fetched/inserted/updated/failed counts

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/background/syncBookmarks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/background/syncBookmarks.ts apps/extension/tests/background/syncBookmarks.test.ts
git commit -m "feat: store synced bookmarks locally"
```

---

## Chunk 3: Local persistence and search

### Task 7: Implement IndexedDB bootstrap and bookmark store

**Files:**
- Create: `apps/extension/src/lib/storage/db.ts`
- Create: `apps/extension/src/lib/storage/bookmarksStore.ts`
- Test: `apps/extension/tests/storage/bookmarksStore.test.ts`

- [ ] **Step 1: Write the failing storage test**

```ts
import { describe, expect, it } from "vitest"
import { upsertBookmarks, listBookmarks } from "../../src/lib/storage/bookmarksStore"

describe("bookmarksStore", () => {
  it("upserts bookmarks by tweetId", async () => {
    await upsertBookmarks([
      {
        tweetId: "123",
        tweetUrl: "https://x.com/a/status/123",
        authorName: "Alice",
        authorHandle: "alice",
        text: "hello",
        createdAtOnX: "2026-03-15T00:00:00.000Z",
        savedAt: "2026-03-15T01:00:00.000Z",
        rawPayload: {}
      }
    ])

    const bookmarks = await listBookmarks()
    expect(bookmarks).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/storage/bookmarksStore.test.ts`
Expected: FAIL because IndexedDB store helpers are missing.

- [ ] **Step 3: Write minimal implementation**

Implement IndexedDB with stores and indexes:
- `bookmarks` with unique `tweetId`
- index on `savedAt`
- index on `authorHandle`

Implement:
- `upsertBookmarks(bookmarks)`
- `listBookmarks()`
- `getBookmarkById(id)` or `getBookmarkByTweetId(tweetId)`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/storage/bookmarksStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/db.ts apps/extension/src/lib/storage/bookmarksStore.ts apps/extension/tests/storage/bookmarksStore.test.ts
git commit -m "feat: add local bookmark store"
```

### Task 8: Implement tags and sync-run stores

**Files:**
- Create: `apps/extension/src/lib/storage/tagsStore.ts`
- Create: `apps/extension/src/lib/storage/syncRunsStore.ts`
- Test: `apps/extension/tests/storage/tagsStore.test.ts`
- Test: `apps/extension/tests/storage/syncRunsStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest"
import { createTag, listTags } from "../../src/lib/storage/tagsStore"

describe("tagsStore", () => {
  it("creates tags with unique names", async () => {
    await createTag("reading")
    const tags = await listTags()
    expect(tags[0].name).toBe("reading")
  })
})
```

```ts
import { describe, expect, it } from "vitest"
import { recordSyncRun, listSyncRuns } from "../../src/lib/storage/syncRunsStore"

describe("syncRunsStore", () => {
  it("records completed sync runs", async () => {
    await recordSyncRun({ status: "success", fetchedCount: 3, insertedCount: 2, updatedCount: 1, failedCount: 0 })
    const runs = await listSyncRuns()
    expect(runs).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @xbm/extension test apps/extension/tests/storage/tagsStore.test.ts
pnpm --filter @xbm/extension test apps/extension/tests/storage/syncRunsStore.test.ts
```
Expected: FAIL because store helpers are missing.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `createTag(name)`
- `listTags()`
- `attachTagToBookmark(bookmarkId, tagId)`
- `detachTagFromBookmark(bookmarkId, tagId)`
- `recordSyncRun(summary)`
- `listSyncRuns()`

Add DB stores:
- `tags` with unique `name`
- `bookmarkTags` with unique composite key per relation
- `syncRuns` keyed by local id/time

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @xbm/extension test apps/extension/tests/storage/tagsStore.test.ts
pnpm --filter @xbm/extension test apps/extension/tests/storage/syncRunsStore.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/tagsStore.ts apps/extension/src/lib/storage/syncRunsStore.ts apps/extension/tests/storage/tagsStore.test.ts apps/extension/tests/storage/syncRunsStore.test.ts
git commit -m "feat: add local tags and sync history stores"
```

### Task 9: Implement local settings and bookmark search

**Files:**
- Create: `apps/extension/src/lib/storage/settings.ts`
- Create: `apps/extension/src/lib/search/searchBookmarks.ts`
- Test: `apps/extension/tests/search/searchBookmarks.test.ts`

- [ ] **Step 1: Write the failing search test**

```ts
import { describe, expect, it } from "vitest"
import { searchBookmarks } from "../../src/lib/search/searchBookmarks"

describe("searchBookmarks", () => {
  it("filters bookmarks by text, author, and tag names", async () => {
    const result = await searchBookmarks({ query: "hello", tagNames: ["reading"] })
    expect(Array.isArray(result)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/search/searchBookmarks.test.ts`
Expected: FAIL because search helper is missing.

- [ ] **Step 3: Write minimal implementation**

Implement:
- settings helpers in `chrome.storage.local` for schema version, recent sync summary, and simple preferences
- `searchBookmarks({ query, tagNames })` using local store reads plus in-memory filtering against `text`, `authorName`, `authorHandle`, and attached tag names
- sort results by `savedAt desc`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/search/searchBookmarks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/settings.ts apps/extension/src/lib/search/searchBookmarks.ts apps/extension/tests/search/searchBookmarks.test.ts
git commit -m "feat: add local settings and bookmark search"
```

---

## Chunk 4: Popup UI for sync, search, tags, and details

### Task 10: Build sync panel UI

**Files:**
- Create: `apps/extension/src/popup/components/SyncPanel.tsx`
- Create: `apps/extension/src/background/index.ts`
- Test: `apps/extension/tests/popup/SyncPanel.test.tsx`

- [ ] **Step 1: Write the failing UI test**

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SyncPanel } from "../../src/popup/components/SyncPanel"

describe("SyncPanel", () => {
  it("calls onSync when clicked", async () => {
    const onSync = vi.fn()
    const user = userEvent.setup()

    render(<SyncPanel syncing={false} summary={{ status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 }} onSync={onSync} />)
    await user.click(screen.getByRole("button", { name: /sync bookmarks/i }))

    expect(onSync).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/popup/SyncPanel.test.tsx`
Expected: FAIL because popup component is missing.

- [ ] **Step 3: Write minimal implementation**

Implement popup sync UI with:
- sync button
- status text
- fetched/inserted/updated/failed summary
- background message trigger for `runBookmarkSync`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/popup/SyncPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/popup/components/SyncPanel.tsx apps/extension/src/background/index.ts apps/extension/tests/popup/SyncPanel.test.tsx
git commit -m "feat: add manual sync panel"
```

### Task 11: Build bookmark list, search, and tag filtering UI

**Files:**
- Create: `apps/extension/src/popup/App.tsx`
- Create: `apps/extension/src/popup/components/SearchBar.tsx`
- Create: `apps/extension/src/popup/components/TagFilter.tsx`
- Create: `apps/extension/src/popup/components/BookmarkList.tsx`
- Create: `apps/extension/src/popup/components/BookmarkCard.tsx`
- Test: `apps/extension/tests/popup/BookmarkList.test.tsx`

- [ ] **Step 1: Write the failing UI test**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BookmarkList } from "../../src/popup/components/BookmarkList"

describe("BookmarkList", () => {
  it("renders an empty state when there are no bookmarks", () => {
    render(<BookmarkList bookmarks={[]} onSelect={() => {}} />)
    expect(screen.getByText(/no bookmarks yet/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/popup/BookmarkList.test.tsx`
Expected: FAIL because bookmark list components are missing.

- [ ] **Step 3: Write minimal implementation**

Implement popup root and bookmark browsing UI with:
- search field
- tag filter UI
- bookmark list
- empty state
- selection state for opening detail

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test apps/extension/tests/popup/BookmarkList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/popup/App.tsx apps/extension/src/popup/components/SearchBar.tsx apps/extension/src/popup/components/TagFilter.tsx apps/extension/src/popup/components/BookmarkList.tsx apps/extension/src/popup/components/BookmarkCard.tsx apps/extension/tests/popup/BookmarkList.test.tsx
git commit -m "feat: add local bookmark browsing ui"
```

### Task 12: Build bookmark detail and local settings/export UI

**Files:**
- Create: `apps/extension/src/popup/components/BookmarkDetail.tsx`
- Create: `apps/extension/src/popup/components/SettingsPanel.tsx`
- Create: `apps/extension/src/lib/export/exportBookmarks.ts`
- Test: `apps/extension/tests/popup/BookmarkDetail.test.tsx`
- Test: `apps/extension/tests/export/exportBookmarks.test.ts`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BookmarkDetail } from "../../src/popup/components/BookmarkDetail"

describe("BookmarkDetail", () => {
  it("renders full bookmark text and author", () => {
    render(<BookmarkDetail bookmark={{ tweetId: "1", tweetUrl: "https://x.com/a/status/1", authorName: "Alice", authorHandle: "alice", text: "hello", createdAtOnX: "2026-03-15T00:00:00.000Z", savedAt: "2026-03-15T01:00:00.000Z", rawPayload: {} }} />)
    expect(screen.getByText("hello")).toBeVisible()
    expect(screen.getByText(/alice/i)).toBeVisible()
  })
})
```

```ts
import { describe, expect, it } from "vitest"
import { serializeBookmarksAsJson } from "../../src/lib/export/exportBookmarks"

describe("serializeBookmarksAsJson", () => {
  it("returns pretty JSON for bookmarks", () => {
    const json = serializeBookmarksAsJson([{ tweetId: "1" }])
    expect(json).toContain('"tweetId": "1"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @xbm/extension test apps/extension/tests/popup/BookmarkDetail.test.tsx
pnpm --filter @xbm/extension test apps/extension/tests/export/exportBookmarks.test.ts
```
Expected: FAIL because components/helpers are missing.

- [ ] **Step 3: Write minimal implementation**

Implement:
- bookmark detail UI with full text, author, time, media, tag editing hooks
- settings panel showing last sync summary and local actions
- JSON export helper for all bookmarks

Do not implement cloud backup or any remote export target.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @xbm/extension test apps/extension/tests/popup/BookmarkDetail.test.tsx
pnpm --filter @xbm/extension test apps/extension/tests/export/exportBookmarks.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/popup/components/BookmarkDetail.tsx apps/extension/src/popup/components/SettingsPanel.tsx apps/extension/src/lib/export/exportBookmarks.ts apps/extension/tests/popup/BookmarkDetail.test.tsx apps/extension/tests/export/exportBookmarks.test.ts
git commit -m "feat: add bookmark detail and local export"
```

---

## Chunk 5: Integration and verification

### Task 13: Wire popup state end-to-end

**Files:**
- Modify: `apps/extension/src/popup/App.tsx`
- Modify: `apps/extension/src/background/index.ts`
- Test: `apps/extension/tests/e2e/popup-flow.spec.ts`

- [ ] **Step 1: Write the failing end-to-end flow test**

```ts
import { test, expect } from "@playwright/test"

test("user can see empty state then sync and browse bookmarks", async ({ page }) => {
  await page.goto("/popup.html")
  await expect(page.getByText(/no bookmarks yet/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /sync bookmarks/i })).toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xbm/extension test:e2e apps/extension/tests/e2e/popup-flow.spec.ts`
Expected: FAIL because popup integration is incomplete.

- [ ] **Step 3: Write minimal implementation**

Wire popup state so it:
- loads sync summary from `chrome.storage.local`
- loads bookmarks/tags from IndexedDB
- triggers background sync and refreshes view state after completion
- supports selecting a bookmark and rendering detail

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xbm/extension test:e2e apps/extension/tests/e2e/popup-flow.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/popup/App.tsx apps/extension/src/background/index.ts apps/extension/tests/e2e/popup-flow.spec.ts
git commit -m "feat: wire local-first popup experience"
```

### Task 14: Final verification and handoff

**Files:**
- Test: workspace-wide extension tests

- [ ] **Step 1: Run unit and component tests**

Run:
```bash
pnpm --filter @xbm/extension test
```

Expected: PASS.

- [ ] **Step 2: Run end-to-end tests**

Run:
```bash
pnpm --filter @xbm/extension test:e2e
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Review against plan and request code review**

Use `@superpowers:requesting-code-review` after implementation chunks are complete.

- [ ] **Step 5: Commit final verification fixes**

```bash
git add <verified files>
git commit -m "chore: finalize local-first bookmark manager mvp"
```
