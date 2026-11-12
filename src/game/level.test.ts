import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, BALL_RADIUS } from './chain';
import { PAD_RADIUS } from './frog';
import { SHOOTER_RADIUS } from './game';
import { createLevel1, fitBoard, levelForScreen, pickLayout, sameBoard, type Level } from './level';

const TRACK_HALF = 30; // widest track edge (Reef, 60) / 2

/** Every board shape the game can produce: the fixed phone layouts, and the wide board across the aspect range. */
const BOARDS: [string, Level][] = [
  ['compact', createLevel1('compact')],
  ['tall', createLevel1('tall')],
  ...[4 / 3, 1.5, 16 / 10, 16 / 9, 2, 21 / 9].map((a): [string, Level] => [`wide ${a.toFixed(2)}:1`, createLevel1('wide', a)]),
];

describe.each(BOARDS)('%s board', (_, level) => {
  const { path } = level;
  const samples = Array.from({ length: Math.ceil(path.length / 8) }, (_, i) => path.pointAt(i * 8));

  it('keeps the whole track inside the board', () => {
    for (const p of samples) {
      expect(p.x - TRACK_HALF).toBeGreaterThanOrEqual(0);
      expect(p.y - TRACK_HALF).toBeGreaterThanOrEqual(0);
      expect(p.x + TRACK_HALF).toBeLessThanOrEqual(level.width);
      expect(p.y + TRACK_HALF).toBeLessThanOrEqual(level.height);
    }
  });

  it('keeps neighbouring coils far enough apart that balls never overlap', () => {
    let closest = Infinity;
    for (let i = 0; i < samples.length; i++) {
      // Only compare against points far away along the track (i.e. on another coil).
      for (let j = i + 60; j < samples.length; j++) {
        const d = Math.hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y);
        closest = Math.min(closest, d);
      }
    }
    expect(closest).toBeGreaterThan(BALL_DIAMETER + 20);
  });

  it('leaves room around the launcher', () => {
    for (const p of samples) {
      const d = Math.hypot(p.x - level.shooter.x, p.y - level.shooter.y);
      expect(d).toBeGreaterThan(SHOOTER_RADIUS + BALL_RADIUS);
    }
  });

  it("keeps the track clear of the frog's lily pad", () => {
    for (const p of samples) {
      const d = Math.hypot(p.x - level.shooter.x, p.y - level.shooter.y);
      expect(d - TRACK_HALF).toBeGreaterThan(PAD_RADIUS);
    }
  });

  it('sends a full-length chain for the track', () => {
    expect(level.config.totalBalls).toBeGreaterThanOrEqual(45);
    // Lined up, the whole chain covers most of the track: the density every layout is tuned around.
    const cover = (level.config.totalBalls * BALL_DIAMETER) / path.length;
    expect(cover).toBeGreaterThan(0.84);
    expect(cover).toBeLessThan(1);
  });
});

/** Desktop and landscape tablet screens (CSS pixels). */
const BIG_SCREENS: [number, number][] = [
  [1920, 1080],
  [2560, 1440],
  [1440, 900],
  [1366, 768],
  [1280, 800],
  [2560, 1080],
  [1024, 768], // iPad landscape
  [1180, 820], // iPad Air landscape
  [1366, 1024], // iPad Pro landscape
];

/** On-screen marble diameter before issue #1: a fixed 1400×900 board. */
const oldMarblePx = (w: number, h: number) => BALL_DIAMETER * Math.min(w / 1400, h / 900) * 0.995;

describe.each(BIG_SCREENS)('%i×%i screen', (w, h) => {
  const level = levelForScreen(w, h);
  const fit = fitBoard(level, w, h);

  it('uses the wide board', () => {
    expect(level.layout).toBe('wide');
  });

  it('draws marbles at least 1.5× their old size', () => {
    expect(BALL_DIAMETER * fit.scale).toBeGreaterThanOrEqual(1.5 * oldMarblePx(w, h) - 0.01);
  });

  it('spreads the track across the screen width', () => {
    const xs = level.path.points.map((p) => p.x);
    const span = (Math.max(...xs) - Math.min(...xs)) * fit.scale;
    // Up to 2:1 screens the track spans nearly edge to edge; ultrawide screens keep side margins.
    expect(span / w).toBeGreaterThan(w / h <= 2 ? 0.85 : 0.6);
  });
});

/** HUD boxes in CSS pixels (see #hud in style.css): score + meter top-left, two buttons top-right. */
const HUD_SCORE = { w: 210, h: 90 };
const HUD_BUTTONS = { w: 120, h: 64 };

describe.each(BIG_SCREENS)('%i×%i screen HUD', (w, h) => {
  it('never hides the track under the score or the buttons', () => {
    const level = levelForScreen(w, h);
    const { scale, ox, oy } = fitBoard(level, w, h);
    const r = TRACK_HALF * scale;
    for (let s = 0; s < level.path.length; s += 6) {
      const p = level.path.pointAt(s);
      const x = ox + p.x * scale;
      const y = oy + p.y * scale;
      const underScore = x - r < HUD_SCORE.w && y - r < HUD_SCORE.h;
      const underButtons = x + r > w - HUD_BUTTONS.w && y - r < HUD_BUTTONS.h;
      expect(underScore || underButtons, `track at (${x.toFixed(0)}, ${y.toFixed(0)})`).toBe(false);
    }
  });
});

describe('fitBoard', () => {
  it('centres the board and keeps it on screen', () => {
    const level = createLevel1('wide', 16 / 9);
    const fit = fitBoard(level, 1920, 1080);
    expect(fit.ox).toBeGreaterThanOrEqual(0);
    expect(fit.oy).toBeGreaterThanOrEqual(0);
    expect(fit.ox * 2 + level.width * fit.scale).toBeCloseTo(1920, 3);
    expect(level.height * fit.scale).toBeLessThanOrEqual(1080);
  });

  it('leaves room for the HUD above portrait boards', () => {
    expect(fitBoard(createLevel1('tall'), 390, 844).oy).toBeGreaterThan(30);
  });
});

describe('sameBoard', () => {
  it('keeps the board for small resizes and rebuilds it for a different screen shape', () => {
    const level = levelForScreen(1920, 1080);
    expect(sameBoard(level, 1920, 1080)).toBe(true);
    expect(sameBoard(level, 1910, 1075)).toBe(true);
    expect(sameBoard(level, 1024, 768)).toBe(false);
    expect(sameBoard(level, 844, 390)).toBe(false);
  });
});

describe('pickLayout', () => {
  it('uses the wide board for desktops and landscape tablets', () => {
    expect(pickLayout(1920, 1080)).toBe('wide');
    expect(pickLayout(1180, 820)).toBe('wide');
    expect(pickLayout(1024, 768)).toBe('wide');
  });
  it('uses the compact board for landscape phones', () => {
    expect(pickLayout(844, 390)).toBe('compact');
  });
  it('uses the tall board for portrait screens', () => {
    expect(pickLayout(390, 844)).toBe('tall');
    expect(pickLayout(820, 1180)).toBe('tall');
  });
});
