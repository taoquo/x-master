# Options Demo Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `options` page so its UI and interaction match `demo/` while still using the extension's real bookmark data, settings, and commands.

**Architecture:** Keep the runtime/data hooks intact, but reshape `OptionsApp.tsx` into the demo's three-column shell. Drive the work by updating tests first, then replacing the left rail, main workspace toolbar/results, and right inspector. Finish by aligning i18n copy and theme tokens, then verify with tests, lint, and typecheck.

**Tech Stack:** React 19, TypeScript, extension runtime hooks, shared CSS in `apps/extension/src/styles/extension.css`, `tsx --test`, ESLint, TypeScript compiler

---

## File Structure

- Modify: `apps/extension/src/options/OptionsApp.tsx`
  - Rebuild the page shell, tag navigation, toolbar, grid/list result views, inspector, and preference controls.
- Modify: `apps/extension/src/styles/extension.css`
  - Replace the current options-specific shell styles with demo-aligned light and dark tokens.
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
  - Lock the new shell structure, toolbar behavior, inspector states, and preference toggles.

## Task 1: Lock the demo shell and remove old options panels

**Files:**
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
- Modify: `apps/extension/src/options/OptionsApp.tsx`

- [ ] **Step 1: Add a failing test for the demo-first shell**

```ts
test("OptionsApp renders the demo shell and hides legacy options panels", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-demo-1",
      tweetUrl: "https://x.com/alice/status/tweet-demo-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Demo shell bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  assert.match(container.textContent ?? "", /工作区/)
  assert.match(container.textContent ?? "", /资料库/)
  assert.match(container.textContent ?? "", /全部书签/)
  assert.match(container.textContent ?? "", /筛选/)
  assert.equal(findByTestId(container, "workspace-preferences-inline"), null)
  assert.equal(container.querySelector(".options-advanced-panel"), null)
  assert.equal(container.querySelector(".options-bulk-panel"), null)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the new shell test fails**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... renders the demo shell and hides legacy options panels
```

- [ ] **Step 3: Reshape the top-level JSX to the demo shell**

```tsx
<div data-testid="workspace-overview" className="options-demo-layout">
  <aside data-testid="lists-sidebar" className="options-demo-sidebar">
    <div className="options-demo-sidebar-header">
      <p className="options-demo-kicker">{copy.workspaceBadge}</p>
      <h1>{copy.pageTitle}</h1>
      <button type="button" onClick={() => void workspace.handleSync()}>{workspace.isSyncing ? copy.syncing : copy.syncNow}</button>
    </div>
    <div className="options-demo-sidebar-tags">
      <button type="button" onClick={() => handleTagToggle("all")}>{copy.allBookmarks}</button>
      {workspace.tags.map((tag) => (
        <button key={tag.id} type="button" onClick={() => handleTagToggle(tag.id)}>
          {tag.name}
        </button>
      ))}
    </div>
    <div className="options-demo-sidebar-footer">
      <button type="button" data-testid="footer-settings-button" aria-label={copy.preferencesLabel} />
      <button type="button" data-testid="footer-locale-toggle" onClick={() => void setLocale(locale === "zh-CN" ? "en" : "zh-CN")}>{locale === "zh-CN" ? "中" : "EN"}</button>
      <button type="button" data-testid="footer-theme-toggle" onClick={() => void setThemePreference(themePreference === "dark" ? "light" : "dark")} />
      <button type="button" data-testid="footer-info-button" aria-label={copy.infoLabel} />
    </div>
  </aside>
  <section data-testid="library-workspace" className="options-demo-main">
    <header className="options-demo-main-header">
      <p className="options-demo-kicker">{copy.archiveLabel}</p>
      <h2>{currentScopeLabel}</h2>
      <div>{filteredBookmarks.length} {copy.resultsLabel}</div>
    </header>
    <section className="options-demo-toolbar">
      <input id={searchId} value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={copy.searchPlaceholder} />
      <button type="button" data-testid="filter-trigger">{copy.filters}</button>
      <button type="button" data-testid="sort-trigger">{copy.latestSaved}</button>
      <button type="button" data-testid="view-toggle-grid" onClick={() => setViewMode("grid")} />
      <button type="button" data-testid="view-toggle-list" onClick={() => setViewMode("list")} />
    </section>
    <section data-testid="results-stack" className="options-results-grid">
      {filteredBookmarks.map((bookmark) => (
        <BookmarkCard key={bookmark.tweetId} bookmark={bookmark} viewMode={viewMode} selected={selectedBookmarkId === bookmark.tweetId} onSelect={() => setSelectedBookmarkId(bookmark.tweetId)} />
      ))}
    </section>
  </section>
  <aside data-testid="workspace-inspector" className="options-demo-inspector">
    <div className="options-demo-inspector-body">
      {selectedBookmark ? <BookmarkInspector bookmark={selectedBookmark} /> : <EmptyState title={copy.detailsTitle} description={copy.noBookmarkSelectedDescription} />}
    </div>
  </aside>
</div>
```

```tsx
// Delete the old inline preferences block, advanced filters panel, and bulk action panel
// from the render tree so the demo shell becomes the only visible path.
```

