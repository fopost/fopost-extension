import { useCallback, useEffect, useState } from 'react';
import ComposeView from './ComposeView.js';
import QueueView from './QueueView.js';
import {
  captureTab,
  clearPendingCapture,
  readPendingCapture,
  setPendingCapture,
} from '../lib/capture.js';
import type { PageCapture } from '../lib/types.js';

type Tab = 'compose' | 'queue';
type Pending = { capture: PageCapture; tabId: number };

export default function App() {
  const [tab, setTab] = useState<Tab>('queue');
  const [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // A context-menu capture waiting in session storage is why the popup opened,
  // so it decides which tab lands first.
  useEffect(() => {
    void readPendingCapture().then((found) => {
      if (found) {
        setPending(found);
        setTab('compose');
      }
      setReady(true);
    });
  }, []);

  const discard = useCallback(() => {
    void clearPendingCapture();
    setPending(null);
    setTab('queue');
  }, []);

  // Clicking the toolbar icon grants activeTab for the current tab, so the
  // popup can capture it directly without a context menu.
  const captureCurrentTab = useCallback(async () => {
    setCapturing(true);
    setCaptureError(null);
    try {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active?.id) throw new Error('No active tab.');
      const capture = await captureTab(active.id, 'page', null, null);
      await setPendingCapture(capture, active.id);
      setPending({ capture, tabId: active.id });
    } catch {
      setCaptureError('This page cannot be read by extensions. Try a normal web page.');
    } finally {
      setCapturing(false);
    }
  }, []);

  return (
    <div className="app">
      <header className="header">
        <span className="brand">OwlStack</span>
        <button
          className="icon-btn"
          title="Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          &#x2699;
        </button>
      </header>

      <nav className="tabs">
        <button
          className={tab === 'compose' ? 'tab active' : 'tab'}
          onClick={() => setTab('compose')}
        >
          Compose
        </button>
        <button className={tab === 'queue' ? 'tab active' : 'tab'} onClick={() => setTab('queue')}>
          Queue
        </button>
      </nav>

      {!ready && <p className="muted">Loading...</p>}

      {ready && tab === 'compose' && pending && (
        <ComposeView capture={pending.capture} tabId={pending.tabId} onDiscard={discard} />
      )}

      {ready && tab === 'compose' && !pending && (
        <div className="empty">
          <p>Right-click any page, image, link, or selection and choose Send to OwlStack.</p>
          <button className="primary" disabled={capturing} onClick={() => void captureCurrentTab()}>
            {capturing ? 'Reading page...' : 'Capture this page'}
          </button>
          {captureError && <p className="error">{captureError}</p>}
        </div>
      )}

      {ready && tab === 'queue' && <QueueView />}
    </div>
  );
}
