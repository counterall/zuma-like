import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ENDLESS_START } from './game/level';
import { isUnlocked, loadProgress, recordResult, saveProgress } from './progress';

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

describe('level progress', () => {
  it('starts with only level 1 open', () => {
    const p = loadProgress(0);
    expect([0, 1, 2, ENDLESS_START].map((i) => isUnlocked(p, i))).toEqual([true, false, false, false]);
  });

  it('opens the next level when one is cleared, and opens endless after the last level', () => {
    const p = loadProgress(0);
    recordResult(p, 0, true, 100);
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    recordResult(p, 1, true, 100);
    recordResult(p, 2, true, 100);
    expect(isUnlocked(p, ENDLESS_START)).toBe(true);
    // Any endless round counts as the endless entry.
    expect(isUnlocked(p, ENDLESS_START + 7)).toBe(true);
  });

  it('does not open anything on a loss', () => {
    const p = loadProgress(0);
    recordResult(p, 0, false, 500);
    expect(isUnlocked(p, 1)).toBe(false);
  });

  it('keeps a level open for good, even after replaying and losing earlier levels', () => {
    const p = loadProgress(0);
    recordResult(p, 0, true, 100);
    recordResult(p, 1, true, 100);
    saveProgress(p);
    const again = loadProgress(0);
    recordResult(again, 0, false, 10);
    recordResult(again, 0, true, 10);
    expect(isUnlocked(again, 2)).toBe(true);
    saveProgress(again);
    expect(isUnlocked(loadProgress(0), 2)).toBe(true);
  });

  it('keeps a best score per level and one for endless, and reports a new best', () => {
    const p = loadProgress(0);
    expect(recordResult(p, 0, false, 300)).toBe(true);
    expect(recordResult(p, 0, true, 200)).toBe(false);
    expect(recordResult(p, 1, false, 0)).toBe(false);
    expect(recordResult(p, ENDLESS_START + 2, true, 900)).toBe(true);
    expect(recordResult(p, ENDLESS_START, false, 400)).toBe(false);
    expect(p.best).toEqual({ '0': 300, '1': 0, endless: 900 });
  });

  it('remembers the furthest endless round cleared', () => {
    const p = loadProgress(0);
    recordResult(p, ENDLESS_START + 4, true, 1);
    recordResult(p, ENDLESS_START + 1, true, 1);
    recordResult(p, ENDLESS_START + 9, false, 1);
    expect(p.endlessRound).toBe(5);
  });

  it("carries the old single best score over as level 1's best", () => {
    expect(loadProgress(1234).best['0']).toBe(1234);
  });

  it('survives broken or tampered storage', () => {
    store.set('chroma-coil:progress', '{not json');
    expect(isUnlocked(loadProgress(0), 1)).toBe(false);
    store.set('chroma-coil:progress', JSON.stringify({ unlocked: 99, best: 'x', endlessRound: -3 }));
    const p = loadProgress(0);
    expect(isUnlocked(p, ENDLESS_START)).toBe(true);
    expect(p.best).toEqual({});
    expect(p.endlessRound).toBe(0);
  });
});