- [ ] **Step 4: Re-run the focused options tests and confirm the shell test passes**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... renders the demo shell and hides legacy options panels
```

- [ ] **Step 5: Commit the shell baseline**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "test: lock options demo shell"
```

## Task 2: Rebuild the left sidebar as demo tag navigation and footer preferences

**Files:**
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
- Modify: `apps/extension/src/options/OptionsApp.tsx`
- Modify: `apps/extension/src/styles/extension.css`

- [ ] **Step 1: Add a failing test for tag navigation and footer preference buttons**

```ts
test("OptionsApp uses demo tag navigation and footer preference toggles", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  const tag = await createTag({ name: "AI" })
  await upsertBookmarks([
    {
      tweetId: "tweet-demo-tag",
      tweetUrl: "https://x.com/alice/status/tweet-demo-tag",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Tagged bookmark",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])
  await attachTagToBookmark({ bookmarkId: "tweet-demo-tag", tagId: tag.id })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.match(findByTestId(container, "lists-sidebar")?.textContent ?? "", /全部书签/)
  assert.match(findByTestId(container, "lists-sidebar")?.textContent ?? "", /AI/)
  assert.ok(findByTestId(container, "footer-locale-toggle"))
  assert.ok(findByTestId(container, "footer-theme-toggle"))

  const localeToggle = findByTestId(container, "footer-locale-toggle") as HTMLButtonElement
  await act(async () => {
    localeToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /Bookmarks/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the new sidebar test fails**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... uses demo tag navigation and footer preference toggles
```

- [ ] **Step 3: Replace the left rail with demo-aligned sections**

```tsx
const [activeTagIds, setActiveTagIds] = useState<string[]>(["all"])

function handleTagToggle(tagId: string) {
  if (tagId === "all") {
    setActiveTagIds(["all"])
    return
  }

  setActiveTagIds((current) => {
    const next = current.includes("all") ? [tagId] : current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]
    return next.length ? next : ["all"]
  })
}
```

```tsx
<button data-testid="footer-locale-toggle" type="button" onClick={() => void setLocale(locale === "zh-CN" ? "en" : "zh-CN")}>
  {locale === "zh-CN" ? "中" : "EN"}
</button>
<button data-testid="footer-theme-toggle" type="button" onClick={() => void setThemePreference(themePreference === "dark" ? "light" : "dark")}>
  {themePreference === "dark" ? <Moon className="h-4 w-4" weight="regular" /> : <Sun className="h-4 w-4" weight="regular" />}
</button>
```

```css
.options-demo-sidebar {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  background: var(--side-bg);
}
```

- [ ] **Step 4: Re-run the focused options tests and confirm the sidebar test passes**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... uses demo tag navigation and footer preference toggles
```

- [ ] **Step 5: Commit the sidebar rewrite**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/src/styles/extension.css apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: align options sidebar with demo"
```

## Task 3: Rebuild the toolbar, filter popover, and grid/list result views

**Files:**
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
- Modify: `apps/extension/src/options/OptionsApp.tsx`
- Modify: `apps/extension/src/styles/extension.css`

- [ ] **Step 1: Add a failing test for toolbar controls and layout switching**

```ts
test("OptionsApp switches between grid and list views and shows active demo filters", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-grid",
      tweetUrl: "https://x.com/alice/status/tweet-grid",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Bookmark with media",
      media: [{ type: "photo", mediaUrlHttps: "https://example.com/image.jpg" }],
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  const listToggle = findByTestId(container, "view-toggle-list") as HTMLButtonElement
  await act(async () => {
    listToggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(findByTestId(container, "results-stack")?.className ?? "", /options-results-list/)
  assert.match(container.textContent ?? "", /最近保存/)
  assert.match(container.textContent ?? "", /全选可见项/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the toolbar test fails**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... switches between grid and list views and shows active demo filters
```

- [ ] **Step 3: Implement the demo toolbar and result layouts**

```tsx
const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

const filteredBookmarks = useMemo(() => {
  const tagScopedBookmarks = activeTagIds.includes("all")
    ? workspace.bookmarks
    : workspace.bookmarks.filter((bookmark) => {
        const tagNames = new Set(tagNamesByBookmarkId.get(bookmark.tweetId) ?? [])
        return activeTagIds.every((tagId) => tagNames.has(tagsById.get(tagId)?.name ?? ""))
      })

  return applyBookmarkFilters(tagScopedBookmarks, {
    query,
    bookmarkLists: workspace.bookmarkLists,
    selectedListId: undefined,
    bookmarkTags: workspace.bookmarkTags,
    selectedAuthorHandles: [],
    authorMatchMode: "any",
    selectedTagIds: [],
    tagMatchMode: "all",
    timeRange: "all",
    onlyWithMedia,
    onlyLongform,
    sortOrder
  })
}, [activeTagIds, onlyLongform, onlyWithMedia, query, sortOrder, tagNamesByBookmarkId, tagsById, workspace.bookmarkLists, workspace.bookmarkTags, workspace.bookmarks])
```

