# Findings & Decisions

## Requirements
- Evaluate whether Twillot is actually open source and free.
- If Twillot remains paid/commercial, design a Twitter/X bookmark manager.
- Product shape selected by user: browser extension + web backend.
- MVP scope selected by user: save + search + tags.
- User wants bookmark retrieval to reference the x2o script approach.
- User is reconsidering whether a Twillot-like lighter architecture could replace the planned full web-backend-heavy design.

## Research Findings
- Twillot GitHub repository is public and appears archived.
- No clear open-source license was visible from the repository page fetch, so it should not be treated as clearly open-source.
- Twillot product marketing indicates free-to-start plus paid tiers (Basic/Pro language present).
- Twillot therefore appears to be a commercial SaaS/product with a public code repository, not a clearly free/open self-hosted solution.
- The x2o script retrieves bookmarks through X's internal GraphQL bookmark timeline endpoint, not through public documented APIs.
- The x2o approach authenticates using a logged-in browser cookie, extracts ct0 as CSRF token, and sends a hardcoded bearer token.
- The x2o approach paginates using timeline cursor-bottom entries and extracts tweet fields such as id, text, author, createdAt, url, media, and engagement metrics.
- This approach is viable for an MVP but fragile because it depends on internal endpoints, hardcoded query identifiers/feature flags, browser session cookies, and unstable response shapes.
- Twillot appears to be a hybrid product, not purely a web app and not purely a Chrome extension.
- Evidence for extension/client-heavy behavior: Chrome Web Store distribution, extension usage language, local indexing/search, and device-side storage/backup wording.
- Evidence for hosted service behavior: pricing/basic plan language, waitlist/onboarding flows, private viewer link/email flow, sync/backup wording, and twillot.com companion/docs presence.
- Relative to a backend-centric architecture, Twillot's model is lighter only if search/indexing and most data handling stay local in the extension/client.
- Twillot is not evidence that a backend can be removed entirely; it instead suggests a lighter hybrid where backend scope is minimized to sync/auth/backup/link-sharing.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Recommend extension + web backend architecture | Fits user's selected product shape and supports management UX |
| Keep MVP narrow around save/search/tags | Fastest path to value without AI or advanced automation |
| Use the x2o-style authenticated request flow as the primary bookmark ingestion reference for MVP design | User explicitly requested this reference, and it can access real bookmark data without waiting on official API access |
| Treat X ingestion as an adapter boundary, not core business logic | Internal X endpoint behavior is fragile and likely to change |
| Re-evaluate backend scope after analyzing Twillot product shape | Twillot may imply a lighter hybrid architecture than the original plan |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| GitHub blob page fetch for x2o script hit rate limit (429) | Switched to raw GitHub file fetch |

## Resources
- Twillot repo: https://github.com/twillot-app/twillot
- Twillot site: https://twillot.com
- Twillot English site: https://www.twillot.com/en
- x2o reference script: https://github.com/kiki123124/x2o/blob/main/scripts/x2o.ts
- x2o raw script: https://raw.githubusercontent.com/kiki123124/x2o/main/scripts/x2o.ts

## Visual/Browser Findings
- Twillot website copy suggests SaaS onboarding, free start, waitlist, and plan tiers.
- Twillot repo page content mentions extension-oriented functionality and also paid upsell/pro features.
- x2o fetches bookmarks via internal GraphQL requests using cookie + ct0 + bearer token rather than DOM scraping.
- Twillot appears hybrid: extension/client-heavy product with companion hosted service rather than a pure standalone web app.

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
