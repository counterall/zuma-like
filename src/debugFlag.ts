/**
 * Switching the viewport diagnostics (debug.ts) on and off. A home-screen app opens its own start
 * URL and keeps its own storage, so besides ?debug=viewport there is a hidden gesture there: tap
 * the Settings title 5 times quickly. The choice is remembered on the device.
 */

const KEY = 'chroma-coil-debug';

/** true for ?debug=viewport, false for ?debug=off, otherwise undefined (no change). */
export function debugFromUrl(search: string): boolean | undefined {
  const value = new URLSearchParams(search).get('debug');
  if (value === 'viewport') return true;
  if (value === 'off') return false;
  return undefined;
}

/** Returns a function to call on each tap with its time; it is true on the nth tap within windowMs. */
export function tapCounter(n: number, windowMs: number): (now: number) => boolean {
  let taps: number[] = [];
  return (now) => {
    taps = [...taps.filter((t) => now - t < windowMs), now];
    if (taps.length < n) return false;
    taps = [];
    return true;
  };
}

export function loadDebug(): boolean {
  try {
    return localStorage.getItem(KEY) === 'viewport';
  } catch {
    return false;
  }
}

export function saveDebug(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'viewport');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode); the switch then lasts for this visit only.
  }
}
