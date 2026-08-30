# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What This Is

**FoPost Publisher** — the MV3 browser extension. One codebase, two store builds: Chrome (which
covers Edge, Brave, Opera, Vivaldi, Arc unchanged) and Firefox. React 19 + Tailwind 4, built by
Vite through `@crxjs/vite-plugin`, TypeScript, Node >= 22. `private: true` in `package.json`, so
nothing here is ever published to npm; the artifacts are two store zips.

Two jobs:

1. **Capture.** Right-click a page, selection, image, or link (or click the toolbar icon) and the
   extension injects a one-off extractor into that tab, reads title / canonical URL / `og:` tags /
   visible text / the clicked image, and opens a composer prefilled from it.
2. **Manual delivery.** For platforms with no usable write API (Substack today), it polls for
   content FoPost has staged as `awaiting_manual`, badges and notifies when something is due, and
   lets the user copy, publish by hand, and mark the item published or skipped.

**The server side is not here.** The queue endpoints (`GET /extension/queue`, `GET /extension/due`,
`POST /extension/items/:id/status`) live in the `fopost` monorepo as `apps/api/src/handlers/
extension.ts`, gated by `scopeMiddleware('extension')` — the `extension` API-key scope. A change to
what the queue returns, or a new extension endpoint, is a monorepo PR first; this repo only calls
it. Nothing about staging, scheduling, or delivery state is decided in this repo.

## Brand Rules

- The product is **FoPost** (`fopost.com`). Never write "OwlStack" — retired Aug 2026. The one
  permitted appearance is `LEGACY_ALARM = 'owlstack-poll'` in `src/background.ts`, which clears an
  alarm left on a user's machine by the old build. Never rewrite it.
- Never write an email address anywhere, including store-listing copy. Support is
  https://fopost.com/contact and GitHub issues; the privacy policy is
  https://fopost.com/privacy-policy.
- Never name AI providers/models, infrastructure vendors, or any person. The panel says "Write
  with AI", never which model wrote it.
- Store listing text, permission justifications, and the README are public surfaces and follow all
  of the above.

## Architecture

```
build-target.ts          EXT_TARGET = 'chrome' | 'firefox', read once at config time
vite.config.ts           crx() plugin, outDir dist/<target>, VITE_BROWSER define,
                         sidepanel/index.html pinned as an explicit rollup input
src/manifest.config.ts   the one manifest; the only file that knows which browser it is
src/background.ts        5-minute alarm poll + "Send to FoPost" context menus
src/lib/browser.ts       the single extension-API surface (webextension-polyfill) + executeInTab
src/lib/overlay.ts       mounts/unmounts the in-page iframe panel
src/lib/capture.ts       the injected extractor + pending-capture session storage
src/lib/api.ts           every API call, all through authFetch
src/lib/config.ts        API_BASE_URL and BROWSER_TARGET, both fixed at build time
src/lib/permissions.ts   Firefox-only optional host-permission grant
src/sidepanel/           App + Compose / Queue / Settings / Welcome views, one BottomNav
src/options/             standalone options page (same App, unframed)
```

**The panel is an in-page overlay, not the browser side panel.** The side panel is browser chrome:
it reserves space and reflows the tab. `overlay.ts` mounts a fixed, resizable iframe instead, so
the page keeps its width. Consequences that are by design, not bugs: it closes on navigation (a
content script does not survive a page load), and a site whose CSP forbids framing an extension URL
cannot host it, which surfaces as a notification.

**Permissions are the product's promise.** There is no host permission for any site the user
browses. Capture runs through `activeTab` + `scripting`, granted by the click, for that tab, then
expires. The only standing host permission is `https://api.fopost.com/*` (a dev build adds
`http://localhost:8080/*`). `web_accessible_resources` lists `<all_urls>`, which is not a
permission — it only lets a page frame the panel's own HTML. **Never widen this to buy
convenience**; CI fails a build whose production `host_permissions` is anything but the API, and
the store listing is written against exactly this shape.

**Requests.** `authFetch` reads the key from `browser.storage.local`, sends
`X-API-Key: <key>` to `${API_BASE_URL}/api/v1${path}`, and throws `ApiError(status, message, code)`
parsed out of `{ error, message }`. Media upload is multipart and deliberately sets no
`Content-Type` so the browser writes the boundary. Image bytes are fetched _inside the page that
already displayed them_, which is why media import needs no permission on the image's CDN.

**Anything injected into a page is serialised to a string** (`extractPage`, `mountOverlay`) and
must stay self-contained — no imports, no module-scope references, everything through arguments.

