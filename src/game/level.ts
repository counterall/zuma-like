import type { LevelConfig } from './chain';
import { buildSpiral, type SpiralOptions, type TrackPath, type Vec } from './path';

/**
 * Board layouts. The world size differs per layout and is scaled to fit the screen.
 * - wide:    desktop & tablet landscape (the main target): biggest board, longest track.
 * - compact: landscape phones: shorter track, fewer marbles, so they render larger.
 * - tall:    portrait screens: a stretched spiral that uses the full height.
 */
export type LayoutId = 'wide' | 'compact' | 'tall';

export interface Level {
  name: string;
  layout: LayoutId;
  /** World size in units; the board is cropped tightly around the track. */
  width: number;
  height: number;
  path: TrackPath;
  shooter: Vec;
  config: LevelConfig;
}

interface LayoutSpec {
  width: number;
  height: number;
  spiral: SpiralOptions;
  config: LevelConfig;
}

const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  wide: {
    width: 1400,
    height: 900,
    spiral: { cx: 700, cy: 455, startRx: 640, startRy: 405, endRx: 265, endRy: 158, turns: 1.9, startAngle: Math.PI, squareness: 0.72 },
    config: { totalBalls: 92, colors: 5, clusterChance: 0.42, introSpeed: 750, introUntil: 0.26, speed: 38 },
  },
  compact: {
    width: 1000,
    height: 560,
    spiral: { cx: 500, cy: 280, startRx: 460, startRy: 250, endRx: 205, endRy: 112, turns: 1.35, startAngle: Math.PI, squareness: 0.72 },
    config: { totalBalls: 52, colors: 5, clusterChance: 0.42, introSpeed: 600, introUntil: 0.26, speed: 30 },
  },
  tall: {
    width: 560,
    height: 1060,
    spiral: { cx: 280, cy: 535, startRx: 250, startRy: 495, endRx: 112, endRy: 200, turns: 1.5, startAngle: Math.PI, squareness: 0.72 },
    config: { totalBalls: 56, colors: 5, clusterChance: 0.42, introSpeed: 600, introUntil: 0.26, speed: 30 },
  },
};

/** Choose the layout that gives the biggest marbles for a viewport (CSS pixels). */
export function pickLayout(width: number, height: number): LayoutId {
  if (width / height < 0.85) return 'tall';
  if (Math.min(width, height) < 600) return 'compact';
  return 'wide';
}

export function createLevel1(layout: LayoutId): Level {
  const spec = LAYOUTS[layout];
  return {
    name: 'Spiral Drift',
    layout,
    width: spec.width,
    height: spec.height,
    path: buildSpiral(spec.spiral),
    shooter: { x: spec.spiral.cx, y: spec.spiral.cy },
    config: { ...spec.config },
  };
}
