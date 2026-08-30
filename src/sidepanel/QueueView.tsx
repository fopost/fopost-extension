import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Image as ImageIcon, Inbox, RefreshCw } from 'lucide-react';
import { ApiError, fetchQueue, markStatus } from '../lib/api.js';
import browser from '../lib/browser.js';
import PlatformIcon from '../components/PlatformIcon.js';
import { Button } from '../components/ui/button.js';
import { cn } from '../lib/utils.js';
import type { ExtensionItem, ExtensionMedia } from '../lib/types.js';

// Where to open each manual platform's composer. We only navigate the user
// there; we never automate the page.
const PUBLISH_URLS: Record<string, string> = {
  substack: 'https://substack.com/publish/post?type=newsletter',
};

function publishUrl(platform: string): string | null {
  return PUBLISH_URLS[platform] ?? null;
}

type Flash = { id: string; text: string } | null;

export default function QueueView({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [items, setItems] = useState<ExtensionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsKey(false);
    try {
      const next = await fetchQueue();
      setItems(next);
      onCountChange?.(next.length);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status === 401)) {
        setNeedsKey(true);
      } else if (err instanceof ApiError && err.status === 403) {
        setError("This API key is missing the 'extension' permission.");
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load queue.');
      }
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const flashFor = (id: string, text: string) => {
    setFlash({ id, text });
    window.setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 1500);
  };

  const copyText = async (id: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flashFor(id, `${label} copied`);
    } catch {
      flashFor(id, 'Copy failed');
    }
  };

  const copyImage = async (id: string, media: ExtensionMedia) => {
    try {
      const res = await fetch(media.url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      flashFor(id, 'Image copied');
    } catch {
      // Fall back to copying the image URL if binary clipboard write fails.
      try {
        await navigator.clipboard.writeText(media.url);
        flashFor(id, 'Image URL copied');
      } catch {
        flashFor(id, 'Copy failed');
      }
    }
  };

  const openSite = (platform: string) => {
    const url = publishUrl(platform);
    if (url) void browser.tabs.create({ url });
  };

  const updateStatus = async (item: ExtensionItem, status: 'published' | 'skipped') => {
    setBusyId(item.id);
    try {
      await markStatus(item.id, status);
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== item.id);
        onCountChange?.(next.length);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Content you publish by hand</span>
        <Button variant="ghost" size="icon" title="Refresh" onClick={() => void load()}>
          <RefreshCw className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading your queue…</p>}

      {needsKey && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-xs leading-relaxed text-slate-500">
            That API key was rejected. Check it in Settings, or issue a new one in FoPost.
          </p>
          <Button onClick={() => browser.runtime.openOptionsPage()}>Open settings</Button>
        </div>
      )}

      {!loading && !needsKey && error && <p className="text-xs text-red-600">{error}</p>}

      {!loading && !needsKey && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-slate-100">
            <Inbox className="size-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium">Queue is empty</p>
          <p className="text-xs text-slate-500">Scheduled content appears here when it is due.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'rounded-xl border bg-white p-3',
              item.due ? 'border-accent/40 ring-1 ring-accent/10' : 'border-slate-200',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <PlatformIcon platform={item.platform} className="size-4" />
              <span className="text-xs font-medium text-slate-800">{item.platform_name}</span>
              {item.due ? (
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                  Due now
                </span>
              ) : item.scheduled_at ? (
                <span className="ml-auto text-[11px] text-slate-400">
                  {new Date(item.scheduled_at).toLocaleString()}
                </span>
              ) : null}
            </div>

            {item.content.title && (
              <p className="mb-0.5 text-sm font-medium text-slate-900">{item.content.title}</p>
            )}
            <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
              {item.content.body || '(no body)'}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {item.content.title && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyText(item.id, item.content.title ?? '', 'Title')}
                >
                  <Copy />
                  Title
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copyText(item.id, item.content.body, 'Body')}
              >
                <Copy />
                Body
              </Button>
              {item.content.media.map((m, idx) => (
                <Button
                  key={idx}
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyImage(item.id, m)}
                >
                  <ImageIcon />
                  Image {item.content.media.length > 1 ? idx + 1 : ''}
                </Button>
              ))}
              {publishUrl(item.platform) && (
                <Button variant="secondary" size="sm" onClick={() => openSite(item.platform)}>
                  <ExternalLink />
                  Open
                </Button>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
              <Button
                size="sm"
                className="flex-1"
                disabled={busyId === item.id}
                onClick={() => void updateStatus(item, 'published')}
              >
                Mark published
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === item.id}
                onClick={() => void updateStatus(item, 'skipped')}
              >
                Skip
              </Button>
              {flash?.id === item.id && (
                <span className="text-[11px] font-medium text-emerald-600">{flash.text}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
