import { describe, expect, it } from 'vitest';
import { THEME_ORDER, THEMES } from './themes';

function parse(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = color.match(/[\d.]+/g);
  if (!m) throw new Error(`Unparseable colour ${color}`);
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

/** WCAG relative luminance. */
function luminance(color: string): number {
  const [r, g, b] = parse(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` painted at `alpha` over `bottom`, as an rgb() string. */
function blend(top: string, bottom: string, alpha: number): string {
  const a = parse(top);
  const b = parse(bottom);
  const c = a.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Hue in degrees (0-360). */
function hue(color: string): number {
  const [r, g, b] = parse(color).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe.each(THEME_ORDER)('%s theme', (id) => {
  const theme = THEMES[id];

  it('has five marble colours', () => {
    expect(theme.balls).toHaveLength(5);
  });

  // A see-through rail takes its colour from the ground below, so check it over every ground colour.
  // A marble passes if its own colour or its outline stands out (WCAG non-text contrast allows either boundary).
  const opacity = theme.track.opacity ?? 1;
  const bands = opacity < 1 ? (theme.ground ?? []).map((g) => blend(theme.track.fill, g, opacity)) : [theme.track.fill];

  it('says what ground a see-through rail sits on', () => {
    if (opacity < 1) expect(theme.ground?.length).toBeGreaterThan(0);
  });

  if (theme.ballOutline) {
    const rim = theme.ballOutline;
    // The rim draws each marble's edge, so it carries the 3:1 non-text contrast...
    it(`rims marbles in ${rim}, which stands out from the track (≥ 3:1, WCAG non-text contrast)`, () => {
      for (const band of bands) expect(contrast(rim, band), `over ${band}`).toBeGreaterThanOrEqual(3);
    });
    // ...but each marble's own colour must still be clearly distinct from the rail it rolls on.
    // Plain RGB distance: a marble coloured like the rail scores about 40-80 here, like the ground about 25-55.
    it.each(theme.balls)('marble %s is clearly distinct in colour from the track (RGB distance ≥ 100)', (ball) => {
      const distance = (a: string, b: string) => Math.hypot(...parse(a).map((v, i) => v - parse(b)[i]));
      for (const band of bands) expect(distance(ball, band), `over ${band}`).toBeGreaterThanOrEqual(100);
    });
  } else {
    it.each(theme.balls)('marble %s stands out from the track (≥ 3:1, WCAG non-text contrast)', (ball) => {
      for (const band of bands) expect(contrast(ball, band), `over ${band}`).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('theme list', () => {
  it('offers Cosmic, Reef and Classic, in that order', () => {
    expect(THEME_ORDER).toEqual(['cosmic', 'reef', 'classic']);
    for (const id of THEME_ORDER) expect(THEMES[id].id).toBe(id);
  });

  it('gives Classic its own path and a lawn-proof palette', () => {
    const classic = THEMES.classic;
    for (const other of THEME_ORDER.filter((id) => id !== 'classic')) {
      expect(classic.track.fill).not.toBe(THEMES[other].track.fill);
    }
    // No marble may share the lawn's hue (about 85-100°): shots fly over the grass between coils.
    expect(classic.ground).toBeDefined();
    for (const grass of classic.ground ?? []) expect(hue(grass)).toBeGreaterThan(80);
    for (const ball of classic.balls) {
      const h = hue(ball);
      expect(h < 65 || h > 150, `${ball} (hue ${h.toFixed(0)}°) looks like grass`).toBe(true);
    }
  });
});

describe.each(['classic', 'reef'] as const)('%s rail (issue #5)', (id) => {
  const track = THEMES[id].track;

  it('is see-through, so the ground shows through like the reference', () => {
    expect(track.opacity).toBeGreaterThanOrEqual(0.3);
    expect(track.opacity).toBeLessThanOrEqual(0.7);
  });

  it('has no brown or sandy colours', () => {
    for (const c of [track.edge, track.fill, ...(track.pebbles ?? [])]) {
      const h = hue(c);
      expect(h < 15 || h > 55, `${c} (hue ${h.toFixed(0)}°) is brown/sandy`).toBe(true);
    }
  });

  it('keeps brown out of the end-hole swirl too', () => {
    for (const c of THEMES[id].hole.arms) {
      const [r, g, b] = parse(c);
      const saturated = Math.max(r, g, b) - Math.min(r, g, b) > 40;
      const h = hue(c);
      expect(saturated && h >= 15 && h <= 55, `${c} (hue ${h.toFixed(0)}°) is brown/sandy`).toBe(false);
    }
  });

  it('has a quiet rim: no glow, and an edge darker than the band', () => {
    expect(track.glowBlur).toBe(0);
    expect(luminance(track.edge)).toBeLessThan(luminance(track.fill));
  });
});

/** A 2D context stand-in that records calls and rejects invalid geometry, like a real canvas would throw on. */
function stubContext(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return (...args: number[]) => {
        calls.push(prop);
        if (prop === 'ellipse' && (args[2] < 0 || args[3] < 0)) throw new RangeError(`negative ellipse radius in ${prop}`);
        if (prop === 'arc' && args[2] < 0) throw new RangeError('negative arc radius');
        if (args.some((a) => typeof a === 'number' && !Number.isFinite(a))) throw new RangeError(`non-finite argument to ${prop}`);
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe.each(THEME_ORDER)('%s backgrounds', (id) => {
  const theme = THEMES[id];
  it.each([[1920, 1080], [1024, 768], [390, 844], [2560, 1080]])('draw without errors at %i×%i', (w, h) => {
    const still = stubContext();
    theme.drawStatic(still.ctx, w, h);
    expect(still.calls.filter((c) => c === 'fill' || c === 'fillRect' || c === 'stroke').length).toBeGreaterThan(0);
    const moving = stubContext();
    for (const t of [0, 1.3, 47.9, 600]) theme.drawAnimated(moving.ctx, w, h, t);
    expect(moving.calls.length).toBeGreaterThan(0);
  });
});