**What forks between browsers, and only this:** the background shape (Chrome MV3 service worker vs
Firefox MV3 event page), `browser_specific_settings.gecko` (a stable add-on ID, never regenerate
it), and host permissions (Chrome grants at install; Firefox treats them as optional, so
`permissions.ts` asks at the one user gesture available — saving the key). All three live in
`src/manifest.config.ts`. Nothing in `src/` touches the `chrome` global; everything goes through
`lib/browser.ts`.

**API scopes the key needs:** `posts` (create, publish, upload media), `accounts` (the picker),
`extension` (the manual-delivery queue), `ai` (**Write with AI** only, kept separate because it
spends credits).

## Commands

```bash
npm install
npm run dev              # Vite + HMR, Chrome target, API at http://localhost:8080
npm run dev:firefox
npm run lint             # tsc --noEmit
npm test                 # vitest run
npm run build            # tsc --noEmit + both targets into dist/chrome and dist/firefox
npm run build:chrome | build:firefox
npm run lint:firefox     # web-ext lint — the checks AMO runs at submission
npm run start:firefox    # launch Firefox with dist/firefox loaded
npm run zip              # one store zip per target
npm run format | format:check
```

Load `dist/chrome/` via `chrome://extensions` → Developer mode → Load unpacked. `VITE_API_BASE_URL`
points a build at any other API, which is how a staging build is made.

## Conventions

- ESM; relative imports carry the `.js` suffix on `.ts` source.
- Prettier: single quotes, semicolons, trailing commas, 100 cols, 2-space indent.
- Icons here are `lucide-react`, and Tailwind is configured through `@tailwindcss/vite`. This repo
  does **not** use the monorepo's `@fopost/icons` or `@fopost/design`; do not import them.
- `src/components/ui/` is the local primitive set (button, field, date-time-picker) plus
  `PlatformIcon` and `BottomNav`. Add to it rather than inlining a one-off control.
- Three screens on one bottom bar (Compose, Queue, Settings). Only the region between the header
  and that bar scrolls.
- The API key is the only user setting. The API address is fixed at build time on purpose — never
  add a server field to the UI.
- Comments short, for a non-obvious "why". The existing ones on `overlay.ts`, `browser.ts`, and
  `manifest.config.ts` explain constraints that are easy to undo by accident; keep them.
- **Two version numbers must match**: `package.json` and the literal in `src/manifest.config.ts`.
  CI fails when they diverge.

## Testing

`vitest run`, offline, one spec today: `src/lib/datetime.test.ts` (the composer's local-time
formatting and the month grid). Nothing hits the network or a real browser.

CI (`.github/workflows/ci.yml`) is where the expensive-and-silent failures are pinned, and each
check exists because the failure it catches produces **no build error**:

- both manifest versions match `package.json`
- Chrome built a `service_worker` and Firefox an event page, Firefox has a `gecko.id`, Chrome
  carries no gecko settings — the wrong shape installs cleanly and then does nothing
- every built HTML page loads a compiled bundle and no longer references `.tsx` — a config slip
  copies the panel HTML through untransformed and it renders blank
- production `host_permissions` is exactly `https://api.fopost.com/*`, and no `localhost:8080`
  string survives into the shipped bundle
- `web-ext lint` passes, since an AMO error is a rejection

Add a check here rather than a comment when a mistake would ship silently.

## Releasing

Releasing builds the store zips; **the store uploads stay manual.**

1. Bump `version` in `package.json` **and** in `src/manifest.config.ts`.
2. `git tag v<version> && git push --tags`. The tag must match `package.json`.
3. `.github/workflows/release.yml` verifies the tag and both manifest versions, runs lint, build,
   and `web-ext lint`, zips `dist/chrome` and `dist/firefox` as
   `fopost-extension-<target>-<version>.zip`, and attaches both to a GitHub release
   (`gh release create --generate-notes`, falling back to `upload --clobber`).

**No registry secret is needed** — the job runs on `github.token` with `contents: write`. There is
no store-publishing API call anywhere in this repo. Someone downloads the two zips and submits
them: the Chrome Web Store and AMO review their own listings on their own clocks, so one can be
live while the other is queued. Ship the same version number to both. AMO also wants source
(`npm ci && npm run build:firefox` reproduces the zip) and the `gecko.id` GUID left untouched.

## Git

Conventional Commits, atomic. Branch `feature/<description>`, merge to `main` via PR.
Never `gh pr create` — push the branch and hand over the compare link.
