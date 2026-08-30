import browser from './browser.js';
import { API_BASE_URL, BROWSER_TARGET } from './config.js';

/**
 * Firefox treats MV3 `host_permissions` as optional: they are listed at install
 * but the user grants them, and can revoke them later from about:addons. Until
 * the origin is granted every call to the FoPost API is blocked, which looks
 * from the panel exactly like a bad API key. So the Firefox build asks for it
 * explicitly at the one moment there is a user gesture to ask on — saving the
 * key. Chrome grants `host_permissions` at install, so both functions are a
 * no-op there.
 */
const API_ORIGIN = `${API_BASE_URL}/*`;

export async function hasApiPermission(): Promise<boolean> {
  if (BROWSER_TARGET !== 'firefox') return true;
  return browser.permissions.contains({ origins: [API_ORIGIN] });
}

/** Must be called from a user gesture, or Firefox rejects it outright. */
export async function requestApiPermission(): Promise<boolean> {
  if (BROWSER_TARGET !== 'firefox') return true;
  if (await hasApiPermission()) return true;
  return browser.permissions.request({ origins: [API_ORIGIN] });
}
