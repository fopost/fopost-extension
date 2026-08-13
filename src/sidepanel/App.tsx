import { useCallback, useEffect, useState } from 'react';
import { ScanText, X } from 'lucide-react';
import ComposeView from './ComposeView.js';
import QueueView from './QueueView.js';
import SettingsView from './SettingsView.js';
import BottomNav, { type Screen } from '../components/BottomNav.js';
import { Button } from '../components/ui/button.js';
import {
  captureTab,
  clearPendingCapture,
  readPendingCapture,
  setPendingCapture,
} from '../lib/capture.js';
import type { PageCapture } from '../lib/types.js';

type Pending = { capture: PageCapture; tabId: number };

/** True in the in-page overlay, false on the standalone options page. */
const framed = window.parent !== window;

export default function App() {
  const [screen, setScreen] = useState<Screen>('queue');
  const [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  // A context-menu capture waiting in session storage is why the panel opened,
  // so it decides which screen lands first.
  useEffect(() => {
    void readPendingCapture().then((found) => {
      if (found) {
        setPending(found);
        setScreen('compose');
      }
      setReady(true);
    });
  }, []);

  // A capture can arrive while the overlay is already open, so it has to land
  // in a panel that mounted before the click.
  useEffect(() => {
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session' || !changes.pendingCapture?.newValue) return;
      void readPendingCapture().then((found) => {
        if (!found) return;
        setPending(found);
        setScreen('compose');
      });
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const discard = useCallback(() => {
    void clearPendingCapture();
    setPending(null);
    setScreen('queue');
  }, []);

  // Clicking the toolbar icon grants activeTab for the current tab, so the
  // panel can capture it directly without a context menu.
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
    <div className="flex h-full flex-col bg-white">
      {/* Framed in a page, so nothing above us draws a title bar or a way out.
          The standalone options page renders unframed and skips both. */}
      {framed && (
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <img src={chrome.runtime.getURL('icon-32.png')} alt="" className="size-4" />
          <span className="text-xs font-semibold tracking-tight">OwlStack Publisher</span>
          <Button
            variant="ghost"
            size="icon"
            title="Close"
            className="ml-auto -mr-1 size-7"
            onClick={() => window.parent.postMessage({ type: 'owlstack-close' }, '*')}
          >
            <X />
          </Button>
        </header>
      )}

      {/* The only scrolling region. The bottom nav stays put. */}
      <main className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {!ready && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}

        {ready && screen === 'compose' && pending && (
          <ComposeView capture={pending.capture} tabId={pending.tabId} onDiscard={discard} />
        )}

        {ready && screen === 'compose' && !pending && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-accent-soft">
              <ScanText className="size-5 text-accent" />
            </div>
            <p className="text-sm font-medium">Nothing captured yet</p>
            <p className="text-xs leading-relaxed text-slate-500">
              Right-click any page, image, link, or selection and choose{' '}
              <span className="font-medium text-slate-700">Send to OwlStack</span>.
            </p>
            <Button disabled={capturing} onClick={() => void captureCurrentTab()}>
              {capturing ? 'Reading page…' : 'Capture this page'}
            </Button>
            {captureError && <p className="text-xs text-red-600">{captureError}</p>}
          </div>
        )}

        {ready && screen === 'queue' && <QueueView onCountChange={setQueueCount} />}
        {ready && screen === 'settings' && <SettingsView />}
      </main>

      <BottomNav screen={screen} onChange={setScreen} queueCount={queueCount} />
    </div>
  );
}
