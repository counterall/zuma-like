import { Sfx } from './audio';
import { BALL_DIAMETER, BALL_RADIUS, Chain, type Ball, type ChainEvent } from './chain';
import type { Level } from './level';
import { t } from '../i18n';

export type GameState = 'title' | 'playing' | 'paused' | 'losing' | 'lost' | 'won';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  trail: { x: number; y: number }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string | number;
  size: number;
  spin: number;
}

export interface Ring {
  x: number;
  y: number;
  life: number;
  max: number;
  color: number;
  radius: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  size: number;
  color: number | 'accent';
}

export interface Shooter {
  x: number;
  y: number;
  angle: number;
  current: number;
  next: number;
  recoil: number;
  /** 0..1 animation when the loaded ball changes. */
  load: number;
  cooldown: number;
}

const SHOT_SPEED = 1500;
const FIRE_COOLDOWN = 0.16;
export const SHOOTER_RADIUS = 58;
export const MUZZLE = 50;

export interface GameCallbacks {
  onState(state: GameState): void;
  onHud(score: number, progress: number, danger: number): void;
}

export class Game {
  level!: Level;
  chain!: Chain;
  state: GameState = 'title';
  shooter!: Shooter;
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  floaters: Floater[] = [];
  score = 0;
  popped = 0;
  time = 0;
  shake = 0;
  aim = { x: 0, y: 0 };
  /** True while a touch is held down (shows the aim guide on mobile). */
  aiming = false;
  readonly sfx = new Sfx();
  private warnTimer = 0;

  constructor(
    private readonly cb: GameCallbacks,
    /** Builds the board that suits the current screen; called whenever a game is set up. */
    private readonly makeLevel: () => Level,
  ) {
    this.reset();
  }

  /** Build a fresh board, using the layout that fits the screen right now. */
  reset(): void {
    this.level = this.makeLevel();
    this.chain = new Chain(this.level.path, this.level.config);
    this.shooter = {
      x: this.level.shooter.x,
      y: this.level.shooter.y,
      angle: -Math.PI / 2,
      current: this.randomColor(),
      next: this.randomColor(),
      recoil: 0,
      load: 1,
      cooldown: 0,
    };
    this.aim = { x: this.shooter.x, y: this.shooter.y - 200 };
    this.projectiles = [];
    this.particles = [];
    this.rings = [];
    this.floaters = [];
    this.score = 0;
    this.popped = 0;
    this.shake = 0;
    this.emitHud();
  }

