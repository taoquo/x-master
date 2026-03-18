# Real Local Storage and Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the extension’s fake in-memory persistence with real local browser storage and wire the popup to the background sync flow so the extension state is loaded and refreshed from real runtime data.

**Architecture:** Keep the existing module boundaries, but swap the storage implementation underneath them. IndexedDB will become the source of truth for bookmark, tag, and sync-run records, while `chrome.storage.local` will hold lightweight settings and the latest sync summary. The popup app will stop mutating fake local state and instead load data through thin runtime APIs that call background sync and then re-read persisted state.

**Tech Stack:** React, TypeScript, IndexedDB, chrome.storage.local, node:test, jsdom, tsx

---

## File Structure

### Storage layer
- Modify: `apps/extension/src/lib/storage/db.ts` — replace memory-db stub with real IndexedDB open/upgrade/reset helpers
- Modify: `apps/extension/src/lib/storage/bookmarksStore.ts` — use IndexedDB reads/writes for bookmark upsert and retrieval
- Modify: `apps/extension/src/lib/storage/tagsStore.ts` — use IndexedDB for tag creation and listing
- Modify: `apps/extension/src/lib/storage/syncRunsStore.ts` — use IndexedDB for sync-run insert and latest-run lookup
- Modify: `apps/extension/src/lib/storage/settings.ts` — move settings persistence to `chrome.storage.local`

### Runtime integration layer
- Create: `apps/extension/src/background/index.ts` — add background message handlers for sync + popup data loading
- Create: `apps/extension/src/lib/runtime/messages.ts` — define runtime message types and message names shared by popup/background
- Create: `apps/extension/src/lib/runtime/popupClient.ts` — popup-side helpers for requesting sync and loading persisted state
- Modify: `apps/extension/src/background/syncBookmarks.ts` — default to real stores/settings helpers instead of no-op persistence
- Modify: `apps/extension/src/popup/App.tsx` — load bookmarks/summary from runtime APIs and refresh after sync

### Tests
- Modify: `apps/extension/tests/storage/bookmarksStore.test.ts` — verify real IndexedDB bookmark persistence semantics
- Modify: `apps/extension/tests/storage/tagsStore.test.ts` — verify real IndexedDB tag + sync-run persistence semantics
- Create: `apps/extension/tests/storage/settings.test.ts` — verify `chrome.storage.local` settings defaults and saves
- Create: `apps/extension/tests/background/index.test.ts` — verify background message handlers call sync/load code correctly
- Modify: `apps/extension/tests/background/syncBookmarks.test.ts` — verify default sync path persists summary and sync runs through injected real interfaces
- Modify: `apps/extension/tests/popup/App.test.tsx` — verify popup loads persisted data and refreshes after sync

---

## Chunk 1: Real storage foundation

### Task 1: Replace the memory DB stub with real IndexedDB helpers

**Files:**
- Modify: `apps/extension/src/lib/storage/db.ts:1-70`
- Test: `apps/extension/tests/storage/bookmarksStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that proves the DB helper exposes real object stores after reset/open:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { getBookmarksDb, resetBookmarksDb } from "../../src/lib/storage/db.ts"

test("getBookmarksDb opens IndexedDB with required object stores", async () => {
  await resetBookmarksDb()

  const db = await getBookmarksDb()

  assert.equal(db.objectStoreNames.contains("bookmarks"), true)
  assert.equal(db.objectStoreNames.contains("tags"), true)
  assert.equal(db.objectStoreNames.contains("sync-runs"), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/bookmarksStore.test.ts`
Expected: FAIL because the current DB helper is a memory stub rather than a real IndexedDB implementation.

- [ ] **Step 3: Write minimal implementation**

Replace the memory-only implementation in `apps/extension/src/lib/storage/db.ts` with:

```ts
const DB_NAME = "x-bookmark-manager"
const DB_VERSION = 1
export const BOOKMARKS_STORE = "bookmarks"
export const TAGS_STORE = "tags"
export const SYNC_RUNS_STORE = "sync-runs"

let dbPromise: Promise<IDBDatabase> | null = null

function openBookmarksDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
        db.createObjectStore(BOOKMARKS_STORE, { keyPath: "tweetId" })
      }
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        db.createObjectStore(TAGS_STORE, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(SYNC_RUNS_STORE)) {
        db.createObjectStore(SYNC_RUNS_STORE, { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"))
  })
}

export async function getBookmarksDb() {
  dbPromise ??= openBookmarksDb()
  return dbPromise
}
```

