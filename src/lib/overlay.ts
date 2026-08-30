/**
 * The panel renders as a fixed iframe inside the page rather than in the browser's
 * own side panel, because the side panel is browser chrome: it reserves space and
 * reflows the tab. An in-page overlay floats above the site instead, so the
 * page keeps its full width.
 *
 * Injection is on demand through `activeTab`, granted by the toolbar or
 * context-menu click, so the extension still holds no standing permission on
 * any site the user browses.
 */

import browser, { executeInTab } from './browser.js';

const OVERLAY_ID = 'fopost-overlay-root';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 640;

/**
 * Runs inside the page. The browser serialises it to a string, so it must stay
 * self-contained and take everything it needs as arguments.
 */
function mountOverlay(
  panelUrl: string,
  id: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
  toggle: boolean,
): void {
  const existing = document.getElementById(id);
  if (existing) {
    // A second toolbar click closes it; a capture leaves an open panel alone.
    if (toggle) existing.remove();
    return;
  }

  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'right:0',
    'height:100vh',
    `width:${defaultWidth}px`,
    'z-index:2147483647',
    'border:0',
    'margin:0',
    'padding:0',
  ].join(';');

  // A shadow root keeps the host page's CSS from reaching in, and ours from
  // leaking out.
  const shadow = host.attachShadow({ mode: 'open' });

  const frame = document.createElement('iframe');
  frame.src = panelUrl;
  frame.setAttribute('title', 'FoPost Publisher');
  frame.style.cssText = [
    'width:100%',
    'height:100%',
    'border:0',
    'display:block',
    'background:#fff',
    'box-shadow:0 0 24px rgba(15,23,42,0.18)',
  ].join(';');

  // Drag the left edge to resize, the one side-panel affordance worth keeping.
  const grip = document.createElement('div');
  grip.style.cssText = [
    'position:absolute',
    'top:0',
    'left:0',
    'width:6px',
    'height:100%',
    'cursor:ew-resize',
    'background:transparent',
  ].join(';');

  let dragging = false;
  grip.addEventListener('mousedown', (e) => {
    dragging = true;
    // The iframe would swallow the move events once the cursor crosses it.
    frame.style.pointerEvents = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const next = Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX));
    host.style.width = `${next}px`;
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    frame.style.pointerEvents = '';
  });

  shadow.appendChild(frame);
  shadow.appendChild(grip);
  document.documentElement.appendChild(host);

  // The panel asks to be dismissed by posting to its parent.
  const onMessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type !== 'fopost-close') return;
    document.getElementById(id)?.remove();
    window.removeEventListener('message', onMessage);
  };
  window.addEventListener('message', onMessage);
}

/**
 * Inject (or toggle) the overlay in one tab. `toggle` is true for a toolbar
 * click, so clicking again closes it, and false for a capture, which should
 * never close a panel the user is composing in.
 */
export async function openOverlay(tabId: number, toggle: boolean): Promise<boolean> {
  try {
    await executeInTab(tabId, mountOverlay, [
      browser.runtime.getURL('src/sidepanel/index.html'),
      OVERLAY_ID,
      DEFAULT_WIDTH,
      MIN_WIDTH,
      MAX_WIDTH,
      toggle,
    ]);
    return true;
  } catch {
    // Pages that block extensions entirely (browser settings, the Web Store)
    // and strict-CSP pages that refuse to frame an extension URL land here.
    return false;
  }
}