```tsx
<button data-testid="view-toggle-grid" type="button" onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"}>
  <SquaresFour className="h-4 w-4" weight="regular" />
</button>
<button data-testid="view-toggle-list" type="button" onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"}>
  <Rows className="h-4 w-4" weight="regular" />
</button>

<div data-testid="results-stack" className={viewMode === "grid" ? "options-results-grid" : "options-results-list"}>
  {filteredBookmarks.map((bookmark) => (
    <BookmarkCard
      key={bookmark.tweetId}
      bookmark={bookmark}
      viewMode={viewMode}
      selected={selectedBookmarkId === bookmark.tweetId}
      onSelect={() => setSelectedBookmarkId(bookmark.tweetId)}
    />
  ))}
</div>
```

```tsx
<div data-testid="filter-popover">
  <label>
    <input type="checkbox" checked={onlyWithMedia} onChange={(event) => setOnlyWithMedia(event.currentTarget.checked)} />
    {copy.hasMedia}
  </label>
  <label>
    <input type="checkbox" checked={onlyLongform} onChange={(event) => setOnlyLongform(event.currentTarget.checked)} />
    {copy.longform}
  </label>
  <label className="is-disabled"><input type="checkbox" disabled />{copy.unread}</label>
  <label className="is-disabled"><input type="checkbox" disabled />{copy.archived}</label>
</div>
```

- [ ] **Step 4: Re-run the focused options tests and confirm the toolbar test passes**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... switches between grid and list views and shows active demo filters
```

- [ ] **Step 5: Commit the toolbar and result view rewrite**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/src/styles/extension.css apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: align options toolbar and results with demo"
```

## Task 4: Rebuild the right inspector, i18n copy, and dark theme mapping

**Files:**
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
- Modify: `apps/extension/src/options/OptionsApp.tsx`
- Modify: `apps/extension/src/styles/extension.css`

- [ ] **Step 1: Add a failing test for inspector states and localized demo copy**

```ts
test("OptionsApp renders the demo inspector and localized copy", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-inspector",
      tweetUrl: "https://x.com/alice/status/tweet-inspector",
      authorName: "Alice",
      authorHandle: "alice",
      text: "Inspector content summary",
      createdAtOnX: "2026-04-09T08:00:00.000Z",
      savedAt: "2026-04-09T08:10:00.000Z",
      rawPayload: {}
    }
  ])

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.match(container.textContent ?? "", /选择一个书签以查看详情/)

  const card = getBookmarkCards(container)[0] as HTMLElement
  await act(async () => {
    card.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  })
  await settle()

  assert.match(container.textContent ?? "", /元数据/)
  assert.match(container.textContent ?? "", /内容摘要/)
  assert.match(container.textContent ?? "", /在 X 中打开/)
  assert.match(container.textContent ?? "", /添加标签/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the inspector test fails**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... renders the demo inspector and localized copy
```

- [ ] **Step 3: Replace the inspector sections and align localized copy**

```ts
function getOptionsCopy(locale: Locale) {
  if (locale === "zh-CN") {
    return {
      pageTitle: "书签",
      allBookmarks: "全部书签",
      searchPlaceholder: "搜索书签、作者和备注...",
      filters: "筛选",
      latestSaved: "最近保存",
      selectVisible: "全选可见项",
      activeFilters: "活跃筛选:",
      noBookmarkSelectedDescription: "选择一个书签以查看详情",
      metadataTitle: "元数据",
      summaryTitle: "内容摘要",
      openOnX: "在 X 中打开",
      addTag: "添加标签",
      unread: "未读",
      archived: "已归档"
    }
  }

  return {
    pageTitle: "Bookmarks",
    allBookmarks: "All bookmarks",
    searchPlaceholder: "Search bookmarks, authors and notes...",
    filters: "Filters",
    latestSaved: "Recently saved",
    selectVisible: "Select visible",
    activeFilters: "Active filters:",
    noBookmarkSelectedDescription: "Select a bookmark to view details",
    metadataTitle: "Metadata",
    summaryTitle: "Summary",
    openOnX: "Open on X",
    addTag: "Add tag",
    unread: "Unread",
    archived: "Archived"
  }
}
```

```css
:root {
  --options-page-bg: #f7f8fb;
  --options-surface: #ffffff;
  --options-muted: #94a3b8;
  --options-border: #e2e8f0;
  --options-chip-bg: #eff6ff;
  --options-chip-fg: #2563eb;
}

:root[data-theme="dark"] {
  --options-page-bg: #0f172a;
  --options-surface: #111827;
  --options-muted: #94a3b8;
  --options-border: #1f2937;
  --options-chip-bg: rgba(37, 99, 235, 0.2);
  --options-chip-fg: #93c5fd;
}
```

- [ ] **Step 4: Re-run focused tests, lint, and typecheck**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
npm test
npm run lint
npm run typecheck
```

Expected:

```text
PASS ... tests/options/OptionsApp.test.tsx
PASS ... npm test
exit 0 ... npm run lint
exit 0 ... npm run typecheck
```

- [ ] **Step 5: Commit the inspector, i18n, and theme finish**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/src/styles/extension.css apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: finish options demo alignment"
```
