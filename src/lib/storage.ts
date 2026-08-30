import browser from './browser.js';
import type { Settings } from './types.js';

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get('apiKey');
  return { apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '' };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ apiKey: settings.apiKey.trim() });
}
