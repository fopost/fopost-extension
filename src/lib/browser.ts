/**
 * The single extension-API surface for the whole codebase.
 *
 * Firefox exposes `chrome.*` only in its callback form, so awaiting a bare
 * `chrome.storage.local.get()` there resolves to `undefined` instead of the
 * value. The polyfill hands back the promise-based `browser.*` namespace on
 * both engines (on Firefox it is a passthrough), which is why nothing in `src/`
 * touches the `chrome` global directly.
 */
import browser from 'webextension-polyfill';

export default browser;

/**
 * Run a function inside one tab and get its return value back, typed.
 *
 * The injected function is serialised to a string, so it must stay
 * self-contained. The cast is unavoidable: the polyfill types `func` as
 * `(...args: unknown[]) => unknown`, which nothing with real parameter types is
 * assignable to.
 */
export async function executeInTab<A extends unknown[], R>(
  tabId: number,
  func: (...args: A) => R,
  args: A,
): Promise<R> {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    func: func as (...rest: unknown[]) => unknown,
    args,
  });
  if (!injection) throw new Error('Script injection returned no frame.');
  return injection.result as R;
}