Also add `resetBookmarksDb()` that closes the cached DB instance, deletes the database via `indexedDB.deleteDatabase(DB_NAME)`, and clears the cached promise.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/bookmarksStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/db.ts apps/extension/tests/storage/bookmarksStore.test.ts
git commit -m "feat: add real indexeddb bootstrap"
```

### Task 2: Persist bookmarks in IndexedDB

**Files:**
- Modify: `apps/extension/src/lib/storage/bookmarksStore.ts:1-39`
- Test: `apps/extension/tests/storage/bookmarksStore.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the bookmark store test to prove persisted reads survive a fresh DB open and that updates overwrite existing rows by `tweetId`:

```ts
test("upsertBookmarks persists bookmarks in IndexedDB", async () => {
  await resetBookmarksDb()

  await upsertBookmarks([
    {
      tweetId: "123",
      tweetUrl: "https://x.com/alice/status/123",
      authorName: "Alice",
      authorHandle: "alice",
      text: "hello",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  const bookmarks = await getAllBookmarks()
  assert.equal(bookmarks[0].tweetId, "123")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/bookmarksStore.test.ts`
Expected: FAIL because the store still reads/writes through `db.__stores.bookmarks`.

- [ ] **Step 3: Write minimal implementation**

Replace the Map-based logic with real IDB transactions:

```ts
export async function upsertBookmarks(bookmarks: BookmarkRecord[]) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(BOOKMARKS_STORE, "readwrite")
  const store = transaction.objectStore(BOOKMARKS_STORE)
  let insertedCount = 0
  let updatedCount = 0

  for (const bookmark of bookmarks) {
    const existing = await requestToPromise(store.get(bookmark.tweetId))
    const record = {
      ...existing,
      ...bookmark,
      id: bookmark.id ?? bookmark.tweetId,
      updatedAt: new Date().toISOString()
    }

    if (existing) {
      updatedCount += 1
    } else {
      insertedCount += 1
    }

    store.put(record)
  }

  await transactionDone(transaction)
  return { insertedCount, updatedCount }
}
```

Also implement `getAllBookmarks()` using `getAll()` on the bookmarks store.

If you need small local helpers such as `requestToPromise()` or `transactionDone()`, define them in `db.ts` and reuse them. Do not add a broader abstraction layer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/bookmarksStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/bookmarksStore.ts apps/extension/tests/storage/bookmarksStore.test.ts
git commit -m "feat: persist bookmarks in indexeddb"
```

### Task 3: Persist tags and sync runs in IndexedDB

**Files:**
- Modify: `apps/extension/src/lib/storage/tagsStore.ts:1-20`
- Modify: `apps/extension/src/lib/storage/syncRunsStore.ts:1-17`
- Test: `apps/extension/tests/storage/tagsStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add/extend tests that prove tags and sync runs are written to real stores and latest sync run is resolved from persisted data:

```ts
test("createSyncRun stores a sync run in IndexedDB and getLatestSyncRun returns the newest one", async () => {
  await resetBookmarksDb()

  await createSyncRun({ id: "sync-1", status: "success", fetchedCount: 1, insertedCount: 1, updatedCount: 0, failedCount: 0 })
  await createSyncRun({ id: "sync-2", status: "partial_success", fetchedCount: 2, insertedCount: 1, updatedCount: 1, failedCount: 1 })

  const latest = await getLatestSyncRun()
  assert.equal(latest?.id, "sync-2")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/tagsStore.test.ts`
Expected: FAIL because the tag/sync-run stores still use `db.__stores` Maps.

- [ ] **Step 3: Write minimal implementation**

Implement:

