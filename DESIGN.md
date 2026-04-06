# X Knowledge Cards Design Requirements

## Product Definition

X Knowledge Cards is a local-first browser extension that turns saved X posts into reviewed knowledge assets.

The product is not a generic bookmark manager. The core workflow is:

`Source Material -> Knowledge Card -> Vault Export`

Users should always know:

- what stage they are in
- what is trustworthy already
- what still needs human review
- what the next best action is

## V1 Product Scope

V1 is intentionally narrow.

Included:

- manual sync of saved X posts into a local workspace
- support for one saved X post or one saved `note_tweet` as one source item
- local tagging and queue triage
- AI or heuristic generation of one knowledge card draft per source item
- human review of generated cards
- local export to an Obsidian-ready vault bundle
- popup entry point plus full workspace in the side panel / options surface

Explicitly out of scope:

- full thread reconstruction
- multi-source synthesis into one card
- collaboration or cloud sync
- publishing back to X
- analytics-heavy bookmark management features
- treating raw source items as final notes

## Core Objects

- `Source Material`: one raw saved X post or one raw `note_tweet`, inspected and triaged in Inbox
- `Knowledge Card`: one generated card derived from exactly one source item, reviewed and managed in Library
- `Vault Export`: an Obsidian-ready bundle of reviewed output and supporting sources, configured and triggered from Settings

## Primary User and Job

The current product is optimized for people saving technical posts, ideas, and implementation notes from X, then converting them into reusable reference material.

The core user job is:

1. capture raw source material quickly
2. organize and triage it with light structure
3. review AI-generated drafts for trustworthiness
4. export only the material worth keeping in a long-term vault

## Design Goals

### 1. Trust First

The interface must never imply that an unreviewed AI draft is final.

### 2. Stage Clarity

The user should always understand whether they are looking at:

- raw source material
- generated draft content
- reviewed library content
- exported output settings

### 3. Workbench Over Feed

This is a focused review tool, not an infinite feed. Layout, hierarchy, and actions should feel operational and deliberate.

### 4. Queue Pressure Visibility

The product should make backlog visible without feeling noisy. Draft, stale, and sync health should be legible at a glance.

### 5. Local-First Calm

The tone should feel private, credible, and lightweight. Avoid social-product energy, growth-product language, or noisy dashboard chrome.

## Experience Principles

- One page, one primary question.
- One section, one dominant action.
- Source context should remain visible wherever trust decisions happen.
- Operational status should be compact but always available.
- Filters should help triage, not turn the UI into search software.
- Export should feel like shipping reviewed work, not downloading raw data.

## Product Language

Prefer these terms:

- `Source Material`
- `Source Queue`
- `Knowledge Card`
- `Draft Queue`
- `Reviewed Library`
- `Stale Review`
- `Vault Export`

Avoid generic alternatives like:

- bookmark manager
- saved items
- notes tool
- data export

Use technical implementation terms only when the context is explicitly system-facing, such as permissions, models, or sync failures.

## Information Architecture

The main workspace should keep four top-level sections:

- `Dashboard`
- `Inbox`
- `Library`
- `Settings`

The popup is a separate lightweight entry surface, not a fifth full workspace page.

### Primary question by surface

- `Dashboard`: What should I do next in the pipeline?
- `Inbox`: Which source materials still need triage?
- `Library`: Which cards need review right now?
- `Settings`: How is the pipeline configured and what will be exported?
- `Popup`: Should I sync now or open the workspace?

## Shared Layout Requirements

### Workspace Shell

- Left rail is persistent navigation, not content.
- Expanded rail should feel like a compact control column.
- Collapsed rail should preserve icon recognition and current-section clarity.
- The shell background should remain quiet so content surfaces carry hierarchy.

### Surface Structure

- Each page should start with a strong section header.
- Header copy should explain the job of the page, not restate the title.
- Primary actions belong in the header area.
- Main content should be composed from clear surface cards or workbench panes.

### Scroll Ownership

- On desktop, each long pane should own its own scrolling region.
- Avoid whole-page scroll when the intent is queue review.
- Long source text and long review content should not force the navigation or toolbar to scroll away.

## Visual Direction

The product should feel like an editorial operations tool:

- calm
- precise
- trustworthy
- slightly technical
- not playful

### Tone

- neutral base
- strong contrast on important actions
- restrained accent usage
- minimal ornament

### Typography

- use a clean sans-serif system with strong weight contrast
- page titles should feel assertive and operational
- metadata should stay compact and quiet
- long reading text should favor comfort over density

### Color Roles

- `Ink / dark`: primary actions, active navigation, trusted emphasis
- `Slate / gray`: structure, borders, metadata, inactive states
- `Ocean / blue`: informative emphasis, active filters, selected counts, recommended operational cues
- `Red`: stale states, failures, dangerous actions
- `Teal`: successful completion states
- `Sand / warm neutral`: subtle brand warmth, never the main working color

### Surface Styling

- main content surfaces should remain mostly white
- workspace background should be a soft neutral
- border and shadow treatment should separate work areas without looking card-heavy
- rounded corners should feel modern but restrained

## Navigation Requirements

- Top-level navigation labels must stay stable.
- The current section must always be visually obvious.
- `Library` lifecycle modes are primary navigation inside the page, not hidden filters.
- `Settings` section switching should stay page-internal and explicit.
- `Popup` should present one recommended CTA, not multiple equal-weight exits.

## Dashboard Requirements

Dashboard is the pipeline control surface, not a reporting dashboard.

It must:

- summarize source, draft, reviewed, and stale volume
- surface sync health clearly
- point the user toward one next queue
- make onboarding progress understandable without extra explanation

It should contain:

