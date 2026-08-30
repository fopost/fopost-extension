/**
 * Which browser the current build targets, read once at config time.
 *
 * `EXT_TARGET=firefox` switches it; anything else (including unset) builds for
 * Chrome, which also covers every other Chromium browser — Edge, Brave, Opera,
 * Vivaldi, Arc — since they install the same package unchanged.
 *
 * Not named `BROWSER`: Vite already reads that variable to decide which browser
 * to open the dev server in.
 */
export type ExtTarget = 'chrome' | 'firefox';

export const EXT_TARGET: ExtTarget = process.env.EXT_TARGET === 'firefox' ? 'firefox' : 'chrome';
