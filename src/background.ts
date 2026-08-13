import { fetchDue } from './lib/api.js';
import { getSettings } from './lib/storage.js';
import { captureTab, setPendingCapture } from './lib/capture.js';
import { openOverlay } from './lib/overlay.js';
import type { PageCapture } from './lib/types.js';

// Two jobs live here:
//
// 1. Polling the OwlStack API for manual-delivery content whose scheduled time
//    has passed, surfaced as a badge count plus a notification. The browser
//    must be running for this to fire; if it was closed at the scheduled time,
//    the item shows up on the next poll (catch-up reminder).
// 2. "Send to OwlStack" context menus. A click injects the extractor into that
//    one tab (activeTab), stashes the result, and opens the composer.

const ALARM = 'owlstack-poll';
const POLL_MINUTES = 5;
const ACCENT = '#4F46E5';

const MENUS: { id: string; title: string; contexts: chrome.contextMenus.ContextType[] }[] = [
  { id: 'owlstack-page', title: 'Send this page to OwlStack', contexts: ['page'] },
  { id: 'owlstack-selection', title: 'Send selection to OwlStack', contexts: ['selection'] },
  { id: 'owlstack-image', title: 'Send image to OwlStack', contexts: ['image'] },
  { id: 'owlstack-link', title: 'Send link to OwlStack', contexts: ['link'] },
];

const MENU_SOURCES: Record<string, PageCapture['source']> = {
  'owlstack-page': 'page',
  'owlstack-selection': 'selection',
  'owlstack-image': 'image',
  'owlstack-link': 'link',
};

let lastDueCount = 0;

function registerMenus(): void {
  chrome.contextMenus.removeAll(() => {
    for (const menu of MENUS) {
      chrome.contextMenus.create({ id: menu.id, title: menu.title, contexts: menu.contexts });
    }
  });
}

// Clicking the toolbar icon toggles the in-page overlay. The click is what
// grants activeTab, which is all the injection needs.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  void openOverlay(tab.id, true).then((ok) => {
    if (!ok) {
      notify(
        'OwlStack cannot open here',
        'Some pages (browser settings, the Web Store) block extensions entirely.',
      );
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  registerMenus();
  chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES });
  void poll();
});

chrome.runtime.onStartup.addListener(() => {
  registerMenus();
  void poll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void poll();
});

// Re-poll as soon as settings (API key / base URL) change.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void poll();
});

// ─── Context menu capture ─────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const source = MENU_SOURCES[String(info.menuItemId)];
  if (!source || !tab?.id) return;

  // Mount the panel first so it is already up while the page is being read.
  // `false` leaves an open panel alone rather than toggling it shut.
  const opened = openOverlay(tab.id, false);

  void handleCapture(source, info, tab.id, opened);
});

async function handleCapture(
  source: PageCapture['source'],
  info: chrome.contextMenus.OnClickData,
  tabId: number,
  opened: Promise<boolean>,
): Promise<void> {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const capture = await captureTab(
      tabId,
      source,
      source === 'image' ? (info.srcUrl ?? null) : null,
      source === 'link' ? (info.linkUrl ?? null) : null,
    );

    // The context menu carries the selection even when the page's own
    // selection API has since collapsed, so prefer it when present.
    if (info.selectionText) capture.selection = info.selectionText;

    // The panel watches session storage, so it picks this up whether it opened
    // just now or was already sitting open from an earlier capture.
    await setPendingCapture(capture, tabId);

    if (!(await opened)) {
      notify('Captured. Click the OwlStack icon to compose.', capture.title);
    }
  } catch {
    notify(
      'OwlStack could not read this page',
      'Some pages (browser settings, the Web Store) block extensions entirely.',
    );
  }
}

function notify(title: string, message: string): void {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon-128.png', title, message });
}

// ─── Manual-delivery queue polling ────────────────────────────────

function setBadge(count: number): void {
  void chrome.action.setBadgeBackgroundColor({ color: ACCENT });
  void chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
}

async function poll(): Promise<void> {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    setBadge(0);
    lastDueCount = 0;
    return;
  }
  try {
    const due = await fetchDue();
    setBadge(due.length);
    if (due.length > lastDueCount && due.length > 0) {
      notify(
        'OwlStack: content ready to publish',
        due.length === 1
          ? `1 post is ready to publish on ${due[0].platform_name}. Open the extension to copy it.`
          : `${due.length} posts are ready to publish. Open the extension to copy them.`,
      );
    }
    lastDueCount = due.length;
  } catch {
    // Network / auth errors are non-fatal for background polling.
  }
}
