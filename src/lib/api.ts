import { getSettings } from './storage.js';
import type { ExtensionItem } from './types.js';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = await getSettings();
  if (!apiKey) {
    throw new ApiError(0, 'No API key set. Open the extension options to add your OwlStack API key.');
  }
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  // Some endpoints (status update) return small JSON; tolerate empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function fetchQueue(): Promise<ExtensionItem[]> {
  const data = await request<{ data: ExtensionItem[] }>('/extension/queue');
  return data.data ?? [];
}

export async function fetchDue(): Promise<ExtensionItem[]> {
  const data = await request<{ data: ExtensionItem[] }>('/extension/due');
  return data.data ?? [];
}

export async function markStatus(
  id: number,
  status: 'published' | 'skipped',
  externalUrl?: string,
): Promise<void> {
  await request(`/extension/items/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, external_url: externalUrl }),
  });
}

export { ApiError };
