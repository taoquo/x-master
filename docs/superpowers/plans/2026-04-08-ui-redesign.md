# X Bookmark Manager UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the popup and options UI into a unified dark-first, theme-aware workspace system based on `DESIGN.md`.

**Architecture:** Keep the current runtime, storage, and business logic intact while rewriting the visual system around shared CSS tokens and stricter surface primitives. Update tests first to lock in the new popup and workspace structure, then implement the shared theme layer, popup shell, and options shell in sequence.

**Tech Stack:** React, TypeScript, Tailwind CSS v3, existing test runner with `tsx --test`

---

## File Structure

- Modify: `apps/extension/src/styles/extension.css` — rebuild design tokens, dark/light themes, shared panel/button/input classes
- Modify: `apps/extension/src/ui/components.tsx` — update shared panels, badges, empty state, metrics
- Modify: `apps/extension/src/ui/theme.ts` — refine status theme tokens
- Modify: `apps/extension/src/popup/App.tsx` — rebuild popup shell and top-level information hierarchy
- Modify: `apps/extension/src/popup/components/SyncPanel.tsx` — rebuild sync summary panel
- Modify: `apps/extension/src/options/OptionsApp.tsx` — rebuild three-column workspace shell and section styling
- Modify: `apps/extension/tests/popup/SyncPanel.test.tsx` — assert new popup sync panel structure
- Modify: `apps/extension/tests/popup/mountPopup.test.tsx` — assert new popup copy and theme behavior
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx` — assert new workspace shell structure while preserving behavior checks

## Task 1: Lock the popup redesign with failing tests

**Files:**
- Modify: `apps/extension/tests/popup/SyncPanel.test.tsx`
- Modify: `apps/extension/tests/popup/mountPopup.test.tsx`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run popup-focused tests to verify they fail for the new structure**
- [ ] **Step 3: Implement the minimal popup shell and sync panel changes**
- [ ] **Step 4: Re-run popup-focused tests to verify they pass**

## Task 2: Lock the workspace shell redesign with failing tests

**Files:**
- Modify: `apps/extension/tests/options/OptionsApp.test.tsx`

- [ ] **Step 1: Add or update tests for the new three-column shell semantics**
- [ ] **Step 2: Run the options-focused tests to verify they fail**
- [ ] **Step 3: Implement the minimal workspace shell updates**
- [ ] **Step 4: Re-run the options-focused tests to verify they pass**

## Task 3: Rebuild the shared theme and component system

**Files:**
- Modify: `apps/extension/src/styles/extension.css`
- Modify: `apps/extension/src/ui/components.tsx`
- Modify: `apps/extension/src/ui/theme.ts`

- [ ] **Step 1: Refactor theme tokens and shared utility classes**
- [ ] **Step 2: Update shared panel, badge, empty-state, and metric primitives**
- [ ] **Step 3: Re-run impacted popup and options tests**

## Task 4: Rebuild popup visuals on top of the new system

**Files:**
- Modify: `apps/extension/src/popup/App.tsx`
- Modify: `apps/extension/src/popup/components/SyncPanel.tsx`

- [ ] **Step 1: Implement the new popup information hierarchy**
- [ ] **Step 2: Wire sync summary visuals into the shared token system**
- [ ] **Step 3: Re-run popup tests and fix regressions**

## Task 5: Rebuild options visuals on top of the new system

**Files:**
- Modify: `apps/extension/src/options/OptionsApp.tsx`

- [ ] **Step 1: Refactor the outer workspace shell and section wrappers**
- [ ] **Step 2: Update sidebar, toolbar, results, and inspector visuals**
- [ ] **Step 3: Re-run options tests and fix regressions**

## Task 6: Verify the redesign end-to-end

**Files:**
- Modify if needed: test files above

- [ ] **Step 1: Run `npm run lint`**
- [ ] **Step 2: Run `npm run typecheck`**
- [ ] **Step 3: Run `npm test`**
- [ ] **Step 4: Run `npm run build`**