```ts
export async function createTag({ name }: { name: string }): Promise<TagRecord> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(TAGS_STORE, "readwrite")
  const store = transaction.objectStore(TAGS_STORE)
  const tag = {
    id: `tag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    createdAt: new Date().toISOString()
  }

  store.put(tag)
  await transactionDone(transaction)
  return tag
}
```

and:

```ts
export async function getLatestSyncRun(): Promise<SyncRunRecord | null> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(SYNC_RUNS_STORE, "readonly")
  const runs = await requestToPromise(transaction.objectStore(SYNC_RUNS_STORE).getAll())
  return runs.length ? runs[runs.length - 1] : null
}
```

Keep it simple: use insertion order from `getAll()` for MVP rather than adding indexes in this round.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/tagsStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/tagsStore.ts apps/extension/src/lib/storage/syncRunsStore.ts apps/extension/tests/storage/tagsStore.test.ts
git commit -m "feat: persist tags and sync runs"
```

### Task 4: Move settings persistence to chrome.storage.local

**Files:**
- Modify: `apps/extension/src/lib/storage/settings.ts:1-22`
- Create: `apps/extension/tests/storage/settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/storage/settings.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { getSettings, saveSettings } from "../../src/lib/storage/settings.ts"

test("getSettings returns defaults when chrome.storage.local is empty", async () => {
  let storedValue: unknown

  ;(globalThis as typeof globalThis & { chrome: any }).chrome = {
    storage: {
      local: {
        get: async () => ({ settings: storedValue }),
        set: async (value: Record<string, unknown>) => {
          storedValue = value.settings
        }
      }
    }
  }

  const settings = await getSettings()
  assert.equal(settings.schemaVersion, 1)
  assert.equal(settings.hasCompletedOnboarding, false)
  assert.equal(settings.lastSyncSummary.status, "idle")
})
```

Add a second test that `saveSettings()` writes the full settings object back through `chrome.storage.local.set` and that a follow-up `getSettings()` returns the saved values.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/settings.test.ts`
Expected: FAIL because the settings helper still uses `db.__settings`.

- [ ] **Step 3: Write minimal implementation**

Replace the DB-backed settings logic with real `chrome.storage.local` calls:

```ts
const SETTINGS_STORAGE_KEY = "settings"

export async function getSettings(): Promise<ExtensionSettings> {
  const defaults = {
    schemaVersion: 1,
    hasCompletedOnboarding: false,
    lastSyncSummary: createEmptySyncSummary()
  }

  if (typeof chrome === "undefined" || !chrome.storage?.local?.get) {
    return defaults
  }

  const stored = (await chrome.storage.local.get(SETTINGS_STORAGE_KEY))[SETTINGS_STORAGE_KEY]
  return stored ? { ...defaults, ...stored } : defaults
}

export async function saveSettings(settings: ExtensionSettings) {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.set) {
    return
  }

  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings })
}
```

Also add a small helper like `saveLastSyncSummary(summary)` if that keeps `syncBookmarks.ts` focused.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/storage/settings.ts apps/extension/tests/storage/settings.test.ts
git commit -m "feat: store extension settings in chrome storage"
```

---

## Chunk 2: Runtime integration

### Task 5: Default sync flow to real persistence helpers

**Files:**
- Modify: `apps/extension/src/background/syncBookmarks.ts:1-88`
- Modify: `apps/extension/tests/background/syncBookmarks.test.ts:1-44`

- [ ] **Step 1: Write the failing test**

Keep the existing injected-dependency test, then add a second test that proves the implementation's default summary persistence path delegates to settings storage:

```ts
test("runBookmarkSync default summary persistence updates saved settings", async () => {
  let savedSettings: any = {
    schemaVersion: 1,
    hasCompletedOnboarding: false,
    lastSyncSummary: {
      status: "idle",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0
    }
  }

  await runBookmarkSync({
    getXCookieHeader: async () => "auth_token=abc; ct0=token123",
    fetchAllBookmarks: async () => ({ bookmarks: [], failedCount: 0 }),
    upsertBookmarks: async () => ({ insertedCount: 0, updatedCount: 0 }),
    createSyncRun: async () => {},
    getSettings: async () => savedSettings,
    saveSettings: async (nextSettings) => {
      savedSettings = nextSettings
    }
  })

  assert.equal(savedSettings.lastSyncSummary.status, "success")
})
```

