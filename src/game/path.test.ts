import { describe, expect, it } from 'vitest';
import { buildRounded } from './path';

describe('buildRounded', () => {
  it('rounds a right-angle corner into a quarter circle', () => {
    const path = buildRounded([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 40);
    // Two straights shortened by the radius, plus a quarter of a circle.
    expect(path.length).toBeCloseTo(2 * 60 + (Math.PI / 2) * 40, 0);
    const mid = path.pointAt(path.length / 2);
    expect(Math.hypot(mid.x - 60, mid.y - 40)).toBeCloseTo(40, 0);
  });

  it('keeps direction smooth through corners (no kinks)', () => {
    const path = buildRounded([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], 50);
    let prev = path.pointAt(0).angle;
    for (let s = 2; s < path.length; s += 2) {
      const a = path.pointAt(s).angle;
      const d = Math.abs(Math.atan2(Math.sin(a - prev), Math.cos(a - prev)));
      expect(d).toBeLessThan(0.2);
      prev = a;
    }
  });

  it('shrinks a radius that would not fit between two corners', () => {
    // A U-turn 60 apart can only take a radius of 30.
    const path = buildRounded([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }], 80);
    const xs = path.points.map((p) => p.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100.001);
    expect(path.length).toBeCloseTo(2 * 70 + Math.PI * 30, 0);
  });
});
