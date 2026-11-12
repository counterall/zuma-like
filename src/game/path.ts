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
  startRadius: number;
  endRadius: number;
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
    const r = o.startRadius + (o.endRadius - o.startRadius) * t;
    const c = Math.cos(theta);
    const sn = Math.sin(theta);
    pts.push({
      x: o.cx + r * Math.sign(c) * Math.pow(Math.abs(c), o.squareness),
      y: o.cy + r * Math.sign(sn) * Math.pow(Math.abs(sn), o.squareness),
    });
  }
  return new TrackPath(pts);
}