This keeps the test focused on real default behavior without needing the test to patch module imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/background/syncBookmarks.test.ts`
Expected: FAIL once the new test expects default summary persistence through settings storage but the implementation still uses the current no-op/default path.

- [ ] **Step 3: Write minimal implementation**

In `apps/extension/src/background/syncBookmarks.ts`, import the real helpers:

```ts
import { upsertBookmarks } from "../lib/storage/bookmarksStore.ts"
import { createSyncRun } from "../lib/storage/syncRunsStore.ts"
import { getSettings, saveSettings } from "../lib/storage/settings.ts"
```

Extend `RunBookmarkSyncOptions` with injectable settings helpers:

```ts
getSettings?: typeof getSettings
saveSettings?: typeof saveSettings
```

Then implement the default summary update path by reading current settings and saving a new object with `lastSyncSummary` replaced. Keep `runBookmarkSync()` injectable for tests. Do not remove dependency injection.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/background/syncBookmarks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/background/syncBookmarks.ts apps/extension/tests/background/syncBookmarks.test.ts
git commit -m "feat: connect sync flow to real persistence"
```

### Task 6: Add shared runtime message contracts and background handlers

**Files:**
- Create: `apps/extension/src/lib/runtime/messages.ts`
- Create: `apps/extension/src/background/index.ts`
- Create: `apps/extension/tests/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/background/index.test.ts` to verify the background message layer handles two commands:
- load popup data
- run sync

Example structure:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { createBackgroundMessageHandler } from "../../src/background/index.ts"

test("background message handler loads popup data", async () => {
  const handler = createBackgroundMessageHandler({
    loadPopupData: async () => ({ bookmarks: [], summary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 } }),
    runSync: async () => ({ fetchedCount: 1, insertedCount: 1, updatedCount: 0, failedCount: 0 })
  })

  const response = await handler({ type: "popup/load" })
  assert.equal(response.summary.status, "idle")
})
```

Add a second test for `{ type: "sync/run" }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/background/index.test.ts`
Expected: FAIL because the runtime message contract and background handler do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/extension/src/lib/runtime/messages.ts` with exact shared message strings and response shapes:

```ts
export const LOAD_POPUP_DATA_MESSAGE = "popup/load"
export const RUN_SYNC_MESSAGE = "sync/run"
```

Create `apps/extension/src/background/index.ts` with a testable factory:

```ts
export function createBackgroundMessageHandler({ loadPopupData, runSync }: { loadPopupData: () => Promise<any>; runSync: () => Promise<any> }) {
  return async function handleMessage(message: { type: string }) {
    if (message.type === LOAD_POPUP_DATA_MESSAGE) {
      return loadPopupData()
    }
    if (message.type === RUN_SYNC_MESSAGE) {
      return runSync()
    }
    throw new Error(`Unsupported message type: ${message.type}`)
  }
}
```

Also register `chrome.runtime.onMessage.addListener(...)` when the Chrome runtime API exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/background/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/runtime/messages.ts apps/extension/src/background/index.ts apps/extension/tests/background/index.test.ts
git commit -m "feat: add background runtime message handlers"
```

### Task 7: Add popup-side runtime client helpers

**Files:**
- Create: `apps/extension/src/lib/runtime/popupClient.ts`
- Modify: `apps/extension/tests/popup/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Update the popup app test so the app loads persisted data through a runtime client instead of relying only on `initialBookmarks` props. The failing test should prove:
- the app shows loaded bookmark data after initial render
- clicking sync triggers the runtime sync call
- the app refreshes and shows updated summary data afterward

Minimal target flow:

```ts
const runtime = {
  loadPopupData: async () => ({
    bookmarks: [{ tweetId: "1", tweetUrl: "https://x.com/alice/status/1", authorName: "Alice", authorHandle: "alice", text: "hello app", createdAtOnX: "2026-03-15T00:00:00.000Z", savedAt: "2026-03-15T00:01:00.000Z", rawPayload: {} }],
    summary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 }
  }),
  runSync: async () => ({ fetchedCount: 1, insertedCount: 1, updatedCount: 0, failedCount: 0 })
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/popup/App.test.tsx`
Expected: FAIL because `App.tsx` still reads from static props and mutates summary locally.

