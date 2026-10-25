# Chronicle — a finite, honest history feed

Static site (vanilla ES modules, no backend). Files: `index.html` (UI/state), `data.js` (articles), `countries.js` (195-state registry, ISO codes, UN regions), `sw.js` (offline cache, versioned at build), `favicon.svg`, `manifest.webmanifest`.

## Commands

`npm ci` · `npm test` (registry + content + pipeline validation) · `npm run build` (→ `dist/`, relative paths only) · `npm run check:links` (needs open internet) · `npx playwright install chromium && npm run test:e2e` (real browser + axe WCAG 2.1 AA) · `npm run pipeline -- summary <Wikipedia_Title>` (prints a REST summary to help author an entry; rewrite in your own words).
If Playwright's CDN is blocked, set `CHROMIUM_PATH` to any Chromium binary.

## Behaviour

Viewed = ≥60% visible for 2 s with tab visible; stored in localStorage and never shown again until "Reset reading history". Saved articles stay readable. Reading position per feed is restored. Routes: `#country=IN`, `#feed=saved`. Storage blocked/full/corrupt → in-memory fallback with a notice.

## Adding content

Append a row to `R` in `data.js` (schema at top). Sources must be real, cited, https. Add an uncertainty note for approximate/disputed claims. Never invent facts. Run `npm test`. Text is paraphrased; Wikipedia sources are CC BY-SA 4.0 (attribution via the source link).
