import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, Chain, type Ball, type ChainEvent, type LevelConfig } from './chain';
import { TrackPath, buildSpiral } from './path';

const straight = new TrackPath([
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
]);

const cfg: LevelConfig = { totalBalls: 0, colors: 4, clusterChance: 0, introSpeed: 0, introUntil: 0, speed: 0 };

let id = 1000;
function ball(color: number, s: number): Ball {
  return { id: id++, color, s, grow: 1, x: s, y: 0, angle: 0, fromX: 0, fromY: 0 };
}

/** Build a contiguous chain from colours, rear ball first. */
function chainOf(colors: number[], startS = 200, config: Partial<LevelConfig> = {}): Chain {
  const c = new Chain(straight, { ...cfg, ...config });
  c.balls = colors.map((col, i) => ball(col, startS + i * BALL_DIAMETER));
  return c;
}

function run(c: Chain, seconds: number): ChainEvent[] {
  const out: ChainEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 120) out.push(...c.update(1 / 120));
  return out;
}

describe('TrackPath', () => {
  it('measures arc length and interpolates', () => {
    const p = new TrackPath([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ]);
    expect(p.length).toBe(70);
    expect(p.pointAt(15)).toMatchObject({ x: 15, y: 0 });
    const q = p.pointAt(50);
    expect(q.x).toBe(30);
    expect(q.y).toBe(20);
    expect(q.angle).toBeCloseTo(Math.PI / 2);
  });

  it('builds a spiral with coils far enough apart for balls', () => {
    const p = buildSpiral({ cx: 500, cy: 500, startRx: 445, startRy: 445, endRx: 172, endRy: 172, turns: 1.62, startAngle: Math.PI, squareness: 0.72 });
    expect(p.length).toBeGreaterThan(2500);
  });
});

describe('Chain', () => {
  it('pops three of a kind formed by an inserted ball', () => {
    const c = chainOf([0, 1, 1, 2]);
    const hit = c.balls[2];
    c.insert(hit, true, 1, 0, 0);
    const events = run(c, 0.3);
    const pop = events.find((e) => e.type === 'pop');
    expect(pop).toBeDefined();
    expect(pop && pop.type === 'pop' && pop.balls.length).toBe(3);
    expect(c.balls.map((b) => b.color)).toEqual([0, 2]);
  });

  it('does not pop a pair', () => {
    const c = chainOf([0, 1, 2]);
    c.insert(c.balls[1], false, 1, 0, 0);
    const events = run(c, 0.3);
    expect(events.some((e) => e.type === 'pop')).toBe(false);
    expect(c.balls.map((b) => b.color)).toEqual([0, 1, 1, 2]);
    expect(c.combo).toBe(0);
  });

  it('pushes the balls in front forward when inserting', () => {
    const c = chainOf([0, 1, 2]);
    const front = c.balls[2];
    const before = front.s;
    c.insert(c.balls[0], true, 3, 0, 0);
    run(c, 0.3);
    expect(front.s).toBeCloseTo(before + BALL_DIAMETER, 0);
  });

  it('pulls the front back when the gap colours match, and chains a combo', () => {
    // 3 2 2 1 1 [1] 2 0 — popping the 1s leaves 3 2 2 _ 2 0, which should retract and pop the 2s.
    const c = chainOf([3, 2, 2, 1, 1, 2, 0]);
    c.insert(c.balls[4], true, 1, 0, 0);
    const events = run(c, 1.5);
    const pops = events.filter((e) => e.type === 'pop');
    expect(pops).toHaveLength(2);
    expect(pops[1].type === 'pop' && pops[1].combo).toBe(2);
    expect(c.balls.map((b) => b.color)).toEqual([3, 0]);
  });

  it('leaves the gap open when colours do not match', () => {
    const c = chainOf([2, 1, 1, 3]);
    const front = c.balls[3];
    c.insert(c.balls[2], true, 1, 0, 0);
    run(c, 0.2);
    const sAfterPop = front.s;
    run(c, 1);
    expect(front.s).toBeCloseTo(sAfterPop, 5);
    expect(c.balls.map((b) => b.color)).toEqual([2, 3]);
  });

  it('pushes the rear segment at the configured speed and reports reaching the end', () => {
    const c = chainOf([0, 1, 2], straight.length - 200, { speed: 400, introUntil: 0 });
    const events = run(c, 0.5);
    expect(events.some((e) => e.type === 'reachedEnd')).toBe(true);
  });

  it('spawns every ball and never spawns a ready-made triple', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const path = new TrackPath([
      { x: 0, y: 0 },
      { x: 20000, y: 0 },
    ]);
    const c = new Chain(path, { totalBalls: 200, colors: 5, clusterChance: 0.6, introSpeed: 900, introUntil: 0.9, speed: 30 }, rng);
    run(c, 12);
    expect(c.remaining).toBe(0);
    expect(c.balls).toHaveLength(200);
    for (let i = 2; i < c.balls.length; i++) {
      const [a, b, d] = [c.balls[i - 2], c.balls[i - 1], c.balls[i]];
      expect(a.color === b.color && b.color === d.color).toBe(false);
    }
    // Contiguous with no overlaps.
    for (let i = 1; i < c.balls.length; i++) {
      expect(c.balls[i].s - c.balls[i - 1].s).toBeCloseTo(BALL_DIAMETER, 0);
    }
  });
});