  start(): void {
    this.reset();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  private setState(s: GameState): void {
    this.state = s;
    this.cb.onState(s);
  }

  private randomColor(): number {
    const present = this.chain?.colorsPresent() ?? [];
    const pool = present.length ? present : [...Array(this.level.config.colors).keys()];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  setAim(x: number, y: number): void {
    this.aim.x = x;
    this.aim.y = y;
  }

  isOnShooter(x: number, y: number): boolean {
    return Math.hypot(x - this.shooter.x, y - this.shooter.y) < SHOOTER_RADIUS + 6;
  }

  swap(): void {
    if (this.state !== 'playing') return;
    const s = this.shooter;
    [s.current, s.next] = [s.next, s.current];
    s.load = 0;
    this.sfx.swap();
  }

  fire(): void {
    const s = this.shooter;
    if (this.state !== 'playing' || s.cooldown > 0) return;
    const dx = Math.cos(s.angle);
    const dy = Math.sin(s.angle);
    this.projectiles.push({
      x: s.x + dx * MUZZLE,
      y: s.y + dy * MUZZLE,
      vx: dx * SHOT_SPEED,
      vy: dy * SHOT_SPEED,
      color: s.current,
      trail: [],
    });
    s.current = s.next;
    s.next = this.randomColor();
    s.load = 0;
    s.recoil = 1;
    s.cooldown = FIRE_COOLDOWN;
    this.sfx.shoot();
  }

  update(dt: number): void {
    this.time += dt;
    this.updateEffects(dt);
    if (this.state !== 'playing' && this.state !== 'losing') return;

    const s = this.shooter;
    s.angle = Math.atan2(this.aim.y - s.y, this.aim.x - s.x);
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.recoil = Math.max(0, s.recoil - dt * 6);
    s.load = Math.min(1, s.load + dt * 7);

    // Chain logic in small fixed steps for stable contact detection.
    let remaining = dt;
    while (remaining > 1e-6) {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      this.handleChainEvents(this.chain.update(step));
    }

    if (this.state === 'playing') {
      this.updateProjectiles(dt);
      this.keepShooterColorsValid();
      this.updateDanger(dt);
      if (this.chain.isCleared()) {
        this.celebrate();
        this.setState('won');
        this.sfx.win();
      }
    } else if (this.state === 'losing' && this.chain.balls.length === 0) {
      this.setState('lost');
    }
    this.emitHud();
  }

  private emitHud(): void {
    // Progress = share of the level's balls no longer waiting to spawn or on the track.
    const total = this.level.config.totalBalls;
    const left = this.chain.remaining + this.chain.balls.length;
    this.cb.onHud(this.score, Math.max(0, Math.min(1, 1 - left / total)), this.danger());
  }

  /** 0..1 — how close the front ball is to the hole (only meaningful past 70%). */
  danger(): number {
    return Math.max(0, (this.chain.frontProgress() - 0.7) / 0.3);
  }

  private updateDanger(dt: number): void {
    const d = this.danger();
    if (d <= 0) return;
    this.warnTimer -= dt;
    if (this.warnTimer <= 0) {
      this.sfx.warn();
      this.warnTimer = 1.1 - d * 0.6;
    }
  }

  private keepShooterColorsValid(): void {
    const present = this.chain.colorsPresent();
    if (!present.length) return;
    const s = this.shooter;
    if (!present.includes(s.current)) {
      s.current = this.randomColor();
      s.load = 0;
    }
    if (!present.includes(s.next)) s.next = this.randomColor();
  }

  private updateProjectiles(dt: number): void {
    const balls = this.chain.balls;
    const hitDist = BALL_DIAMETER * 0.92;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.pop();
      const steps = Math.ceil((SHOT_SPEED * dt) / 10);
      let hit: Ball | null = null;
      for (let k = 0; k < steps && !hit; k++) {
        p.x += (p.vx * dt) / steps;
        p.y += (p.vy * dt) / steps;
        for (const b of balls) {
          if (b.s < BALL_RADIUS) continue;
          if (Math.abs(b.x - p.x) < hitDist && Math.abs(b.y - p.y) < hitDist && Math.hypot(b.x - p.x, b.y - p.y) < hitDist) {
            hit = b;
            break;
          }
        }
      }
      if (hit) {
        const ahead = (p.x - hit.x) * Math.cos(hit.angle) + (p.y - hit.y) * Math.sin(hit.angle) > 0;
        this.chain.insert(hit, ahead, p.color, p.x, p.y);
        this.sfx.insert();
        this.projectiles.splice(i, 1);
      } else if (p.x < -80 || p.y < -80 || p.x > this.level.width + 80 || p.y > this.level.height + 80) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /** Where the aim line meets the chain (or the world edge). */
  aimTarget(): { x: number; y: number; hit: boolean } {
    const s = this.shooter;
    const dx = Math.cos(s.angle);
    const dy = Math.sin(s.angle);
    const hitDist = BALL_DIAMETER * 0.92;
    let x = s.x + dx * MUZZLE;
    let y = s.y + dy * MUZZLE;
    for (let i = 0; i < 160; i++) {
      x += dx * 8;
      y += dy * 8;
      if (x < -20 || y < -20 || x > this.level.width + 20 || y > this.level.height + 20) return { x, y, hit: false };
      for (const b of this.chain.balls) {
        if (b.s < BALL_RADIUS) continue;
        if (Math.abs(b.x - x) < hitDist && Math.abs(b.y - y) < hitDist && Math.hypot(b.x - x, b.y - y) < hitDist) {
          return { x, y, hit: true };
        }
      }
    }
    return { x, y, hit: false };
  }

  private handleChainEvents(events: ChainEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'pop': {
          this.score += e.points;
          this.popped += e.balls.length;
          let cx = 0;
          let cy = 0;
          for (const b of e.balls) {
            cx += b.x;
            cy += b.y;
            this.burst(b.x, b.y, b.color, 10 + e.combo * 2);
            this.rings.push({ x: b.x, y: b.y, life: 0, max: 0.45, color: b.color, radius: BALL_RADIUS * 2.2 });
          }
          cx /= e.balls.length;
          cy /= e.balls.length;
          this.floaters.push({ x: cx, y: cy - 10, text: `+${e.points}`, life: 0, max: 1.1, size: 30, color: e.balls[0].color });
          if (e.combo >= 2) {
            this.floaters.push({ x: cx, y: cy - 52, text: t('fx.combo', { n: e.combo }), life: 0, max: 1.4, size: 38 + e.combo * 4, color: 'accent' });
          } else if (e.balls.length >= 5) {
            this.floaters.push({ x: cx, y: cy - 52, text: t('fx.great'), life: 0, max: 1.2, size: 36, color: 'accent' });
          }
          this.shake = Math.min(14, this.shake + 3 + e.combo * 2 + e.balls.length * 0.5);
          this.sfx.pop(e.combo, e.balls.length);
          navigator.vibrate?.(e.combo > 1 ? [12, 30, 18] : 12);
          break;
        }
        case 'join':
          this.sfx.insert();
          break;
        case 'reachedEnd':
          if (this.state === 'playing') {
            this.chain.rushing = true;
            this.projectiles = [];
            this.shake = 16;
            this.setState('losing');
            this.sfx.lose();
          }
          break;
        case 'swallowed': {
          const end = this.level.path.pointAt(this.level.path.length);
          this.burst(end.x, end.y, e.color, 4);
          break;
        }
      }
    }
  }

  burst(x: number, y: number, color: number | string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 0.5 + Math.random() * 0.6,
        color,
        size: 3 + Math.random() * 6,
        spin: (Math.random() - 0.5) * 12,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  private celebrate(): void {
    const { width, height } = this.level;
    for (let i = 0; i < 12; i++) {
      const x = width * (0.15 + Math.random() * 0.7);
      const y = height * (0.15 + Math.random() * 0.6);
      this.burst(x, y, Math.floor(Math.random() * this.level.config.colors), 24);
      this.rings.push({ x, y, life: -i * 0.08, max: 0.7, color: i % this.level.config.colors, radius: 90 });
    }
    this.floaters.push({ x: width / 2, y: height * 0.42, text: t('fx.cleared'), life: 0, max: 2.2, size: Math.min(80, width / 9), color: 'accent' });
  }

  private updateEffects(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 40);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.2;
      p.vy *= 1 - dt * 2.2;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.max) this.rings.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life += dt;
      f.y -= dt * 40;
      if (f.life >= f.max) this.floaters.splice(i, 1);
    }
  }
}
