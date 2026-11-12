import type { LevelConfig } from './chain';
import { buildSpiral, type TrackPath, type Vec } from './path';

/** The playfield is a square world of WORLD × WORLD units, scaled to fit the screen. */
export const WORLD = 1000;

export interface Level {
  name: string;
  path: TrackPath;
  shooter: Vec;
  config: LevelConfig;
}

export function createLevel1(): Level {
  const cx = 500;
  const cy = 515;
  return {
    name: 'Spiral Drift',
    path: buildSpiral({
      cx,
      cy,
      startRadius: 445,
      endRadius: 172,
      turns: 1.62,
      startAngle: Math.PI,
      squareness: 0.72,
    }),
    shooter: { x: cx, y: cy },
    config: {
      totalBalls: 72,
      colors: 5,
      clusterChance: 0.42,
      introSpeed: 650,
      introUntil: 0.26,
      speed: 34,
    },
  };
}
