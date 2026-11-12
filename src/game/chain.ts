import type { TrackPath } from './path';

export const BALL_RADIUS = 22;
export const BALL_DIAMETER = BALL_RADIUS * 2;
const CONTACT_EPS = 1.5;
const INSERT_TIME = 0.14;
const RETRACT_SPEED = 560;
const RUSH_SPEED = 1300;

export interface Ball {
  id: number;
  color: number;
  /** Distance along the track. Negative = still hidden inside the spawn portal. */
  s: number;
  /** Insertion progress 0..1. A growing ball occupies `grow` of a full slot. */
  grow: number;
  /** World position, refreshed every update. */
  x: number;
  y: number;
  angle: number;
  /** Where the shot ball touched the chain, for the insert animation. */
  fromX: number;
  fromY: number;
}

export interface LevelConfig {
  totalBalls: number;
  colors: number;
  /** Chance that a spawned ball repeats the previous colour (makes clusters). */
  clusterChance: number;
  introSpeed: number;
  /** The intro rush lasts until the front ball reaches this fraction of the track. */
  introUntil: number;
  speed: number;
}

export type ChainEvent =
  | { type: 'pop'; balls: { x: number; y: number; color: number }[]; combo: number; points: number }
  | { type: 'join' }
  | { type: 'reachedEnd' }
  | { type: 'swallowed'; color: number };

interface PendingCheck {
  ball: Ball;
  fromJoin: boolean;
}

export class Chain {
  balls: Ball[] = [];
  remaining: number;
  combo = 0;
  rushing = false;
  private nextId = 1;
  private pending: PendingCheck[] = [];
  private introDone = false;

  constructor(
    readonly path: TrackPath,
    readonly cfg: LevelConfig,
    private readonly rng: () => number = Math.random,
  ) {
    this.remaining = cfg.totalBalls;
  }

  get spawnedCount(): number {
    return this.cfg.totalBalls - this.remaining;
  }

  /** 0..1 — how far the front ball has travelled along the track. */
  frontProgress(): number {
    const front = this.balls[this.balls.length - 1];
    return front ? Math.max(0, front.s) / this.path.length : 0;
  }

  colorsPresent(): number[] {
    const set = new Set<number>();
    for (const b of this.balls) set.add(b.color);
    return [...set];
  }

  isCleared(): boolean {
    return this.remaining === 0 && this.balls.length === 0;
  }

  currentSpeed(): number {
    if (!this.introDone) {
      if (this.frontProgress() >= this.cfg.introUntil) this.introDone = true;
      else return this.cfg.introSpeed;
    }
    // Ease off a little in the danger zone so a comeback is possible.
    const p = this.frontProgress();
    return p > 0.85 ? this.cfg.speed * 0.6 : this.cfg.speed;
  }

  update(dt: number): ChainEvent[] {
    const events: ChainEvent[] = [];

    if (this.rushing) {
      for (const b of this.balls) b.s += RUSH_SPEED * dt;
      while (this.balls.length && this.balls[this.balls.length - 1].s > this.path.length + BALL_RADIUS) {
        const b = this.balls.pop()!;
        events.push({ type: 'swallowed', color: b.color });
      }
      this.refreshPositions();
      return events;
    }

    for (const b of this.balls) {
      if (b.grow < 1) {
        b.grow = Math.min(1, b.grow + dt / INSERT_TIME);
        if (b.grow === 1) this.pending.push({ ball: b, fromJoin: false });
      }
    }

    this.spawn();
    this.move(dt);
    this.processPending(events);

    const front = this.balls[this.balls.length - 1];
    if (front && front.s >= this.path.length) events.push({ type: 'reachedEnd' });

    this.refreshPositions();
    return events;
  }

  /**
   * Insert a shot ball next to `hit`. `ahead` = on the side closer to the hole.
   */
  insert(hit: Ball, ahead: boolean, color: number, fromX: number, fromY: number): Ball | null {
    const idx = this.balls.indexOf(hit);
    if (idx < 0) return null;
    const ball = this.makeBall(color, ahead ? hit.s + BALL_RADIUS : hit.s - BALL_RADIUS);
    ball.grow = 0;
    ball.fromX = fromX;
    ball.fromY = fromY;
    this.balls.splice(ahead ? idx + 1 : idx, 0, ball);
    this.refreshPositions();
    return ball;
  }

  private makeBall(color: number, s: number): Ball {
    return { id: this.nextId++, color, s, grow: 1, x: 0, y: 0, angle: 0, fromX: 0, fromY: 0 };
  }

