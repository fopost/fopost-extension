import type { Settings } from './types.js';

export const DEFAULT_BASE_URL = 'https://api.owlstack.app';

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(['apiKey', 'baseUrl']);
  return {
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
    baseUrl: typeof stored.baseUrl === 'string' && stored.baseUrl ? stored.baseUrl : DEFAULT_BASE_URL,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim().replace(/\/$/, '') || DEFAULT_BASE_URL,
  });
}
