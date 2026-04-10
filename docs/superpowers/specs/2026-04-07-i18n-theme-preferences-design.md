# I18N And Theme Preferences Design

## Summary

Add lightweight internationalization and theme preferences to the extension.

- Support `zh-CN` and `en`
- Default locale is `zh-CN`
- Support `system`, `light`, and `dark` theme preferences
- Default theme preference is `system`
- Global preferences are configured only in the options page
- Popup reads the same settings and applies them immediately

The implementation should stay small, explicit, and local to the existing extension architecture. No external i18n or theming library will be introduced.

## Goals

- Make language and theme real user preferences stored in existing extension settings
- Keep popup and options page visually consistent by sharing one provider-level source of truth
- Allow the UI to react immediately when the user changes preferences in the options page
- Preserve the current art direction while making dark mode feel intentional instead of bolted on

## Non-Goals

- Full message extraction or runtime translation tooling
- Per-page or per-surface preference overrides
- More than two locales in this iteration
- Theme-specific layout changes or alternate component structure

## User-Facing Behavior

### Language

- The extension defaults to Simplified Chinese
- The options page exposes a language selector with Chinese and English
- Changing the language updates visible copy immediately
- Popup uses the stored language automatically the next time it renders

### Theme

- The extension defaults to `system`
- The options page exposes a theme selector with System, Light, and Dark
- Changing the theme updates the current page immediately
- When `system` is selected, the UI follows `prefers-color-scheme` and responds to system changes without refresh
- Popup resolves and applies the stored theme on load

## Visual Direction

### Visual Thesis

Keep the current soft glassmorphism direction, but make theme behavior feel like one visual system under different light conditions rather than two separate interfaces.

### Content Plan

- Hero/workspace sections remain the primary focus
- Add one compact `Preferences` section in the options page
- Keep controls simple: one language selector and one theme selector
- Do not add settings chrome to the popup

### Interaction Thesis

- Language changes swap copy immediately with no reload
- Theme changes update root theme state immediately
- `system` mode listens to media query changes and reapplies the resolved theme live

## Architecture

### Settings Model

Extend `ExtensionSettings` with:

- `locale: "zh-CN" | "en"`
- `themePreference: "system" | "light" | "dark"`

Defaults:

- `locale = "zh-CN"`
- `themePreference = "system"`

`createDefaultSettings()` remains the canonical source for defaults. Settings normalization continues to migrate older shapes by filling missing fields with defaults.

### UI Provider

`ExtensionUiProvider` becomes the shared shell for preferences-aware UI.

Responsibilities:

- load settings on mount
- expose the current `locale`
- expose the current `themePreference`
- expose the resolved theme: `light | dark`
- expose a small translation function for static UI strings
- apply root DOM attributes for theme styling

The provider will keep the API intentionally narrow. This iteration does not need a generalized state framework.

### Translation Strategy

Use an in-repo dictionary object keyed by locale and message id.

Constraints:

- only translate extension-authored static UI copy
- keep keys small and explicit
- do not attempt dynamic ICU formatting in this iteration

Recommended shape:

- one `messages` object in a focused UI file
- one `t(key)` helper supplied by the provider

For existing date formatting, prefer using the active locale when calling `Intl.DateTimeFormat`.

### Theme Strategy

Use root-level theme attributes and CSS variables.

Approach:

- provider resolves `system` to `light` or `dark`
- provider sets a stable attribute on the root element, for example `data-theme="dark"`
- CSS reads from theme variables instead of scattering per-component conditional classes

This keeps component markup mostly unchanged and makes theme styling easier to extend later.

## Component Changes

### Options Page

Add a `Preferences` section near the top of the page or in the existing control region, depending on current composition.

Requirements:

- language selector
- theme selector
- both controls persist immediately through existing settings storage
- labels and helper copy come from the translation dictionary

The section should remain compact and operational. No new hero or marketing framing is needed.

### Popup

Popup does not expose settings controls in this iteration.

Requirements:

- consume locale and theme from the provider
- translate visible static copy
- apply resolved theme styling on first render

## Styling

Introduce a small theme token layer in `extension.css`.

Expected token categories:

- app background
- text colors
- glass surfaces
- interactive controls
- status neutrals

The light theme should preserve the current warm atmospheric look. The dark theme should keep the same softness and depth but move to darker surfaces with readable contrast.

## Data Flow

1. UI mounts inside `ExtensionUiProvider`
2. Provider loads settings from storage
3. Provider normalizes locale and theme preference
4. Provider resolves the active theme
5. Provider applies root theme attribute and exposes `t()`
6. Options page updates settings on selector changes
7. Provider updates local state immediately after successful persistence

## Error Handling

- If settings load fails or storage is unavailable, fall back to default settings
- If an unknown locale or theme value is encountered, normalize back to defaults
- If system theme detection is unavailable, resolve `system` to `light`

The UI should remain usable even if preference persistence fails.

## Testing Strategy

Follow TDD during implementation.

### Storage Tests

Add coverage for:

- new default locale and theme preference
- migration from legacy settings without preference fields
- persistence of updated locale and theme preference

### Options Page Tests

Add coverage for:

- preferences section renders in default Chinese
- changing language updates visible labels
- changing theme persists the selected preference

### Popup Tests

Add coverage for:

- popup renders default Chinese copy
- popup reflects stored English locale
- popup applies resolved theme marker for stored preferences

## Implementation Boundaries

- Reuse existing settings storage instead of adding a new store
- Keep translations local to the extension app code
- Avoid new dependencies
- Prefer narrow helpers over broad abstractions

## Open Decisions Resolved

- Settings entry point: options page only
- Popup behavior: read-only consumer
- Defaults: Chinese and system theme
- Theming mechanism: provider + root attribute + CSS variables

## Rollout Plan

1. Extend settings types and normalization
2. Add failing storage tests
3. Implement provider for locale/theme state
4. Add failing options tests
5. Implement preferences UI and translated copy
6. Add failing popup tests
7. Translate popup copy and apply theme attributes
8. Refine CSS tokens for light and dark modes
9. Run full test, lint, and typecheck verification
