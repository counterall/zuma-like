import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings';

const store = new Map<string, string>();
const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterAll(() => {
  if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
});

describe('settings', () => {
  it('remembers the Classic theme', () => {
    saveSettings({ ...loadSettings(), theme: 'classic' });
    expect(loadSettings().theme).toBe('classic');
  });

  it('falls back to Cosmic for an unknown saved theme', () => {
    store.set('chroma-coil:settings', JSON.stringify({ theme: 'neon' }));
    expect(loadSettings().theme).toBe('cosmic');
  });
});
