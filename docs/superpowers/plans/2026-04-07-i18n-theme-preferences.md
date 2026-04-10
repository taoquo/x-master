# I18N And Theme Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global locale and theme preferences to the extension, configured in the options page and consumed by both options and popup UIs.

**Architecture:** Extend the existing `chrome.storage.local` settings object with `locale` and `themePreference`, then move locale/theme resolution into `ExtensionUiProvider`. The provider becomes the single place that loads preferences, translates static strings, resolves `system` theme to `light` or `dark`, and applies a root `data-theme` attribute so CSS can switch visual tokens without scattering logic through components.

**Tech Stack:** React, TypeScript, chrome.storage.local, node:test, jsdom, Tailwind CSS

---

## File Structure

- Modify: `apps/extension/src/lib/types.ts` - add locale/theme preference types on settings
- Modify: `apps/extension/src/lib/storage/settings.ts` - normalize and persist new preferences
- Modify: `apps/extension/tests/storage/settings.test.ts` - cover defaults, migration, and persistence
- Create: `apps/extension/src/ui/i18n.ts` - small dictionary and locale/theme helper types
- Modify: `apps/extension/src/ui/provider.tsx` - load settings, expose `t()`, resolve/apply theme, expose update methods
- Modify: `apps/extension/src/options/OptionsApp.tsx` - add Preferences section and translate UI copy used by changed surfaces
- Modify: `apps/extension/src/popup/App.tsx` - consume translated strings and resolved theme
- Modify: `apps/extension/src/styles/extension.css` - add theme tokens and dark-mode variants
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx` - cover default Chinese rendering and preference updates
- Modify: `apps/extension/tests/popup/mountPopup.test.tsx` - cover popup locale/theme behavior

### Task 1: Extend persisted settings with locale and theme preference

**Files:**
- Modify: `apps/extension/src/lib/types.ts`
- Modify: `apps/extension/src/lib/storage/settings.ts`
- Test: `apps/extension/tests/storage/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Add storage tests that prove defaults and legacy migration fill in the new fields:

```ts
assert.equal(settings.locale, "zh-CN")
assert.equal(settings.themePreference, "system")
```

And add a persistence test:

```ts
await saveSettings({
  schemaVersion: 3,
  locale: "en",
  themePreference: "dark",
  lastSyncSummary: createEmptySyncSummary(),
  classificationRules: []
})

const settings = await getSettings()
assert.equal(settings.locale, "en")
assert.equal(settings.themePreference, "dark")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- tests/storage/settings.test.ts`
Expected: FAIL because `ExtensionSettings` and normalization do not yet include `locale` or `themePreference`.

- [ ] **Step 3: Write minimal implementation**

Update the settings shape to:

```ts
export type Locale = "zh-CN" | "en"
export type ThemePreference = "system" | "light" | "dark"

export interface ExtensionSettings {
  schemaVersion: number
  locale: Locale
  themePreference: ThemePreference
  lastSyncSummary: SyncSummary
  classificationRules: ClassificationRule[]
}
```

Update settings defaults and normalization so missing or invalid values fall back to `"zh-CN"` and `"system"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- tests/storage/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/lib/types.ts apps/extension/src/lib/storage/settings.ts apps/extension/tests/storage/settings.test.ts
git commit -m "feat: persist locale and theme preferences"
```

### Task 2: Build the provider-based locale and theme layer

**Files:**
- Create: `apps/extension/src/ui/i18n.ts`
- Modify: `apps/extension/src/ui/provider.tsx`

- [ ] **Step 1: Write the failing test**

Add a rendering test in an existing UI test file that mounts a small component under `ExtensionUiProvider` and expects Chinese defaults:

```ts
function Probe() {
  const { locale, themePreference, resolvedTheme, t } = useExtensionUi()
  return (
    <div data-theme={resolvedTheme}>
      {locale}|{themePreference}|{t("common.syncNow")}
    </div>
  )
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- tests/popup/mountPopup.test.tsx`
Expected: FAIL because the provider has no context API and no translation/theme state.

- [ ] **Step 3: Write minimal implementation**

Create a narrow provider contract:

```ts
interface ExtensionUiValue {
  locale: Locale
  themePreference: ThemePreference
  resolvedTheme: "light" | "dark"
  t: (key: MessageKey) => string
  setLocale: (locale: Locale) => Promise<void>
  setThemePreference: (preference: ThemePreference) => Promise<void>
}
```

Implement:

