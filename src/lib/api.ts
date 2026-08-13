import { API_BASE_URL } from './config.js';
import { getSettings } from './storage.js';
import type {
  Account,
  CreditBalance,
  ExtensionItem,
  PlatformInfo,
  UploadedMedia,
} from './types.js';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Machine-readable `error` field when the API sent one. */
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Pull the friendliest message out of an API error body. */
function parseError(status: number, text: string): ApiError {
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return new ApiError(status, parsed.message || parsed.error || text, parsed.error);
  } catch {
    return new ApiError(status, text);
  }
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    throw new ApiError(
      0,
      'No API key set. Open the extension options to add your OwlStack API key.',
    );
  }
  return fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: { 'X-API-Key': apiKey, ...(init.headers ?? {}) },
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw parseError(res.status, await res.text().catch(() => res.statusText));
  }
  // Some endpoints (status update) return small JSON; tolerate empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

// ─── Manual-delivery queue (Substack) ─────────────────────────────

export async function fetchQueue(): Promise<ExtensionItem[]> {
  const data = await request<{ data: ExtensionItem[] }>('/extension/queue');
  return data.data ?? [];
}

export async function fetchDue(): Promise<ExtensionItem[]> {
  const data = await request<{ data: ExtensionItem[] }>('/extension/due');
  return data.data ?? [];
}

export async function markStatus(
  id: string,
  status: 'published' | 'skipped',
  externalUrl?: string,
): Promise<void> {
  await request(`/extension/items/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, external_url: externalUrl }),
  });
}

// ─── Composer ─────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const data = await request<{ data: Account[] }>('/accounts');
  return (data.data ?? []).filter((a) => a.active);
}

export async function fetchPlatforms(): Promise<PlatformInfo[]> {
  const data = await request<{ data: PlatformInfo[] }>('/platforms');
  return data.data ?? [];
}

/**
 * Upload captured image bytes into the workspace media library. The composer
 * always uploads rather than hotlinking, so the post keeps working after the
 * source page changes or removes the image.
 */
export async function uploadMedia(
  file: Blob,
  filename: string,
  workspaceId: string,
): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('files', file, filename);
  form.append('workspaceId', workspaceId);

  // No Content-Type header — the browser sets the multipart boundary.
  const res = await authFetch('/media/upload', { method: 'POST', body: form });
  if (!res.ok) {
    throw parseError(res.status, await res.text().catch(() => res.statusText));
  }
  const data = (await res.json()) as { data?: UploadedMedia[]; files?: UploadedMedia[] };
  const uploaded = data.data ?? data.files ?? [];
  if (uploaded.length === 0) throw new ApiError(500, 'Upload returned no file.');
  return uploaded[0];
}

export interface CreatePostBody {
  workspace_id: string;
  accounts: string[];
  content: { text: string; media?: UploadedMedia[] }[];
  status: 'draft' | 'scheduled';
  schedule_at?: string;
  title?: string;
}

export async function createPost(body: CreatePostBody): Promise<{ id: string }> {
  return request<{ id: string }>('/posts', { method: 'POST', body: JSON.stringify(body) });
}

export async function publishPost(id: string): Promise<void> {
  await request(`/posts/${id}/publish`, { method: 'POST', body: JSON.stringify({}) });
}

// ─── AI ───────────────────────────────────────────────────────────

export async function fetchCredits(): Promise<CreditBalance> {
  const data = await request<{ data: CreditBalance }>('/ai/credits');
  return data.data;
}

export async function generateCaption(input: {
  current_caption: string;
  platforms: string[];
  char_limit?: number;
  workspace_id: string;
  /** Free text from the user, e.g. a language or a tone to write in. */
  instructions?: string;
}): Promise<{ caption: string; charged: number; remaining: number }> {
  const data = await request<{
    data: { caption: string; credits: { charged: number; remaining: number } };
  }>('/ai/generate-caption', { method: 'POST', body: JSON.stringify(input) });
  if (!data.data?.caption) throw new ApiError(500, 'No caption returned.');
  return {
    caption: data.data.caption,
    charged: data.data.credits?.charged ?? 0,
    remaining: data.data.credits?.remaining ?? 0,
  };
}

export { ApiError };
