# X Bookmark Manager Options Figma UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `options` page to match Figma node `2:892` in light mode and ship a dark-mode structural mapping without changing bookmark, list, tag, sync, or preference behavior.

**Architecture:** Keep all runtime logic inside `OptionsApp.tsx`, but replace the current visual shell with a Figma-aligned three-column layout: `320px` left sidebar, editorial main canvas with sticky header, and `340px` right inspector. Drive the work through tests first, then shared tokens/classes, then left/main/right layout slices, finishing with verification and dark-theme mapping.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, shared CSS in `apps/extension/src/styles/extension.css`, `tsx --test`, ESLint, TypeScript compiler

---

## File Structure

- Modify: `apps/extension/src/options/OptionsApp.tsx`
  - Rebuild the outer grid, left sidebar, main sticky header, result cards, and right inspector sections to match Figma.
- Modify: `apps/extension/src/styles/extension.css`
  - Replace the current slate/glass token system with the Figma warm-gray light theme and dark structural mapping.
- Modify: `apps/extension/src/ui/components.tsx`
  - Align shared empty-state and surface wrappers with the flatter Figma language.
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
  - Lock the new shell semantics, sidebar/footer structure, and inspector sections before production edits.

## Task 1: Lock the Figma shell with a failing test

**Files:**
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`
- Modify: `apps/extension/src/options/OptionsApp.tsx`

- [ ] **Step 1: Add a failing test for the Figma three-column shell and section headers**

```ts
test("OptionsApp renders the Figma shell with editorial rails", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "zh-CN",
    themePreference: "light",
    lastSyncSummary: {
      status: "success",
      fetchedCount: 2,
      insertedCount: 2,
      updatedCount: 0,
      failedCount: 0,
      lastSyncedAt: "2026-04-06T08:12:00.000Z"
    },
    classificationRules: []
  })

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const overview = findByTestId(container, "workspace-overview")
  const sidebar = findByTestId(container, "lists-sidebar")
  const library = findByTestId(container, "library-workspace")
  const inspector = container.querySelector('[data-testid="workspace-inspector"] [data-testid="inspector-section-stack"]')

  assert.ok(overview)
  assert.ok(sidebar)
  assert.ok(library)
  assert.ok(inspector)
  assert.match(overview?.className ?? "", /xl:grid-cols-\[320px_minmax\(0,1fr\)_340px\]/)
  assert.match(sidebar?.textContent ?? "", /工作区/)
  assert.match(sidebar?.textContent ?? "", /偏好设置|Config/)
  assert.match(library?.textContent ?? "", /资料库|Archive/)
  assert.match(container.textContent ?? "", /元数据|Metadata/)
  assert.match(container.textContent ?? "", /归档|Archival/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the new test fails for the old shell**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... renders the Figma shell with editorial rails
Expected pattern: /xl:grid-cols-\[320px_minmax\(0,1fr\)_340px\]/
```

- [ ] **Step 3: Update the outer grid and key test ids with the minimal Figma shell classes**

```tsx
<div
  data-testid="workspace-overview"
  className="grid gap-0 xl:min-h-0 xl:h-[100dvh] xl:grid-cols-[320px_minmax(0,1fr)_340px] xl:items-stretch">
```

```tsx
<aside data-testid="lists-sidebar" className="options-sidebar-shell">
```

```tsx
<section data-testid="library-workspace" className="options-main-shell">
```

```tsx
<SurfaceCard
  title={copy.detailsTitle}
  chrome="bare"
  className="options-inspector-shell">
```

- [ ] **Step 4: Re-run the focused options tests and confirm the shell test passes**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... renders the Figma shell with editorial rails
```

- [ ] **Step 5: Commit the shell baseline**

```bash
git add apps/extension/tests/options/OptionsApp.test.tsx apps/extension/src/options/OptionsApp.tsx
git commit -m "test: lock figma options shell"
```

## Task 2: Replace the global visual system with Figma-aligned tokens and primitives

**Files:**
- Modify: `apps/extension/src/styles/extension.css`
- Modify: `apps/extension/src/ui/components.tsx`
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`

- [ ] **Step 1: Add a failing test for the new shell class language**

```ts
test("OptionsApp uses the Figma surface classes instead of glass panels", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const sidebar = findByTestId(container, "lists-sidebar")
  const results = findByTestId(container, "library-results-summary")
  const emptyState = container.querySelector('[data-testid="workspace-inspector"] .workspace-empty-state')

  assert.ok(sidebar)
  assert.ok(results)
  assert.ok(emptyState)
  assert.match(sidebar?.className ?? "", /options-sidebar-shell/)
  assert.match(results?.className ?? "", /options-results-summary/)
  assert.doesNotMatch(container.innerHTML, /glass-button|panel-surface|panel-elevated/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the old classes still leak through**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... uses the Figma surface classes instead of glass panels
```

- [ ] **Step 3: Replace the old token system with the Figma light theme and dark mapping**

```css
:root {
  color-scheme: light;
  --page-bg: #f5f5f3;
  --main-bg: #fafafa;
  --side-bg: #ffffff;
  --border-subtle: #e8e8e5;
  --text-primary: #1a1a1a;
  --text-secondary: #737373;
  --text-tertiary: #a3a3a3;
  --tag-bg: #f5f5f3;
  --accent-blue: #4285f4;
  --accent-blue-hover: #2f74e7;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --page-bg: #171715;
  --main-bg: #1d1d1a;
  --side-bg: #20201d;
  --border-subtle: #34342f;
  --text-primary: #f3f2ee;
  --text-secondary: #b4b0a8;
  --text-tertiary: #8d887f;
  --tag-bg: #262622;
  --accent-blue: #5d96f6;
  --accent-blue-hover: #77a8fb;
}
```

```css
.options-sidebar-shell,
.options-inspector-shell {
  background: var(--side-bg);
  color: var(--text-primary);
}

.options-main-shell {
  background: var(--main-bg);
  color: var(--text-primary);
}
```

```tsx
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="workspace-empty-state">
      <h3 className="options-section-title">{title}</h3>
      {description ? <p className="options-body-copy">{description}</p> : null}
    </div>
  )
}
```

- [ ] **Step 4: Re-run the focused options tests and confirm the class language is clean**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... uses the Figma surface classes instead of glass panels
```

- [ ] **Step 5: Commit the token and primitive rewrite**

```bash
git add apps/extension/src/styles/extension.css apps/extension/src/ui/components.tsx apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: add figma options theme tokens"
```

## Task 3: Rebuild the left sidebar and right inspector to match Figma

**Files:**
- Modify: `apps/extension/src/options/OptionsApp.tsx`
- Modify: `apps/extension/src/styles/extension.css`
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`

- [ ] **Step 1: Add a failing test for sidebar and inspector section order**

```ts
test("OptionsApp orders sidebar and inspector sections like the Figma design", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const sidebarText = findByTestId(container, "lists-sidebar")?.textContent ?? ""
  const inspectorText = findByTestId(container, "workspace-inspector")?.textContent ?? ""

  assert.match(sidebarText, /工作区[\s\S]*总书签数[\s\S]*列表[\s\S]*偏好设置/)
  assert.match(inspectorText, /元数据[\s\S]*标签[\s\S]*归档[\s\S]*创建标签[\s\S]*标签库/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the old section ordering fails**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... orders sidebar and inspector sections like the Figma design
```

- [ ] **Step 3: Rewrite the left sidebar and right inspector markup with explicit Figma section wrappers**

```tsx
<section data-testid="sidebar-hero-section" className="options-sidebar-hero">
```

```tsx
<section data-testid="sidebar-stats-section" className="options-sidebar-stats">
```

```tsx
<section data-testid="sidebar-footer-section" className="options-sidebar-config">
```

```tsx
<section data-testid="inspector-meta-section" className="options-inspector-section">
```

```tsx
<section data-testid="inspector-tags-section" className="options-inspector-section">
```

```tsx
<section data-testid="inspector-assignment-section" className="options-inspector-section">
```

```css
.options-sidebar-hero,
.options-sidebar-stats,
.options-sidebar-config,
.options-inspector-section {
  border-bottom: 1px solid var(--border-subtle);
}
```

- [ ] **Step 4: Re-run the focused options tests and confirm the new section order passes**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... orders sidebar and inspector sections like the Figma design
```

- [ ] **Step 5: Commit the sidebar and inspector rebuild**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/src/styles/extension.css apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: rebuild options side rails from figma"
```

## Task 4: Rebuild the main sticky header and result cards to match Figma

**Files:**
- Modify: `apps/extension/src/options/OptionsApp.tsx`
- Modify: `apps/extension/src/styles/extension.css`
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`

- [ ] **Step 1: Add a failing test for the editorial header and flatter result cards**

```ts
test("OptionsApp renders the Figma archive header and result cards", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await upsertBookmarks([
    {
      tweetId: "tweet-1",
      tweetUrl: "https://x.com/alice/status/tweet-1",
      authorName: "Alice",
      authorHandle: "alice",
      text: "React agents workflow",
      createdAtOnX: "2026-03-15T00:00:00.000Z",
      savedAt: "2026-03-15T01:00:00.000Z",
      rawPayload: {}
    }
  ])

  const { container } = render(React.createElement(OptionsApp))
  await settle()

  const header = findByTestId(container, "library-header-section")
  const cards = getBookmarkCards(container)

  assert.ok(header)
  assert.equal(cards.length, 1)
  assert.match(header?.className ?? "", /options-main-header/)
  assert.match(header?.textContent ?? "", /资料库|Archive/)
  assert.match(cards[0].className, /options-result-card/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the current header/card classes fail**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... renders the Figma archive header and result cards
```

- [ ] **Step 3: Replace the main header and card markup with the Figma editorial structure**

```tsx
<div data-testid="library-header-section" className="options-main-header">
```

```tsx
<div data-testid="workspace-toolbar" className="options-toolbar-grid">
```

```tsx
<article
  data-bookmark-card={bookmark.tweetId}
  className={cn("options-result-card", selected && "options-result-card-selected")}>
```

```css
.options-main-header {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(250, 250, 250, 0.8);
  backdrop-filter: blur(6px);
}

.options-result-card {
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 24px -20px rgba(0, 0, 0, 0.18);
}
```

- [ ] **Step 4: Re-run the focused options tests and confirm the main workspace test passes**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
PASS ... renders the Figma archive header and result cards
```

- [ ] **Step 5: Commit the main workspace rebuild**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/src/styles/extension.css apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: rebuild figma options main workspace"
```

## Task 5: Verify dark-theme mapping and full project health

**Files:**
- Modify: `apps/extension/src/styles/extension.css`
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`

- [ ] **Step 1: Add a failing test for dark-theme shell mapping**

```ts
test("OptionsApp preserves the Figma shell in dark mode", async () => {
  installChromeRuntimeHarness()
  await resetBookmarksDb()
  await saveSettings({
    schemaVersion: 3,
    locale: "en",
    themePreference: "dark",
    lastSyncSummary: { status: "idle", fetchedCount: 0, insertedCount: 0, updatedCount: 0, failedCount: 0 },
    classificationRules: []
  })

  const { container, dom } = render(React.createElement(OptionsApp))
  await settle()

  assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
  assert.match(findByTestId(container, "lists-sidebar")?.className ?? "", /options-sidebar-shell/)
  assert.match(findByTestId(container, "library-workspace")?.className ?? "", /options-main-shell/)
})
```

- [ ] **Step 2: Run the focused options tests and confirm the dark mapping test fails until the shell is complete**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
```

Expected:

```text
FAIL ... preserves the Figma shell in dark mode
```

- [ ] **Step 3: Finish dark-theme mappings and any remaining semantic class gaps**

```css
:root[data-theme="dark"] .options-main-header {
  background: rgba(29, 29, 26, 0.82);
}

:root[data-theme="dark"] .options-result-card {
  background: #22221f;
  box-shadow: none;
}
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx
npm run lint
npm run typecheck
npm test
npm run build
```

Expected:

```text
PASS tests/options/OptionsApp.test.tsx
PASS lint
PASS typecheck
PASS npm test
PASS build
```

- [ ] **Step 5: Commit the completed Figma rebuild**

```bash
git add apps/extension/src/styles/extension.css apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: finish figma options rebuild"
```

## Self-Review

- Spec coverage: covers fixed three-column shell, editorial typography, left/main/right section ordering, sticky header, flatter result cards, and dark-theme mapping.
- Placeholder scan: no `TODO`, `TBD`, or deferred implementation notes remain.
- Type consistency: all tasks target the same four files and the same semantic class family: `options-sidebar-shell`, `options-main-shell`, `options-inspector-shell`, `options-main-header`, `options-result-card`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-08-ui-redesign.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

The user has already requested implementation to start immediately, so proceed with Inline Execution unless a blocker appears.