  private pickColor(): number {
    const [a, b] = this.balls;
    const n = this.cfg.colors;
    let c: number;
    if (a && this.rng() < this.cfg.clusterChance) c = a.color;
    else c = Math.floor(this.rng() * n);
    // Never spawn a ready-made triple.
    let guard = 0;
    while (a && b && a.color === c && b.color === c && guard++ < 10) c = Math.floor(this.rng() * n);
    return c;
  }

  private spawn(): void {
    while (this.remaining > 0) {
      const rear = this.balls[0];
      if (rear && rear.s < 0) break;
      // Attach behind the rear ball if it is near the start; otherwise start a fresh pushed segment.
      const s = rear && rear.s < BALL_DIAMETER ? rear.s - BALL_DIAMETER : -BALL_DIAMETER;
      this.balls.unshift(this.makeBall(this.pickColor(), s));
      this.remaining--;
    }
  }

  private spacing(i: number): number {
    return BALL_RADIUS * (this.balls[i].grow + this.balls[i + 1].grow);
  }

  private connected(i: number): boolean {
    return this.balls[i + 1].s - this.balls[i].s - this.spacing(i) <= CONTACT_EPS;
  }

  private move(dt: number): void {
    const balls = this.balls;
    if (!balls.length) return;

    // Split into contiguous segments: [startIndex, endIndex].
    const segs: [number, number][] = [];
    let start = 0;
    for (let i = 0; i < balls.length - 1; i++) {
      if (!this.connected(i)) {
        segs.push([start, i]);
        start = i + 1;
      }
    }
    segs.push([start, balls.length - 1]);

    const retractingRears = new Set<Ball>();
    const speed = this.currentSpeed();
    segs.forEach(([a, b], k) => {
      let v = 0;
      if (k === 0) v = speed;
      else {
        const behind = balls[segs[k - 1][1]];
        const rear = balls[a];
        if (behind.color === rear.color && behind.grow === 1 && rear.grow === 1) {
          v = -RETRACT_SPEED;
          retractingRears.add(rear);
        }
      }
      if (v !== 0) for (let i = a; i <= b; i++) balls[i].s += v * dt;
    });

    // Resolve overlaps from the back: rear balls push the ones in front.
    for (let i = 0; i < balls.length - 1; i++) {
      const min = balls[i].s + this.spacing(i);
      const next = balls[i + 1];
      if (next.s < min) {
        next.s = min;
      }
      // Same tolerance as `connected()`, so a retracting segment can never stop short of a join.
      if (retractingRears.has(next) && next.s - min <= CONTACT_EPS) {
        retractingRears.delete(next);
        next.s = min;
        this.pending.push({ ball: next, fromJoin: true });
      }
    }
  }

  private findGroup(idx: number): [number, number] | null {
    const balls = this.balls;
    const c = balls[idx].color;
    if (balls[idx].grow < 1) return null;
    let lo = idx;
    let hi = idx;
    while (lo > 0 && balls[lo - 1].color === c && balls[lo - 1].grow === 1 && this.connected(lo - 1)) lo--;
    while (hi < balls.length - 1 && balls[hi + 1].color === c && balls[hi + 1].grow === 1 && this.connected(hi)) hi++;
    return [lo, hi];
  }

  private processPending(events: ChainEvent[]): void {
    const checks = this.pending;
    this.pending = [];
    let joined = false;
    for (const check of checks) {
      const idx = this.balls.indexOf(check.ball);
      if (idx < 0) continue;
      const group = this.findGroup(idx);
      const count = group ? group[1] - group[0] + 1 : 0;
      if (group && count >= 3) {
        this.combo = check.fromJoin ? this.combo + 1 : 1;
        const removed = this.balls.splice(group[0], count);
        this.refreshPositions(removed);
        const points = (count * 10 + Math.max(0, count - 3) * 15) * this.combo;
        events.push({
          type: 'pop',
          balls: removed.map((b) => ({ x: b.x, y: b.y, color: b.color })),
          combo: this.combo,
          points,
        });
      } else if (check.fromJoin) {
        joined = true;
      } else {
        this.combo = 0;
      }
    }
    if (joined) events.push({ type: 'join' });
  }

  private refreshPositions(list: Ball[] = this.balls): void {
    for (const b of list) {
      const p = this.path.pointAt(b.s);
      b.angle = p.angle;
      if (b.grow < 1) {
        const t = 1 - (1 - b.grow) * (1 - b.grow);
        b.x = b.fromX + (p.x - b.fromX) * t;
        b.y = b.fromY + (p.y - b.fromY) * t;
      } else {
        b.x = p.x;
        b.y = p.y;
      }
    }
  }
}
