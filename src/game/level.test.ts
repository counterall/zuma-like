import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, BALL_RADIUS } from './chain';
import { PAD_RADIUS } from './frog';
import { SHOOTER_RADIUS } from './game';
import { createLevel1, pickLayout, type LayoutId } from './level';

const TRACK_HALF = 30; // widest track edge (Reef, 60) / 2

describe.each<LayoutId>(['wide', 'compact', 'tall'])('%s layout', (layout) => {
  const level = createLevel1(layout);
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

  it('keeps the track clear of the frog\'s lily pad', () => {
    for (const p of samples) {
      const d = Math.hypot(p.x - level.shooter.x, p.y - level.shooter.y);
      expect(d - TRACK_HALF).toBeGreaterThan(PAD_RADIUS);
    }
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
