import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, BALL_RADIUS } from './chain';
import { PAD_RADIUS } from './frog';
import { SHOOTER_RADIUS } from './game';
import { createLevel, ENDLESS_START, fitBoard, LEVELS, levelForScreen, pickLayout, sameBoard, type Level } from './level';

const TRACK_HALF = 30; // widest track edge (Reef, 60) / 2

/** Every board the game can produce: each level on the fixed phone layouts and across the wide board's aspect range. */
const ASPECTS = [4 / 3, 1.5, 16 / 10, 16 / 9, 2, 21 / 9];
const BOARDS: [string, Level][] = LEVELS.flatMap((spec, i): [string, Level][] => [
  [`${spec.track} compact`, createLevel(i, 'compact')],
  [`${spec.track} tall`, createLevel(i, 'tall')],
  ...ASPECTS.map((a): [string, Level] => [`${spec.track} wide ${a.toFixed(2)}:1`, createLevel(i, 'wide', a)]),
]);

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
  it.each(LEVELS.map((_, i) => i))('never hides the track of level %i under the score or the buttons', (index) => {
    const level = levelForScreen(w, h, index);
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

/** Landscape phones (compact board) and their smaller HUD: score + meter top-left, two 46 px buttons top-right. */
// Spiral Drift (level 1) already ran under the HUD on these phones before levels were added; it is left as it was.
const PHONE_SCREENS: [number, number][] = [
  [740, 360],
  [812, 375],
  [844, 390],
  [896, 414],
  [932, 430],
];
const PHONE_HUD_SCORE = { w: 130, h: 72 };
const PHONE_HUD_BUTTONS = { w: 120, h: 60 };

describe.each(PHONE_SCREENS)('%i×%i phone HUD', (w, h) => {
  it.each([1, 2])('never hides the track of level %i under the score or the buttons', (index) => {
    const level = levelForScreen(w, h, index);
    expect(level.layout).toBe('compact');
    const { scale, ox, oy } = fitBoard(level, w, h);
    const r = TRACK_HALF * scale;
    for (let s = 0; s < level.path.length; s += 6) {
      const p = level.path.pointAt(s);
      const x = ox + p.x * scale;
      const y = oy + p.y * scale;
      const underScore = x - r < PHONE_HUD_SCORE.w && y - r < PHONE_HUD_SCORE.h;
      const underButtons = x + r > w - PHONE_HUD_BUTTONS.w && y - r < PHONE_HUD_BUTTONS.h;
      expect(underScore || underButtons, `track at (${x.toFixed(0)}, ${y.toFixed(0)})`).toBe(false);
    }
  });
});

describe('fitBoard', () => {
  it('centres the board and keeps it on screen', () => {
    const level = createLevel(0, 'wide', 16 / 9);
    const fit = fitBoard(level, 1920, 1080);
    expect(fit.ox).toBeGreaterThanOrEqual(0);
    expect(fit.oy).toBeGreaterThanOrEqual(0);
    expect(fit.ox * 2 + level.width * fit.scale).toBeCloseTo(1920, 3);
    expect(level.height * fit.scale).toBeLessThanOrEqual(1080);
  });

  it('leaves room for the HUD above portrait boards', () => {
    expect(fitBoard(createLevel(0, 'tall'), 390, 844).oy).toBeGreaterThan(30);
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

describe('levels (three tracks, then endless rounds)', () => {
  it('has Spiral Drift, Switchback and Rim Run, in that order', () => {
    expect(LEVELS.map((l) => l.track)).toEqual(['spiral', 'switchback', 'rim']);
    expect(ENDLESS_START).toBe(LEVELS.length);
  });

  it('gets harder level by level: never fewer colours, always faster', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].colors).toBeGreaterThanOrEqual(LEVELS[i - 1].colors);
      expect(LEVELS[i].speed).toBeGreaterThan(LEVELS[i - 1].speed);
    }
  });

  it('builds each level on its own track', () => {
    for (const layout of ['wide', 'compact', 'tall'] as const) {
      const [spiral, switchback, rim] = LEVELS.map((_, i) => createLevel(i, layout));
      expect([spiral.track, switchback.track, rim.track]).toEqual(['spiral', 'switchback', 'rim']);
      // A spiral ends near the frog; a switchback ends at the far side of the board; Rim Run ends in its loop round the frog.
      const endToFrog = (l: Level) => {
        const e = l.path.pointAt(l.path.length);
        return Math.hypot(e.x - l.shooter.x, e.y - l.shooter.y);
      };
      expect(endToFrog(switchback)).toBeGreaterThan(Math.max(endToFrog(spiral), endToFrog(rim)));
      // Switchback's straight rows: most of the track runs level.
      const level = (l: Level) => l.path.points.filter((p, i, all) => i && Math.abs(p.y - all[i - 1].y) < 1e-6).length / l.path.points.length;
      expect(level(switchback)).toBeGreaterThan(level(spiral));
    }
  });
});

describe('endless rounds', () => {
  const rounds = Array.from({ length: 30 }, (_, r) => createLevel(ENDLESS_START + r, 'wide', 16 / 9));
  const last = createLevel(ENDLESS_START - 1, 'wide', 16 / 9);

  it('use six colours and run faster than the last level', () => {
    for (const level of rounds) {
      expect(level.config.colors).toBe(6);
      expect(level.config.speed).toBeGreaterThan(last.config.speed);
    }
  });

  it('pick one of the three tracks, mixing them up and never the same twice in a row', () => {
    const tracks = rounds.map((l) => l.track);
    expect(new Set(tracks)).toEqual(new Set(['spiral', 'switchback', 'rim']));
    for (let i = 1; i < tracks.length; i++) expect(tracks[i]).not.toBe(tracks[i - 1]);
  });

  it('come in a different order each run (a new seed each time endless starts)', () => {
    const order = (seed: number) => Array.from({ length: 8 }, (_, r) => createLevel(ENDLESS_START + r, 'wide', 16 / 9, seed).track).join();
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => order(seed * 7 + 1)));
    expect(orders.size).toBeGreaterThan(10);
    const firsts = new Set(Array.from({ length: 30 }, (_, seed) => createLevel(ENDLESS_START, 'wide', 16 / 9, seed).track));
    expect(firsts.size).toBe(3);
    for (let seed = 0; seed < 20; seed++) {
      const tracks = order(seed).split(',');
      for (let i = 1; i < tracks.length; i++) expect(tracks[i]).not.toBe(tracks[i - 1]);
    }
  });

  it('give the same board for a round every time (so resizing or retrying keeps it)', () => {
    for (let r = 0; r < 10; r++) {
      expect(createLevel(ENDLESS_START + r, 'tall', 1, 42).track).toBe(createLevel(ENDLESS_START + r, 'compact', 1, 42).track);
      expect(createLevel(ENDLESS_START + r, 'tall').track).toBe(rounds[r].track);
    }
  });

  it('speed up round by round, up to a cap', () => {
    const speeds = rounds.map((l) => l.config.speed);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1]);
    // Capped at 1.55× the board's base speed (level 3 runs at 1.12×).
    expect(Math.max(...speeds)).toBeCloseTo((last.config.speed / 1.12) * 1.55, 5);
    expect(rounds[0].endlessRound).toBe(1);
    expect(last.endlessRound).toBe(0);
  });
});
