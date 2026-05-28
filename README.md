# OwlStack Publisher (browser extension)

Copies your OwlStack-scheduled content and lets you publish it yourself to platforms that have
no usable write API (Substack today). The extension never touches your Substack account: it only
reads your queued content from the OwlStack API and writes to your clipboard. You paste and click
publish.

## How it works

1. OwlStack composes and schedules a post targeting a manual platform (e.g. Substack). The API
   stages it as `awaiting_manual`.
2. This extension polls `GET /api/v1/extension/due` every 5 minutes (and on open). When something
   is due, it shows a badge count and a browser notification.
3. Open the popup, copy the title / body / image, paste into Substack, and publish.
4. Click "Mark published" (or "Skip"); the extension calls
   `POST /api/v1/extension/items/:id/status`.

Auth is an OwlStack API key with the `extension` scope, set in the options page. No host
permission for substack.com is requested, because nothing here interacts with their site.

## Develop

```bash
pnpm --filter @owlstack/extension dev      # Vite dev server + HMR
pnpm --filter @owlstack/extension build     # type-check + production build to dist/
pnpm --filter @owlstack/extension zip       # zip dist/ for the Chrome Web Store
```

Load `dist/` via `chrome://extensions` (Developer mode > Load unpacked) during development.

## Before publishing to the Chrome Web Store

- Add icon files referenced by the manifest/notifications: `icon-16.png`, `icon-48.png`,
  `icon-128.png` in `public/` (the OwlStack mark). Wire them into `src/manifest.config.ts`
  (`icons` + `action.default_icon`). Notifications also need `icon-128.png`.
- Confirm `host_permissions` matches the production API host.
- The extension reads a session-less API key and talks only to the OwlStack API, so it avoids
  the cookie-grabber pattern that triggers Chrome Web Store review friction. It can be listed
  publicly.
