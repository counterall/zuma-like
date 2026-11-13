import { describe, expect, it } from 'vitest';
import { debugFromUrl, tapCounter } from './debugFlag';

describe('debug overlay switch (issue #11: reachable inside the home-screen app)', () => {
  it('reads ?debug=viewport to turn on and ?debug=off to turn off; other URLs leave it as it was', () => {
    expect(debugFromUrl('?debug=viewport')).toBe(true);
    expect(debugFromUrl('?x=1&debug=off')).toBe(false);
    expect(debugFromUrl('')).toBeUndefined();
    expect(debugFromUrl('?debug=other')).toBeUndefined();
  });

  it('fires on the 5th tap within 3 seconds, then starts counting again', () => {
    const tap = tapCounter(5, 3000);
    expect([0, 400, 800, 1200].map(tap)).toEqual([false, false, false, false]);
    expect(tap(1600)).toBe(true);
    expect(tap(1700)).toBe(false);
  });

  it('only counts taps less than the window apart from the first', () => {
    const tap = tapCounter(5, 3000);
    expect([0, 1000, 2000, 2500, 3000].map(tap)).toEqual([false, false, false, false, false]);
    expect(tap(3100)).toBe(true);
  });

  it('does not fire for slow taps', () => {
    const tap = tapCounter(5, 3000);
    expect([0, 1000, 2000, 3000, 4000, 5000, 6000].map(tap)).toEqual(Array(7).fill(false));
  });
});
