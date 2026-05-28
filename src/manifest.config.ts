import { defineManifest } from '@crxjs/vite-plugin';

/**
 * Minimal MV3 manifest. Note what is deliberately absent: no host permission
 * for substack.com / medium.com, because the extension never touches those
 * sites. It only talks to the OwlStack API and writes to the clipboard. That
 * keeps Chrome Web Store review simple (no cookie/automation red flags).
 */
export default defineManifest({
  manifest_version: 3,
  name: 'OwlStack Publisher',
  version: '0.1.0',
  description:
    'Copy your OwlStack-scheduled content and publish it to Substack and other platforms yourself. No passwords or accounts shared.',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'OwlStack Publisher',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['storage', 'alarms', 'notifications', 'clipboardWrite'],
  // Only the OwlStack API. localhost is for development against a local API.
  host_permissions: ['https://api.owlstack.app/*', 'http://localhost:8080/*'],
});
