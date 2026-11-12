import { BALL_DIAMETER, type LevelConfig } from './chain';
import { buildSpiral, type SpiralOptions, type TrackPath, type Vec } from './path';

/**
 * Board layouts. The world size differs per layout and is scaled to fit the screen.
 * - wide:    desktop & tablet landscape (the main target). Its width follows the screen's
 *            aspect ratio so the track fills the screen edge to edge, and it is only 600
 *            units tall so marbles render big.
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

const FIXED_LAYOUTS: Record<Exclude<LayoutId, 'wide'>, LayoutSpec> = {
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

/** Wide board height in world units. Every wide board is this tall, so marble size depends only on screen height. */
const WIDE_HEIGHT = 600;
const WIDE_MIN_WIDTH = 800; // 4:3
const WIDE_MAX_WIDTH = 1200; // 2:1; wider screens get side margins rather than an over-long track
/** Width step, so a slightly resized window keeps the same board. */
const WIDE_STEP = 20;
/** Lined up, the whole chain covers this fraction of the track (matches the tuned phone layouts). */
const CHAIN_COVER = 0.9;

/** World width of the wide board for a screen aspect ratio (width / height). */
export function wideBoardWidth(aspect: number): number {
  // Round down so the board is never wider than the screen's shape: it then always fills the full height.
  const w = Math.floor((WIDE_HEIGHT * aspect) / WIDE_STEP) * WIDE_STEP;
  return Math.min(WIDE_MAX_WIDTH, Math.max(WIDE_MIN_WIDTH, w));
}

/** Margin between the board edge and the track centre line (track half-width is 30). */
const WIDE_MARGIN_X = 44;
const WIDE_MARGIN_Y = 40;

function bounds(spiral: SpiralOptions): { minX: number; maxX: number; minY: number; maxY: number } {
  const { points } = buildSpiral(spiral);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function wideLayout(aspect: number): LayoutSpec {
  const width = wideBoardWidth(aspect);
  const height = WIDE_HEIGHT;
  const startRy = height / 2 - WIDE_MARGIN_Y;
  const endRy = 112;
  const ringGap = startRy - endRy;
  // Shrink both radii by the same amount so the gap between coils is even all the way round.
  const spiral = (startRx: number, cx: number, cy: number): SpiralOptions => ({
    cx, cy, startRx, startRy, endRx: startRx - ringGap, endRy, turns: 1.6, startAngle: Math.PI, squareness: 0.72,
  });
  // The spiral starts on the left and tightens, so its right side sits further in than its left.
  // Measure it, then widen and re-centre it so it fills the board with even margins.
  let opts = spiral(width / 2 - WIDE_MARGIN_X, width / 2, height / 2);
  const b = bounds(opts);
  const grow = (width - 2 * WIDE_MARGIN_X - (b.maxX - b.minX)) / 2;
  opts = spiral(opts.startRx + grow, opts.cx + (width - b.maxX - b.minX) / 2, opts.cy + (height - b.maxY - b.minY) / 2);
  return {
    width,
    height,
    spiral: opts,
    // totalBalls is filled in from the track length.
    config: { totalBalls: 0, colors: 5, clusterChance: 0.42, introSpeed: 650, introUntil: 0.26, speed: 32 },
  };
}

/** Choose the layout that gives the biggest marbles for a viewport (CSS pixels). */
export function pickLayout(width: number, height: number): LayoutId {
  if (width / height < 0.85) return 'tall';
  if (Math.min(width, height) < 600) return 'compact';
  return 'wide';
}

/**
 * Build level 1 for a layout. `aspect` (screen width / height) shapes the wide board;
 * the phone layouts have a fixed shape.
 */
export function createLevel1(layout: LayoutId, aspect = 16 / 9): Level {
  const spec = layout === 'wide' ? wideLayout(aspect) : FIXED_LAYOUTS[layout];
  const path = buildSpiral(spec.spiral);
  const config = { ...spec.config };
  if (!config.totalBalls) config.totalBalls = Math.round((path.length * CHAIN_COVER) / BALL_DIAMETER);
  return {
    name: 'Spiral Drift',
    layout,
    width: spec.width,
    height: spec.height,
    path,
    shooter: { x: spec.spiral.cx, y: spec.spiral.cy },
    config,
  };
}

/** The level that best fits a screen (CSS pixels). */
export function levelForScreen(width: number, height: number): Level {
  return createLevel1(pickLayout(width, height), width / height);
}

/** Would a screen of this size get the same board as `level`? */
export function sameBoard(level: Level, width: number, height: number): boolean {
  const layout = pickLayout(width, height);
  if (layout !== level.layout) return false;
  return layout !== 'wide' || wideBoardWidth(width / height) === level.width;
}

export interface BoardFit {
  /** CSS pixels per world unit. */
  scale: number;
  /** Board origin on screen, in CSS pixels. */
  ox: number;
  oy: number;
}

/** Scale a board to fill a screen. Portrait boards leave room for the HUD above them. */
export function fitBoard(level: Pick<Level, 'layout' | 'width' | 'height'>, vw: number, vh: number): BoardFit {
  const top = level.layout === 'tall' ? Math.min(72, vh * 0.09) : 0;
  const scale = Math.min(vw / level.width, (vh - top) / level.height) * 0.995;
  return { scale, ox: (vw - level.width * scale) / 2, oy: top + (vh - top - level.height * scale) / 2 };
}
