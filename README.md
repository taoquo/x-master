# X Bookmark Manager

[中文说明](./README.zh-CN.md)

X Bookmark Manager is a Chrome extension for people who save too much on X and still want to find the right post later. It turns X bookmarks into a local-first workspace you can sync, review, tag, and organize without relying on a hosted backend.

## Why Use It

- X bookmarks are easy to save and hard to revisit.
- Native X bookmark management does not give you a proper local inventory, tagging workflow, or rules-based organization.
- This extension gives you a dedicated workspace for collecting, classifying, and reviewing bookmarks you actually want to keep useful.

## What the Extension Does

- Sync bookmarks from X into local IndexedDB storage.
- Show sync status, inventory counts, and unclassified bookmark counts in the popup.
- Open a full manager view for browsing bookmarks, filtering by tags, and inspecting details.
- Organize bookmarks with lists and tags.
- Apply tags inline on X without leaving the timeline.
- Auto-attach tags through rules based on author handles, keywords, media, or longform posts.
- Keep data local-first inside the browser instead of sending bookmarks to a hosted service.

## Who It Is For

- Heavy X users who treat bookmarks as research material.
- People who want a local archive instead of a SaaS bookmark database.
- Users who need tags and lightweight triage, not just a save button.

## Install the Extension

Build it locally:

```bash
npm install
npm run build
```

Load it into Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select `build/chrome-mv3`.

## How to Use It

1. Sign in to X in Chrome.
2. Open the extension popup and click `Sync now`.
3. Wait for the first bookmark sync to finish.
4. Click `Open manager` to enter the full workspace.
5. Review bookmarks, filter them, and attach tags or move them into lists.
6. Create tags that match how you actually read or archive content.
7. Define classification rules so future bookmarks can be tagged automatically.
8. While browsing X, use the inline tag action to tag bookmarked posts directly on the site.

## Typical Workflow

1. Save posts on X as usual.
2. Run a sync from the popup.
3. Open the manager and inspect what is still unclassified.
4. Create a small tag system such as `AI`, `Product`, `Reading`, or `To Review`.
5. Add rules for recurring authors or keywords.
6. Revisit the workspace instead of scrolling through a flat bookmark list.

## Data and Storage

- Bookmark data is stored locally in the browser.
- Sync status and workspace settings are stored locally as well.
- The project is designed as a local-first extension and does not require a hosted backend.

## Repository Structure

```text
assets/   Static extension assets
scripts/  Build scripts
src/      Extension source code
tests/    Automated tests
```

## Development

Run the extension test suite:

```bash
npm test
```

Run static checks:

```bash
npm run typecheck
npm run lint
```

## Build Output

- Unpacked build: `build/chrome-mv3`
- Zip artifact: `build/chrome-mv3.zip`
