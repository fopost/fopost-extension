/**
 * Where the extension talks to. Fixed at build time, never a user setting:
 * production always points at the OwlStack API, and a `npm run dev` build
 * points at a local one so the field does not have to exist in the UI.
 *
 * `VITE_API_BASE_URL` overrides both, which is how a staging build is made.
 */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:8080' : 'https://api.owlstack.app')
).replace(/\/$/, '');
