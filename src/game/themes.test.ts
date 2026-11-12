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

describe.each(THEME_ORDER)('%s theme', (id) => {
  const theme = THEMES[id];

  it('has five marble colours', () => {
    expect(theme.balls).toHaveLength(5);
  });

  it.each(theme.balls)('marble %s stands out from the track (≥ 3:1, WCAG non-text contrast)', (ball) => {
    expect(contrast(ball, theme.track.fill)).toBeGreaterThanOrEqual(3);
  });
});

describe('theme list', () => {
  it('offers Cosmic, Reef and Classic, in that order', () => {
    expect(THEME_ORDER).toEqual(['cosmic', 'reef', 'classic']);
    for (const id of THEME_ORDER) expect(THEMES[id].id).toBe(id);
  });

  it('gives Classic an earthy path and a lawn-proof palette', () => {
    const classic = THEMES.classic;
    for (const other of THEME_ORDER.filter((id) => id !== 'classic')) {
      expect(classic.track.fill).not.toBe(THEMES[other].track.fill);
    }
    // No marble may share the lawn's hue (about 85-100°): shots fly over the grass between coils.
    const hue = (c: string): number => {
      const [r, g, b] = parse(c).map((v) => v / 255);
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const grass of ['#a6dc55', '#8fcf45', '#73bb37']) expect(hue(grass)).toBeGreaterThan(80);
    for (const ball of classic.balls) {
      const h = hue(ball);
      expect(h < 65 || h > 150, `${ball} (hue ${h.toFixed(0)}°) looks like grass`).toBe(true);
    }
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
