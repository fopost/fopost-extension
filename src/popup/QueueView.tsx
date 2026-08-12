import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchQueue, markStatus } from '../lib/api.js';
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

export default function QueueView() {
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
      setItems(await fetchQueue());
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) setNeedsKey(true);
      setError(err instanceof Error ? err.message : 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (url) void chrome.tabs.create({ url });
  };

  const updateStatus = async (item: ExtensionItem, status: 'published' | 'skipped') => {
    setBusyId(item.id);
    try {
      await markStatus(item.id, status);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="queue-head">
        <span className="muted small">Content you publish by hand</span>
        <button className="icon-btn" title="Refresh" onClick={() => void load()}>
          &#x21bb;
        </button>
      </div>

      {loading && <p className="muted">Loading your queue...</p>}

      {needsKey && (
        <div className="empty">
          <p>Connect the extension to OwlStack to see your queued content.</p>
          <button className="primary" onClick={() => chrome.runtime.openOptionsPage()}>
            Open settings
          </button>
        </div>
      )}

      {!loading && !needsKey && error && <p className="error">{error}</p>}

      {!loading && !needsKey && !error && items.length === 0 && (
        <p className="muted">Nothing to publish right now. Scheduled content will appear here.</p>
      )}

      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className={`card${item.due ? ' due' : ''}`}>
            <div className="card-head">
              <span className="platform">{item.platform_name}</span>
              {item.due ? (
                <span className="badge">Due now</span>
              ) : item.scheduled_at ? (
                <span className="muted small">{new Date(item.scheduled_at).toLocaleString()}</span>
              ) : null}
            </div>

            {item.content.title && <p className="title">{item.content.title}</p>}
            <p className="body">{item.content.body || '(no body)'}</p>

            <div className="actions">
              {item.content.title && (
                <button onClick={() => void copyText(item.id, item.content.title ?? '', 'Title')}>
                  Copy title
                </button>
              )}
              <button onClick={() => void copyText(item.id, item.content.body, 'Body')}>
                Copy body
              </button>
              {item.content.media.map((m, idx) => (
                <button key={idx} onClick={() => void copyImage(item.id, m)}>
                  Copy image {item.content.media.length > 1 ? idx + 1 : ''}
                </button>
              ))}
              {publishUrl(item.platform) && (
                <button onClick={() => openSite(item.platform)}>Open {item.platform_name}</button>
              )}
            </div>

            <div className="actions footer-actions">
              <button
                className="primary"
                disabled={busyId === item.id}
                onClick={() => void updateStatus(item, 'published')}
              >
                Mark published
              </button>
              <button
                className="ghost"
                disabled={busyId === item.id}
                onClick={() => void updateStatus(item, 'skipped')}
              >
                Skip
              </button>
              {flash?.id === item.id && <span className="flash">{flash.text}</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
