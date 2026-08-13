import { defineManifest } from '@crxjs/vite-plugin';

/**
 * Minimal MV3 manifest. Note what is deliberately absent: no host permission
 * for any site the user browses. Page capture runs through `activeTab` +
 * `scripting`, which only grant access to the one tab the user just acted on,
 * and only for that click. The only standing host permissions are the
 * OwlStack API itself (plus localhost for development).
 */
export default defineManifest((env) => ({
  manifest_version: 3,
  name: 'OwlStack Publisher',
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
    default_title: 'OwlStack Publisher',
    default_icon: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: [
    'storage',
    'alarms',
    'notifications',
    'clipboardWrite',
    'contextMenus',
    // activeTab + scripting are what make "Send to OwlStack" work without a
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
  // Only the OwlStack API. A dev build also reaches a local one; the shipped
  // build must not ask for a permission it never uses.
  host_permissions:
    env.mode === 'production'
      ? ['https://api.owlstack.app/*']
      : ['https://api.owlstack.app/*', 'http://localhost:8080/*'],
}));
