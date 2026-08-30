/**
 * Where the extension talks to. Fixed at build time, never a user setting:
 * production always points at the FoPost API, and a `npm run dev` build
 * points at a local one so the field does not have to exist in the UI.
 *
 * `VITE_API_BASE_URL` overrides both, which is how a staging build is made.
 */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:8080' : 'https://api.fopost.com')
).replace(/\/$/, '');

/**
 * Which engine this bundle was built for. Set by `EXT_TARGET` at build time and
 * read only where the two genuinely differ — today that is the Firefox
 * host-permission grant in `permissions.ts`. Everything else is shared code.
 */
export const BROWSER_TARGET: 'chrome' | 'firefox' =
  import.meta.env.VITE_BROWSER === 'firefox' ? 'firefox' : 'chrome';