- settings load on mount
- `matchMedia("(prefers-color-scheme: dark)")` resolution for `system`
- root `data-theme` application on `document.documentElement`
- a tiny `messages` dictionary in `apps/extension/src/ui/i18n.ts`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- tests/popup/mountPopup.test.tsx`
Expected: PASS for the provider probe test.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/ui/i18n.ts apps/extension/src/ui/provider.tsx apps/extension/tests/popup/mountPopup.test.tsx
git commit -m "feat: add extension locale and theme provider"
```

### Task 3: Add Preferences controls to the options page and translate changed copy

**Files:**
- Modify: `apps/extension/src/options/OptionsApp.tsx`
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add assertions for default Chinese UI and settings updates:

```ts
assert.match(container.textContent ?? "", /书签/)
assert.match(container.textContent ?? "", /偏好设置/)
```

Then change the language selector to English and assert the visible text updates:

```ts
const localeSelect = findInputByLabel(container, "语言") as HTMLSelectElement
setSelectValue(localeSelect, "en", dom.window)
await settle()
assert.match(container.textContent ?? "", /Bookmarks/)
assert.match(container.textContent ?? "", /Preferences/)
```

Also change the theme selector and confirm saved settings changed:

```ts
const settings = await getSettings()
assert.equal(settings.themePreference, "dark")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- tests/options/OptionsApp.test.tsx`
Expected: FAIL because the options page has no preferences section and current copy is English-only.

- [ ] **Step 3: Write minimal implementation**

Inside `OptionsApp`:

- consume `useExtensionUi()`
- add a compact `Preferences` surface
- wire language selector to `setLocale`
- wire theme selector to `setThemePreference`
- translate visible strings for the options surfaces touched by the tests
- use active locale in `formatTimestamp`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- tests/options/OptionsApp.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/options/OptionsApp.tsx apps/extension/tests/options/OptionsApp.test.tsx
git commit -m "feat: add options preferences controls"
```

### Task 4: Make the popup consume translated copy and theme tokens

**Files:**
- Modify: `apps/extension/src/popup/App.tsx`
- Modify: `apps/extension/src/styles/extension.css`
- Modify: `apps/extension/tests/popup/mountPopup.test.tsx`

- [ ] **Step 1: Write the failing tests**

Extend popup tests to cover:

```ts
assert.match(dom.window.document.body.textContent ?? "", /工作区快照/)
assert.equal(dom.window.document.documentElement.dataset.theme, "light")
```

And for stored English + dark mode:

```ts
assert.match(dom.window.document.body.textContent ?? "", /Workspace snapshot/)
assert.equal(dom.window.document.documentElement.dataset.theme, "dark")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @xbm/extension test -- tests/popup/mountPopup.test.tsx`
Expected: FAIL because popup strings are not translated and no theme attribute is applied.

- [ ] **Step 3: Write minimal implementation**

Update popup copy to use `t()` and move major surface colors onto CSS variables:

```css
:root {
  --app-bg: linear-gradient(...);
  --text-primary: #161412;
  --panel-bg: rgba(255, 255, 255, 0.35);
}

:root[data-theme="dark"] {
  --app-bg: linear-gradient(...dark...);
  --text-primary: #f8fafc;
  --panel-bg: rgba(15, 23, 42, 0.58);
}
```

Apply these variables to body, glass panels, buttons, fields, and the popup shell so theme changes are visible immediately.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @xbm/extension test -- tests/popup/mountPopup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/popup/App.tsx apps/extension/src/styles/extension.css apps/extension/tests/popup/mountPopup.test.tsx
git commit -m "feat: localize popup and apply theme tokens"
```

### Task 5: Full verification

**Files:**
- Modify: implementation files from Tasks 1-4 as needed

- [ ] **Step 1: Run focused tests**

Run: `npm --workspace @xbm/extension test -- tests/storage/settings.test.ts tests/options/OptionsApp.test.tsx tests/popup/mountPopup.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit final polish**

```bash
git add apps/extension/src/lib/types.ts apps/extension/src/lib/storage/settings.ts apps/extension/src/ui/i18n.ts apps/extension/src/ui/provider.tsx apps/extension/src/options/OptionsApp.tsx apps/extension/src/popup/App.tsx apps/extension/src/styles/extension.css apps/extension/tests/storage/settings.test.ts apps/extension/tests/options/OptionsApp.test.tsx apps/extension/tests/popup/mountPopup.test.tsx docs/superpowers/plans/2026-04-07-i18n-theme-preferences.md
git commit -m "feat: add i18n and theme preferences"
```
