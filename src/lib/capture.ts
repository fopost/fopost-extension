import type { PageCapture } from './types.js';

const PENDING_KEY = 'pendingCapture';

/**
 * Runs inside the page, injected on demand. Must stay self-contained — Chrome
 * serialises it to a string, so it cannot reference anything from this module.
 */
function extractPage(
  source: PageCapture['source'],
  clickedImageUrl: string | null,
  linkUrl: string | null,
): PageCapture {
  const meta = (selector: string): string => {
    const el = document.querySelector<HTMLMetaElement>(selector);
    return el?.content?.trim() ?? '';
  };

  const canonical =
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ||
    meta('meta[property="og:url"]') ||
    location.href;

  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    document.title ||
    canonical;

  const description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="description"]') ||
    meta('meta[name="twitter:description"]') ||
    '';

  const ogImage =
    meta('meta[property="og:image"]') ||
    meta('meta[property="og:image:secure_url"]') ||
    meta('meta[name="twitter:image"]') ||
    '';

  // Prefer the article body over the whole document so navigation and footers
  // don't drown out the actual content the caption should be written from.
  const container =
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.querySelector('[role="main"]') ??
    document.body;

  const pageText = (container?.innerText ?? '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  let imageUrl: string | null = clickedImageUrl || ogImage || null;
  // Resolve protocol-relative and root-relative URLs against the page.
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, location.href).href;
    } catch {
      imageUrl = null;
    }
  }

  return {
    source,
    title: title.slice(0, 300),
    url: linkUrl || canonical,
    description: description.slice(0, 600),
    selection: (window.getSelection()?.toString() ?? '').trim().slice(0, 2000),
    imageUrl,
    pageText: pageText.slice(0, 6000),
    siteName: meta('meta[property="og:site_name"]') || location.hostname,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Also runs inside the page. Fetching from the page's own context is what lets
 * media import work without asking for a host permission on every site: the
 * request is same-origin for the page that already displayed the image.
 */
async function fetchImageAsDataUrl(
  url: string,
  maxBytes: number,
): Promise<{ dataUrl: string; type: string; name: string } | { error: string }> {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return { error: `Image request failed (${res.status})` };
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return { error: 'That URL is not an image.' };
    if (blob.size > maxBytes) return { error: 'Image is larger than 10 MB.' };

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });

    const guessed = url.split('?')[0].split('/').pop() || 'image';
    const name = /\.[a-z0-9]{3,4}$/i.test(guessed)
      ? guessed
      : `${guessed}.${blob.type.split('/')[1] ?? 'jpg'}`;

    return { dataUrl, type: blob.type, name };
  } catch {
    // Cross-origin images without permissive CORS land here. The composer
    // degrades to a text-only post rather than hotlinking.
    return { error: 'This image could not be read from the page.' };
  }
}

export const MAX_CAPTURE_IMAGE_BYTES = 10 * 1024 * 1024;

export async function captureTab(
  tabId: number,
  source: PageCapture['source'],
  clickedImageUrl: string | null,
  linkUrl: string | null,
): Promise<PageCapture> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPage,
    args: [source, clickedImageUrl, linkUrl],
  });
  return result.result as PageCapture;
}

export async function fetchImageFromTab(
  tabId: number,
  url: string,
): Promise<{ dataUrl: string; type: string; name: string } | { error: string }> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: fetchImageAsDataUrl,
    args: [url, MAX_CAPTURE_IMAGE_BYTES],
  });
  return result.result as { dataUrl: string; type: string; name: string } | { error: string };
}

// ─── Pending capture handoff (background → popup) ─────────────────
//
// Session storage, not local: a capture is in-flight UI state and should not
// survive a browser restart.

export async function setPendingCapture(capture: PageCapture, tabId: number): Promise<void> {
  await chrome.storage.session.set({ [PENDING_KEY]: { capture, tabId } });
}

/** Non-destructive: the capture survives an accidentally dismissed popup. */
export async function readPendingCapture(): Promise<{
  capture: PageCapture;
  tabId: number;
} | null> {
  const stored = await chrome.storage.session.get(PENDING_KEY);
  return (stored[PENDING_KEY] as { capture: PageCapture; tabId: number } | undefined) ?? null;
}

export async function clearPendingCapture(): Promise<void> {
  await chrome.storage.session.remove(PENDING_KEY);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** The caption the composer starts from, before any AI involvement. */
export function seedCaption(capture: PageCapture): string {
  const parts: string[] = [];
  if (capture.source === 'selection' && capture.selection) {
    parts.push(capture.selection);
  } else if (capture.description) {
    parts.push(capture.description);
  } else if (capture.title) {
    parts.push(capture.title);
  }
  if (capture.url && capture.source !== 'image') parts.push(capture.url);
  return parts.join('\n\n');
}
