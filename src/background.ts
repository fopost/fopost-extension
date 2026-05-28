import { fetchDue } from './lib/api.js';
import { getSettings } from './lib/storage.js';

// Polls the OwlStack API for content whose scheduled time has passed and
// surfaces it as a badge count plus a browser notification. The browser must
// be running for this to fire; if it was closed at the scheduled time, the
// item simply shows up on the next poll (catch-up reminder).

const ALARM = 'owlstack-poll';
const POLL_MINUTES = 5;
const ACCENT = '#4F46E5';

let lastDueCount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES });
  void poll();
});

chrome.runtime.onStartup.addListener(() => {
  void poll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void poll();
});

// Re-poll as soon as settings (API key / base URL) change.
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void poll();
});

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
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'OwlStack: content ready to publish',
        message:
          due.length === 1
            ? `1 post is ready to publish on ${due[0].platform_name}. Open the extension to copy it.`
            : `${due.length} posts are ready to publish. Open the extension to copy them.`,
      });
    }
    lastDueCount = due.length;
  } catch {
    // Network / auth errors are non-fatal for background polling.
  }
}
