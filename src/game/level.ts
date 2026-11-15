import { BALL_DIAMETER, type LevelConfig } from './chain';
import { buildRounded, buildSpiral, type SpiralOptions, type TrackPath, type Vec } from './path';

/**
 * Board layouts. The world size differs per layout and is scaled to fit the screen.
 * - wide:    desktop & tablet landscape (the main target). Its width follows the screen's
 *            aspect ratio so the track fills the screen edge to edge, and it is only 600
 *            units tall so marbles render big.
 * - compact: landscape phones: shorter track, fewer marbles, so they render larger.
 * - tall:    portrait screens: a stretched spiral that uses the full height.
 */
export type LayoutId = 'wide' | 'compact' | 'tall';

export type TrackKind = 'spiral' | 'switchback' | 'rim';

export interface Level {
  /** 0-based: LEVELS[index], or an endless round from ENDLESS_START on. */
  index: number;
  track: TrackKind;
  /** 1, 2, 3… in endless mode; 0 for the regular levels. */
  endlessRound: number;
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

/** A level's difficulty. `speed` scales the board's base chain speed. */
export interface LevelSpec {
  track: TrackKind;
  colors: number;
  speed: number;
  /** Chance a marble repeats the previous colour: lower means fewer ready-made groups. */
  cluster: number;
}

export const LEVELS: LevelSpec[] = [
  { track: 'spiral', colors: 4, speed: 1, cluster: 0.42 },
  { track: 'switchback', colors: 5, speed: 1.06, cluster: 0.4 },
  { track: 'rim', colors: 5, speed: 1.12, cluster: 0.38 },
];
/** Level indexes from here on are endless rounds (1, 2, 3…). */
export const ENDLESS_START = LEVELS.length;
const TRACKS: TrackKind[] = ['spiral', 'switchback', 'rim'];
const ENDLESS_SPEED = 1.3;
const ENDLESS_SPEED_STEP = 0.03;
const ENDLESS_SPEED_MAX = 1.55;

/** Small deterministic hash → 0..1, so a round always gets the same board. */
function seeded(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 2 ** 32;
}

/**
 * Endless round r (from 1): a random track, never the same as the round before. `seed` is rolled
 * each time endless mode starts, so every run gets its own order; within a run a round always
 * gets the same board (so resizing or retrying keeps it).
 */
function endlessTrack(round: number, seed: number): TrackKind {
  const at = (n: number) => seeded((Math.imul(seed, 0x27d4eb2d) + n) | 0);
  let k = Math.floor(at(1) * 3);
  for (let r = 2; r <= round; r++) k = (k + 1 + Math.floor(at(r) * 2)) % 3;
  return TRACKS[k];
}

export function levelSpec(index: number, seed = 0): LevelSpec {
  if (index < ENDLESS_START) return LEVELS[Math.max(0, index)];
  const round = index - ENDLESS_START + 1;
  return {
    track: endlessTrack(round, seed),
    colors: 6,
    speed: Math.min(ENDLESS_SPEED_MAX, ENDLESS_SPEED + ENDLESS_SPEED_STEP * (round - 1)),
    cluster: 0.34,
  };
}

/** Board size for a layout; the wide board's width follows the screen's aspect ratio. */
function boardSize(layout: LayoutId, aspect: number): { width: number; height: number } {
  if (layout === 'wide') return { width: wideBoardWidth(aspect), height: WIDE_HEIGHT };
  return { width: FIXED_LAYOUTS[layout].width, height: FIXED_LAYOUTS[layout].height };
}

/** Clear of the HUD: the score sits over the top-left corner, the buttons over the top-right. */
const TRACK_START_X = 210;
const EDGE_X = 44;
const EDGE_Y = 40;
const RIM_CHAMFER = 196;

/**
 * Switchback: rows that snake back and forth, some above the frog and the rest below.
 * The first row starts right of the score and stays low enough to clear the buttons.
 */
function switchback(layout: LayoutId, width: number): { path: TrackPath; shooter: Vec } {
  const rows: Record<LayoutId, { rows: number[]; frogY: number }> = {
    wide: { rows: [90, 345, 452, 560], frogY: 220 },
    compact: { rows: [130, 330, 425, 520], frogY: 230 },
    tall: { rows: [90, 210, 330, 580, 700, 820, 940], frogY: 455 },
  };
  const { rows: ys, frogY } = rows[layout];
  const left = EDGE_X;
  const right = width - EDGE_X;
  const pts: Vec[] = [{ x: Math.min(TRACK_START_X, width * 0.35), y: ys[0] }];
  ys.forEach((y, i) => {
    const x = i % 2 === 0 ? right : left;
    const last = i === ys.length - 1;
    // The last row stops short of the edge so the vortex sits on the board.
    pts.push({ x: last ? (x === left ? left + 70 : right - 70) : x, y });
    if (!last) pts.push({ x, y: ys[i + 1] });
  });
  const turn = Math.min(...ys.slice(1).map((y, i) => y - ys[i])) / 2;
  return { path: buildRounded(pts, turn), shooter: { x: width / 2, y: frogY } };
}

/**
 * Rim Run: a long lap around the board's edge, then in to a small loop around the frog.
 * It starts right of the score, and the top-right corner is cut away from the buttons.
 */
function rimRun(layout: LayoutId, width: number, height: number): { path: TrackPath; shooter: Vec } {
  const loop: Record<LayoutId, { a: number; b: number }> = {
    wide: { a: 150, b: 125 },
    compact: { a: 170, b: 120 },
    tall: { a: 125, b: 170 },
  };
  const { a, b } = loop[layout];
  const cx = width / 2;
  const cy = height / 2;
  const [l, r, t, btm] = [EDGE_X, width - EDGE_X, EDGE_Y, height - EDGE_Y];
  const pts: Vec[] = [
    { x: Math.min(TRACK_START_X, width * 0.35), y: t },
    // The top-right corner is cut diagonally so the track drops below the buttons before reaching them.
    { x: r - RIM_CHAMFER, y: t },
    { x: r, y: t + RIM_CHAMFER },
    { x: r, y: btm },
    { x: l, y: btm },
    { x: l, y: cy },
    { x: cx - a, y: cy },
    { x: cx - a, y: cy - b },
    { x: cx + a, y: cy - b },
    { x: cx + a, y: cy + b },
    { x: cx - a * 0.1, y: cy + b },
  ];
  return { path: buildRounded(pts, [80, 80, 120, 120, 90, 60, 60, 60, 60]), shooter: { x: cx, y: cy } };
}

/**
 * Build a level for a layout. `aspect` (screen width / height) shapes the wide board;
 * the phone layouts have a fixed shape.
 */
export function createLevel(index: number, layout: LayoutId, aspect = 16 / 9, seed = 0): Level {
  const spec = levelSpec(index, seed);
  let width: number;
  let height: number;
  let path: TrackPath;
  let shooter: Vec;
  let base: LevelConfig;
  if (spec.track === 'spiral') {
    const s = layout === 'wide' ? wideLayout(aspect) : FIXED_LAYOUTS[layout];
    ({ width, height } = s);
    path = buildSpiral(s.spiral);
    shooter = { x: s.spiral.cx, y: s.spiral.cy };
    base = s.config;
  } else {
    ({ width, height } = boardSize(layout, aspect));
    ({ path, shooter } = (spec.track === 'switchback' ? switchback(layout, width) : rimRun(layout, width, height)));
    base = { ...(layout === 'wide' ? wideLayout(aspect) : FIXED_LAYOUTS[layout]).config, totalBalls: 0 };
  }
  const config: LevelConfig = { ...base, colors: spec.colors, clusterChance: spec.cluster, speed: base.speed * spec.speed };
  if (!config.totalBalls) config.totalBalls = Math.round((path.length * CHAIN_COVER) / BALL_DIAMETER);
  return {
    index,
    track: spec.track,
    endlessRound: index >= ENDLESS_START ? index - ENDLESS_START + 1 : 0,
    layout,
    width,
    height,
    path,
    shooter,
    config,
  };
}

/** The board for a level that best fits a screen (CSS pixels). `seed`: the endless run's (see endlessTrack). */
export function levelForScreen(width: number, height: number, index = 0, seed = 0): Level {
  return createLevel(index, pickLayout(width, height), width / height, seed);
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
