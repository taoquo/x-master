# X Knowledge Cards Design System

## Product Story

This product is not a bookmark manager. It is a local-first workflow that turns saved technical discussion into reusable learning assets.

The product story is:

`Source Material -> Knowledge Card -> Vault Export`

Users should always know which stage they are in.

## V1 Source Model

V1 does **not** reconstruct full X threads.

The ingest model is:

- one saved X post
- or one saved `note_tweet`

Every generated card in v1 is derived from exactly one saved source item.

## Core Objects

- `Source Material`
  - One raw saved X post or one raw saved `note_tweet`
  - Tagged and triaged in Inbox
  - Never presented as the final learning asset

- `Knowledge Card`
  - Generated learning artifact derived from source material
  - Lives in one of three lifecycle states: `draft`, `reviewed`, `stale`
  - Reviewed and refined in Library

- `Vault Export`
  - Obsidian-ready bundle of sources and cards
  - Produced from Settings

## Page Responsibilities

- `Dashboard`
  - Use a single hero card as the dominant entry point
  - Merge onboarding and recommendation into one next-action surface
  - Summarize source and card health

- `Inbox`
  - Behave like a source triage desk
  - Tag, filter, and inspect raw inputs
  - Never imply the user is editing a final card

- `Library`
  - Review generated cards
  - Manage lifecycle state
  - Keep provenance and source visible while editing

- `Settings`
  - Use page-internal navigation
  - Split concerns into `Pipeline`, `Knowledge setup`, and `System`
  - Make export feel like a production action, not just a button
  - Handle dangerous system actions

- `Popup`
  - Act as a lightweight decision entry point
  - Surface the next best action before raw status counters
  - Push the user into the workspace only when there is meaningful work to do

## Language Rules

Prefer these terms consistently:

- `Source Material`
- `Knowledge Card`
- `Draft Queue`
- `Reviewed Library`
- `Stale Review`
- `Vault Export`

Avoid generic alternatives like:

- bookmarks app
- saved items
- note tool
- data export

unless the context is explicitly technical.

## Hierarchy Rules

Every page must answer one primary question first:

- Dashboard: `What should I do next?`
- Inbox: `Which source materials still need triage?`
- Library: `Which cards need review right now?`
- Settings: `How is the pipeline configured and what will be exported?`
- Popup: `Should I open the workspace, and if so, for what?`

Primary action should be singular. Secondary actions must be visually lighter.

## Navigation Rules

- `Dashboard` should route the user into one concrete queue, not just describe the workspace.
- `Inbox` should frame filters as triage controls, not generic search chrome.
- `Library` lifecycle modes are primary navigation, not secondary filters.
- `Settings` section switching should be explicit and stable.
- `Popup` should use one recommended CTA, not multiple equal-weight exits.

## Lifecycle Rules

- `Draft`
  - Freshly generated card
  - Waiting for a human pass

- `Reviewed`
  - Human-confirmed card
  - Safe to revisit or export

- `Stale`
  - Previously reviewed card whose source material changed
  - Requires another pass before trust is restored

## Empty State Rules

Every empty state must answer:

1. What is missing
2. Why it is missing
3. What the user should do next

Examples:

- No source material yet -> run first sync
- No cards yet -> enable generation or sync again
- No stale cards -> all reviewed cards are aligned with their sources

## Responsive Rules

- Desktop is a workbench:
  - multiple panes are acceptable
- Narrow screens are task-focused:
  - one primary pane should dominate at a time
- Scroll behavior must be explicit:
  - every long pane owns its own scrolling region

## Trust Rules

AI-generated cards must always expose:

- generation source
- quality signal
- warnings
- provenance
- lifecycle state

The interface should never imply that an unreviewed AI draft is final.
