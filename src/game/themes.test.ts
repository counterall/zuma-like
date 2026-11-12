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

  it('gives Classic its own look', () => {
    const classic = THEMES.classic;
    for (const other of THEME_ORDER.filter((id) => id !== 'classic')) {
      expect(classic.balls).not.toEqual(THEMES[other].balls);
      expect(classic.track.fill).not.toBe(THEMES[other].track.fill);
    }
  });
});
