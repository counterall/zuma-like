export interface Vec {
  x: number;
  y: number;
}

export interface PathPoint extends Vec {
  /** Tangent angle in radians (direction of travel). */
  angle: number;
}

/**
 * A polyline track parameterised by arc length.
 * `pointAt(s)` maps a distance along the track to a world position.
 */
export class TrackPath {
  readonly points: Vec[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(points: Vec[]) {
    if (points.length < 2) throw new Error('A path needs at least two points');
    this.points = points;
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  pointAt(s: number): PathPoint {
    const pts = this.points;
    const cum = this.cumulative;
    if (s <= 0) return this.extrapolate(0, 1, s);
    if (s >= this.length) return this.extrapolate(pts.length - 2, pts.length - 1, s - this.length, true);

    // Binary search for the segment containing s.
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    const segLen = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / segLen;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  /** Continue straight past either end of the path (used for balls hidden in the spawn portal). */
  private extrapolate(i: number, j: number, over: number, fromEnd = false): PathPoint {
    const a = this.points[i];
    const b = this.points[j];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const origin = fromEnd ? b : a;
    return { x: origin.x + Math.cos(angle) * over, y: origin.y + Math.sin(angle) * over, angle };
  }
}

export interface SpiralOptions {
  cx: number;
  cy: number;
  /** Horizontal / vertical radii at the start and end, so the spiral can be stretched to fit the screen. */
  startRx: number;
  startRy: number;
  endRx: number;
  endRy: number;
  turns: number;
  startAngle: number;
  /** Superellipse exponent: 1 = circle, < 1 = squarer corners. */
  squareness: number;
  samples?: number;
}

/** Builds an inward-winding, slightly squared spiral. */
export function buildSpiral(o: SpiralOptions): TrackPath {
  const samples = o.samples ?? 1400;
  const pts: Vec[] = [];
  const total = o.turns * Math.PI * 2;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const theta = o.startAngle + t * total;
    const rx = o.startRx + (o.endRx - o.startRx) * t;
    const ry = o.startRy + (o.endRy - o.startRy) * t;
    const c = Math.cos(theta);
    const sn = Math.sin(theta);
    pts.push({
      x: o.cx + rx * Math.sign(c) * Math.pow(Math.abs(c), o.squareness),
      y: o.cy + ry * Math.sign(sn) * Math.pow(Math.abs(sn), o.squareness),
    });
  }
  return new TrackPath(pts);
}

/**
 * A path through waypoints with every corner rounded into a circular arc, for tracks made of
 * straight runs (Switchback, Rim Run). `radius` is one value or one per corner; each is shrunk
 * if needed so neighbouring arcs never overlap.
 */
export function buildRounded(waypoints: Vec[], radius: number | number[], step = 4): TrackPath {
  const pts: Vec[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const [a, p, b] = [waypoints[i - 1], waypoints[i], waypoints[i + 1]];
    const len1 = Math.hypot(p.x - a.x, p.y - a.y);
    const len2 = Math.hypot(b.x - p.x, b.y - p.y);
    const d1 = { x: (p.x - a.x) / len1, y: (p.y - a.y) / len1 };
    const d2 = { x: (b.x - p.x) / len2, y: (b.y - p.y) / len2 };
    const cross = d1.x * d2.y - d1.y * d2.x;
    const turn = Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
    if (turn < 1e-6) {
      pts.push(p);
      continue;
    }
    const want = Array.isArray(radius) ? radius[i - 1] : radius;
    // Tangent length; a straight segment shared by two corners gives each at most half.
    const half = Math.tan(turn / 2);
    const r = Math.min(want, (len1 / 2) / half, (len2 / 2) / half);
    const tl = r * half;
    const start = { x: p.x - d1.x * tl, y: p.y - d1.y * tl };
    const side = Math.sign(cross);
    const c = { x: start.x - d1.y * r * side, y: start.y + d1.x * r * side };
    const a0 = Math.atan2(start.y - c.y, start.x - c.x);
    const n = Math.max(2, Math.ceil((r * turn) / step));
    for (let k = 0; k <= n; k++) {
      const ang = a0 + side * turn * (k / n);
      pts.push({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r });
    }
  }
  pts.push(waypoints[waypoints.length - 1]);
  return new TrackPath(pts);
}