- [ ] **Step 3: Write minimal implementation**

Create popup-side runtime helpers in `apps/extension/src/lib/runtime/popupClient.ts`:

```ts
export async function loadPopupData() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { bookmarks: [], summary: createEmptySyncSummary() }
  }

  return chrome.runtime.sendMessage({ type: LOAD_POPUP_DATA_MESSAGE })
}

export async function runSync() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 }
  }

  return chrome.runtime.sendMessage({ type: RUN_SYNC_MESSAGE })
}
```

Keep this file thin and message-focused.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/popup/App.test.tsx`
Expected: PASS once the popup can load and refresh through the runtime client.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/runtime/popupClient.ts apps/extension/tests/popup/App.test.tsx
git commit -m "feat: add popup runtime client"
```

### Task 8: Rewire the popup app to real runtime data

**Files:**
- Modify: `apps/extension/src/popup/App.tsx:1-45`
- Modify: `apps/extension/tests/popup/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Extend the existing app test so it verifies the full runtime-driven behavior:
- initial render shows loaded bookmarks from `loadPopupData()`
- sync button enters syncing state while request is in flight
- after sync completes, the app re-runs `loadPopupData()` and renders refreshed summary text

Example assertion target after refresh:

```ts
assert.match(container.textContent ?? "", /Status: success/)
assert.match(container.textContent ?? "", /Last synced:/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/popup/App.test.tsx`
Expected: FAIL because the component still uses static `useState(initialBookmarks)` and immediate local `setSummary(...)`.

- [ ] **Step 3: Write minimal implementation**

Refactor `App.tsx` to:
- store `bookmarks`, `selectedBookmarkId`, `summary`, and `isSyncing` as real state
- load initial data in `useEffect()` through `loadPopupData()`
- set the selected bookmark after load if none is selected
- call `runSync()` from the sync button handler
- re-run `loadPopupData()` after sync resolves

Minimal shape:

```tsx
useEffect(() => {
  void refreshPopupData()
}, [])

async function refreshPopupData() {
  const data = await loadPopupData()
  setBookmarks(data.bookmarks)
  setSummary(data.summary)
  setSelectedBookmarkId((current) => current ?? data.bookmarks[0]?.tweetId)
}

async function handleSync() {
  setIsSyncing(true)
  try {
    await runSync()
    await refreshPopupData()
  } finally {
    setIsSyncing(false)
  }
}
```

Keep the existing component composition (`SyncPanel`, `BookmarkList`, `BookmarkDetail`, `SettingsPanel`) intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/popup/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/popup/App.tsx apps/extension/tests/popup/App.test.tsx
git commit -m "feat: load popup state from runtime sync flow"
```

---

## Chunk 3: Verification

### Task 9: Run focused regression checks for storage and runtime integration

**Files:**
- Modify: `apps/extension/tests/storage/bookmarksStore.test.ts`
- Modify: `apps/extension/tests/storage/tagsStore.test.ts`
- Modify: `apps/extension/tests/storage/settings.test.ts`
- Modify: `apps/extension/tests/background/index.test.ts`
- Modify: `apps/extension/tests/background/syncBookmarks.test.ts`
- Modify: `apps/extension/tests/popup/App.test.tsx`

- [ ] **Step 1: Run the storage test suite**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/storage/bookmarksStore.test.ts apps/extension/tests/storage/tagsStore.test.ts apps/extension/tests/storage/settings.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the background test suite**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/background/syncBookmarks.test.ts apps/extension/tests/background/index.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the popup integration test**

Run: `npm --workspace @xbm/extension test -- apps/extension/tests/popup/App.test.tsx`
Expected: PASS.

- [ ] **Step 4: Run the full extension test suite**

Run: `npm --workspace @xbm/extension test`
Expected: PASS with all existing and new tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/tests/storage/bookmarksStore.test.ts apps/extension/tests/storage/tagsStore.test.ts apps/extension/tests/storage/settings.test.ts apps/extension/tests/background/index.test.ts apps/extension/tests/background/syncBookmarks.test.ts apps/extension/tests/popup/App.test.tsx
git commit -m "test: verify local storage and runtime integration"
```