- a header with `Open source queue` and `Sync now`
- one pipeline snapshot surface
- one sync health surface
- compact metric cards for queue pressure
- a publish-activity heatmap that routes into Inbox with date focus

Dashboard should not:

- bury the next action under analytics
- over-index on charts
- present multiple equal-priority decisions at once

## Inbox Requirements

Inbox is the raw source triage desk.

It must communicate that the user is handling source material, not editing a final knowledge object.

### Inbox layout

- desktop: two-pane workbench with queue on the left and source detail on the right
- narrow screens: queue first, detail in a drawer or temporary panel
- toolbar remains attached to the queue pane

### Inbox controls

- search should target source material content
- sort and time filters should stay visible in the primary toolbar
- advanced filters should collapse when not needed
- bulk selection and bulk tagging should be available without dominating the page

### Inbox queue item rules

Queue rows or cards should show:

- author identity
- saved recency
- a short headline
- short body preview
- lightweight chips for source shape such as `Longform`, `media`, `likes`
- selected state

Queue items should not:

- read like full articles
- expose all metadata by default
- compete visually with the detail panel

### Inbox detail rules

The detail panel should expose:

- source kind
- author context
- saved timestamp
- full raw source text
- media when present
- tag state and tag actions
- actions to open the source on X or copy the link

Tagging should feel like triage, not taxonomy administration.

## Library Requirements

Library is the review workbench for generated cards.

The page exists to turn AI output into trustworthy long-term assets.

### Library layout

- desktop: two columns, with queue on the left and review pane on the right
- the left column is a selector, not a second reading surface
- the right column is the main place where trust decisions happen

### Library navigation rules

- lifecycle filters must remain prominent
- `Draft`, `Reviewed`, and `Stale` should behave like queues, not passive labels
- tag-based browsing is secondary to lifecycle review

### Library queue rules

Queue cards should show:

- title
- source and author context
- lifecycle or quality signals
- one short preview line

Queue cards should not:

- behave like mini full documents
- contain full-edit affordances
- require horizontal scanning to compare urgency

### Review pane rules

The review pane should separate:

- editable draft fields
- provenance and evidence
- quality warnings
- original source context

Every editable field must explain a distinct job so repeated AI text is easy to detect and fix.

If multiple fields repeat the same language, the interface should flag that overlap instead of silently accepting it.

### Lifecycle rules

- `Draft`: freshly generated and waiting for a human pass
- `Reviewed`: human-confirmed and safe to revisit or export
- `Stale`: previously reviewed, but source material changed and trust must be re-earned

Stale content should feel recoverable, but clearly less trustworthy than reviewed content.

## Settings Requirements

Settings is not a dumping ground. It is the operations page for configuring the pipeline and controlling what leaves the product.

It should use three internal sections:

- `Pipeline`
- `Knowledge setup`
- `System`

### Pipeline section

Must cover:

- sync health
- sync failure visibility
- AI generation toggle
- API key and model configuration
- fallback behavior explanation
- V1 source-model constraints

### Knowledge setup section

Must cover:

- tag creation and maintenance
- export scope preview
- vault structure explanation
- recent taxonomy visibility
- explicit explanation of the source-to-card-to-vault pipeline

### System section

Must cover:

- permissions and runtime dependencies
- export action
- reset / destructive actions
- operational guidance when sync or auth fails

Dangerous actions should be visually separated from normal setup actions.

## Popup Requirements

Popup is a lightweight decision surface.

It should:

- recommend the next best action
- summarize pipeline status in a compact format
- avoid making the user think through the whole information architecture

It should contain:

- a compact product intro
- one dominant recommendation card
- sync status summary
- compact pipeline snapshot

Popup should not:

- duplicate the full workspace
- show multiple equally strong calls to action
- overwhelm the user with settings or filters

## Onboarding Requirements

The onboarding flow is already implied by the product model and should remain explicit in copy:

1. sync source material
2. enable or confirm card generation
3. review at least one card
4. export the first vault

Each onboarding step should feel like progress toward a working system, not a tutorial checklist.

## Empty State Requirements

Every empty state must answer:

1. what is missing
2. why it is missing
3. what the user should do next

Examples:

- no source material yet -> run first sync
- no cards yet -> enable generation or sync again
- no stale cards -> reviewed cards are aligned with sources

## Status and Trust Requirements

### Sync status

The product must support and clearly display:

- `idle`
- `running`
- `success`
- `partial_success`
- `error`

Sync status should be visible in Dashboard, Settings, and Popup.

### Card trust state

Every generated card must expose:

- lifecycle state
- provenance
- quality score or quality signal
- warnings
- generator version or source of generation

The UI should never make a `draft` feel equivalent to a `reviewed` card.

## Responsive Requirements

- desktop is a workbench: multiple panes are appropriate
- narrow screens are task-focused: one primary pane should dominate at a time
- navigation may collapse, but section clarity must remain intact
- popup width should remain compact and decision-oriented
- detail content should move into drawers or stacked layouts before it becomes unreadable

## Copy Requirements

Copy should be:

- direct
- operational
- plain-language
- specific about what the user should do next

Copy should avoid:

- marketing language
- vague AI optimism
- generic productivity-tool wording
- social-media product metaphors

## Acceptance Criteria

The design system is working if the current product can satisfy all of the following:

1. A new user can understand the four-step pipeline from the UI alone.
2. Inbox clearly feels like source triage, not note editing.
3. Library clearly feels like review and trust-building, not generic document browsing.
4. Reviewed and stale states are impossible to confuse.
5. Popup gives one clear next action in under five seconds.
6. Settings makes export feel deliberate and reset feel dangerous.
7. Empty, loading, success, partial-success, and error states all tell the user what to do next.
8. The product never visually overstates the quality of AI-generated output.
