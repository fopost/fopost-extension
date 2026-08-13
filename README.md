# OwlStack Publisher (browser extension)

Two jobs in one MV3 extension:

1. **Capture.** Right-click any page, image, link, or selection and send it to a composer that is
   already filled in: caption seeded from the page, the image imported into your media library,
   per-platform character counts, and Post now / Schedule.
2. **Manual delivery.** For platforms with no usable write API (Substack today), it holds the
   content OwlStack scheduled and lets you copy and publish it yourself.

## How capture works

1. Right-click → **Send to OwlStack** (or open the popup and press **Capture this page**).
2. The extension injects a small extractor into that one tab and reads the title, canonical URL,
   `og:` metadata, the visible article text, and the image you clicked (falling back to
   `og:image`).
3. The composer opens with a caption drafted from what it found. **Write with AI** rewrites it
   from the page text, showing the credit cost and your remaining balance before you press it.
4. Pick accounts, then **Post now** or **Schedule**. Image bytes are uploaded to your OwlStack
   media library first, so the post keeps working after the source page changes.

Everything above happens against the OwlStack API with your API key. The extension never signs
into a social platform on your behalf.

## How manual delivery works

1. OwlStack schedules a post targeting a manual platform. The API stages it as `awaiting_manual`.
2. The extension polls `GET /api/v1/extension/due` every 5 minutes (and on open). When something
   is due it shows a badge count and a notification.
3. Open the popup's **Queue** tab, copy the title / body / image, paste into the platform, publish.
4. Press **Mark published** (or **Skip**); the extension calls
   `POST /api/v1/extension/items/:id/status`.

## Setup

Create an API key in OwlStack (**Settings → API keys**) and paste it into the extension options.

| Permission on the key | Needed for                                                                    |
| :-------------------- | :---------------------------------------------------------------------------- |
| `posts`               | Creating and publishing the captured post; uploading media                    |
| `accounts`            | Listing the accounts shown in the picker                                      |
| `extension`           | Reading and updating the manual-delivery queue                                |
| `ai`                  | **Write with AI** only. Leave it off and the button reports it is unavailable |

The `ai` permission is deliberately separate from `posts`, because it spends AI credits.

## Permissions justification

What the manifest asks for and why. This is the text to paste into the Chrome Web Store's
single-purpose and permission-justification fields.

| Permission                                     | Why                                                                                                                                                                          |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                                    | Reads the page you explicitly acted on — a right-click on our menu item, or a click on our toolbar icon. Access is granted by that gesture, for that tab, and expires.       |
| `scripting`                                    | Injects the one-off extractor that reads the title, canonical URL, `og:` tags, visible text, and the image you selected. Nothing is injected until you invoke the extension. |
| `contextMenus`                                 | Provides the "Send to OwlStack" entries on page, selection, image, and link contexts.                                                                                        |
| `storage`                                      | Stores your API key and API base URL on this device, plus the in-flight capture in session storage.                                                                          |
| `alarms`                                       | Runs the 5-minute poll for content that is due for manual publishing.                                                                                                        |
| `notifications`                                | Tells you when scheduled content is ready to publish by hand.                                                                                                                |
| `clipboardWrite`                               | Copies the queued title / body / image so you can paste it into the target platform.                                                                                         |
| `host_permissions: https://api.owlstack.app/*` | The OwlStack API — the only server this extension contacts. `http://localhost:8080/*` is present for local development.                                                      |

Deliberately **not** requested:

- **No host permission for any site you browse.** Page capture runs through `activeTab`, so the
  extension has no standing access to any website.
- **No broad `<all_urls>`, no `tabs` permission, no background scraping, no analytics or
  telemetry of any kind.** Nothing is read unless you invoke a capture, and nothing leaves your
  browser except the post you choose to create.
- Captured image bytes are fetched **inside the page that already displayed them**, which is why
  media import needs no permission on the image's CDN. If a cross-origin image blocks that read,
  the composer says so and lets you post text-only rather than silently hotlinking.

Privacy policy: <https://owlstack.app/privacy-policy>

## Develop

```bash
npm install
npm run dev       # Vite dev server + HMR
npm run build     # type-check + production build to dist/
npm run zip       # zip dist/ for the Chrome Web Store
```

Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.

Point the options page at `http://localhost:8080` to develop against a local API.

## Release

Bump `version` in `package.json` (`src/manifest.config.ts` reads its own copy, so bump both), tag
the commit `v<version>`, and push the tag. CI verifies the tag, the manifest version, and the host
permissions, then builds the store zip and attaches it to the GitHub release. Uploading to the
Chrome Web Store stays manual, because each submission needs listing review.

## Chrome Web Store submission

Ready in the repo:

- **Icons** — `public/icon-{16,32,48,128}.png`, wired into `icons` and `action.default_icon`.
- **Permissions justification** — the table above.
- **Privacy policy URL** — <https://owlstack.app/privacy-policy>.
- **Single purpose** — "Capture web content into your OwlStack account and publish or schedule it
  to your connected social accounts."

Still to produce by hand before submitting (they require a running browser):

- **Screenshots**, 1280×800 or 640×400, at least one, up to five. Shot list:
  1. Right-click menu open on an article image, showing "Send image to OwlStack".
  2. The composer with the image preview, prefilled caption, and character counts.
  3. The account picker with several platforms selected.
  4. The schedule field with a date chosen.
  5. The Queue tab with a Substack item due.
- **Store listing copy and a 440×280 promo tile.**

Verify before each submission: `host_permissions` still names only the production API, and the
manifest version matches `package.json`.
