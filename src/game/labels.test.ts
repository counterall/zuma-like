import { describe, expect, it } from 'vitest';
import { fitLabel, visibleArea, type Area } from './labels';
import { fitBoard, levelForScreen } from './level';

const area: Area = { left: 0, top: 50, right: 400, bottom: 800 };
const inside = (l: { x: number; y: number; scale: number }, w: number, h: number, a: Area) => {
  expect(l.x - (w * l.scale) / 2).toBeGreaterThanOrEqual(a.left - 1e-9);
  expect(l.x + (w * l.scale) / 2).toBeLessThanOrEqual(a.right + 1e-9);
  expect(l.y - (h * l.scale) / 2).toBeGreaterThanOrEqual(a.top - 1e-9);
  expect(l.y + (h * l.scale) / 2).toBeLessThanOrEqual(a.bottom + 1e-9);
};

describe('fitLabel (issue #7: combo text stays fully on screen)', () => {
  it('leaves a label that already fits where it is, at full size', () => {
    expect(fitLabel(200, 400, 120, 40, area)).toEqual({ x: 200, y: 400, scale: 1 });
  });

  it.each([
    ['left edge', 10, 400],
    ['right edge', 395, 400],
    ['top (under the HUD)', 200, 40],
    ['bottom edge', 200, 799],
    ['a corner', 398, 2],
  ])('pulls a label at the %s back inside', (_, x, y) => {
    const l = fitLabel(x, y, 180, 50, area);
    expect(l.scale).toBe(1);
    inside(l, 180, 50, area);
  });

  it('never returns a negative size, even when the HUD leaves no room', () => {
    expect(fitLabel(200, 400, 100, 40, { left: 0, top: 500, right: 400, bottom: 480 }).scale).toBe(0);
  });

  it('shrinks a label wider than the screen so it fits whole', () => {
    const l = fitLabel(200, 400, 600, 50, area);
    expect(l.scale).toBeCloseTo(400 / 600);
    inside(l, 600, 50, area);
  });
});

describe('visibleArea', () => {
  // Phones in both orientations, where the board meets the screen edges.
  it.each([[390, 844], [844, 390], [360, 640], [1280, 720]])('keeps edge combos on a %i×%i screen', (vw, vh) => {
    const level = levelForScreen(vw, vh);
    const fit = fitBoard(level, vw, vh);
    const hud = 56;
    const a = visibleArea(fit, vw, vh, { margin: 6, top: hud });
    // Back to screen pixels: the area must sit inside the screen, below the HUD.
    expect(a.left * fit.scale + fit.ox).toBeCloseTo(6);
    expect(a.right * fit.scale + fit.ox).toBeCloseTo(vw - 6);
    expect(a.top * fit.scale + fit.oy).toBeCloseTo(hud);
    expect(a.bottom * fit.scale + fit.oy).toBeCloseTo(vh - 6);
    // A big combo popped at each corner of the board lands entirely inside.
    const w = 230;
    const h = 60;
    for (const [x, y] of [[0, 0], [level.width, 0], [0, level.height], [level.width, level.height]]) {
      inside(fitLabel(x, y - 52, w, h, a), w, h, a);
    }
  });
});
