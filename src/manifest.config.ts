import { defineManifest } from '@crxjs/vite-plugin';
import { EXT_TARGET } from '../build-target.js';

/**
 * One manifest, two engines. Only three things differ, and they are all here so
 * no other file has to know which browser it was built for:
 *
 * - Background. Chrome MV3 wants an event-driven `service_worker`; Firefox MV3
 *   has no service worker for extensions and wants `scripts` (an event page).
 * - `browser_specific_settings`, which AMO requires for a stable add-on ID.
 * - Host permissions. Chrome grants them at install; Firefox treats them as
 *   optional and the user grants them, which is why the panel asks (see
 *   `lib/permissions.ts`).
 *
 * Note what is deliberately absent from both: a host permission for any site
 * the user browses. Page capture runs through `activeTab` + `scripting`, which
 * only grant access to the one tab the user just acted on, and only for that
 * click. The only standing host permissions are the FoPost API itself (plus
 * localhost for development).
 */
export default defineManifest((env) => ({
  manifest_version: 3,
  name: 'FoPost Publisher',
  version: '0.2.0',
  description:
    'Capture any page, image, or link and turn it into a scheduled social post. Also queues content for platforms you publish by hand.',
  icons: {
    '16': 'icon-16.png',
    '32': 'icon-32.png',
    '48': 'icon-48.png',
    '128': 'icon-128.png',
  },
  action: {
    // No default_popup: clicking the toolbar icon injects the overlay panel
    // into the current tab, wired in background.ts.
    default_title: 'FoPost Publisher',
    default_icon: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
  },
  options_page: 'src/options/index.html',
  background:
    EXT_TARGET === 'firefox'
      ? { scripts: ['src/background.ts'], type: 'module' }
      : { service_worker: 'src/background.ts', type: 'module' },
  // 126 is the floor for everything the extension uses: MV3 (109), ES modules
  // in a background script (106), storage.session (115), and the Chrome-shaped
  // `options_page` key (126). `web-ext lint` is what catches a wrong floor.
  ...(EXT_TARGET === 'firefox' && {
    browser_specific_settings: {
      gecko: { id: '{4f8b9c2a-1d7e-4a63-9f05-6c3ab2e14d80}', strict_min_version: '126.0' },
    },
  }),
  permissions: [
    'storage',
    'alarms',
    'notifications',
    'clipboardWrite',
    'contextMenus',
    // activeTab + scripting are what make "Send to FoPost" work without a
    // broad host permission: the extractor is injected only into the tab the
    // user right-clicked, only at that moment.
    'activeTab',
    'scripting',
  ],
  // The panel renders as an iframe inside the page, so the page has to be
  // allowed to frame it. This exposes nothing: the panel still reads and
  // writes only through the extension's own APIs, and listing a resource here
  // grants no access to any site.
  web_accessible_resources: [
    {
      resources: ['src/sidepanel/index.html', 'assets/*', 'images/platforms/*', 'icon-*.png'],
      matches: ['<all_urls>'],
    },
  ],
  // Only the FoPost API. A dev build also reaches a local one; the shipped
  // build must not ask for a permission it never uses.
  host_permissions:
    env.mode === 'production'
      ? ['https://api.fopost.com/*']
      : ['https://api.fopost.com/*', 'http://localhost:8080/*'],
}));
