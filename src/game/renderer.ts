import { BALL_DIAMETER, BALL_RADIUS } from './chain';
import { MUZZLE, SHOOTER_RADIUS, type Game } from './game';
import type { Level } from './level';
import type { TrackPath } from './path';
import { buildBallSprites, mix, rgba, type BallSprites } from './sprites';
import type { Theme } from './themes';

export interface View {
  /** CSS pixels. */
  width: number;
  height: number;
  dpr: number;
  /** World → CSS pixel scale and offset. */
  scale: number;
  ox: number;
  oy: number;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  view: View = { width: 1, height: 1, dpr: 1, scale: 1, ox: 0, oy: 0 };
  showAimGuide = true;
  private theme!: Theme;
  private sprites!: BallSprites;
  private bgLayer = document.createElement('canvas');
  private trackLayer = document.createElement('canvas');
  private level: Level | null = null;
  private readonly coarse = matchMedia('(pointer: coarse)').matches;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.rebuild();
  }

  setLevel(level: Level): void {
    if (this.level === level) return;
    this.level = level;
    this.fitBoard();
    this.rebuild();
  }

  resize(width: number, height: number, dpr: number): void {
    const v = this.view;
    v.width = width;
    v.height = height;
    v.dpr = Math.min(dpr, 2.5);
    this.canvas.width = Math.round(width * v.dpr);
    this.canvas.height = Math.round(height * v.dpr);
    this.fitBoard();
    this.rebuild();
  }

  /** Scale the board to fill the screen. Portrait boards leave room for the HUD above them. */
  private fitBoard(): void {
    const v = this.view;
    const W = this.level?.width ?? 1000;
    const H = this.level?.height ?? 1000;
    const top = this.level?.layout === 'tall' ? Math.min(72, v.height * 0.09) : 0;
    v.scale = Math.min(v.width / W, (v.height - top) / H) * 0.995;
    v.ox = (v.width - W * v.scale) / 2;
    v.oy = top + (v.height - top - H * v.scale) / 2;
  }

  /** CSS pixel → world coordinate. */
  toWorld(px: number, py: number): { x: number; y: number } {
    const v = this.view;
    return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
  }

  private rebuild(): void {
    if (!this.theme) return;
    const v = this.view;
    const pw = this.canvas.width;
    const ph = this.canvas.height;
    this.sprites = buildBallSprites(this.theme, v.scale * v.dpr);

    for (const layer of [this.bgLayer, this.trackLayer]) {
      layer.width = pw;
      layer.height = ph;
    }
    const bg = this.bgLayer.getContext('2d')!;
    this.theme.drawStatic(bg, pw, ph);

    const tr = this.trackLayer.getContext('2d')!;
    tr.clearRect(0, 0, pw, ph);
    if (this.level) {
      tr.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      this.drawTrack(tr, this.level.path);
    }
  }

  private tracePath(ctx: CanvasRenderingContext2D, path: TrackPath): void {
    ctx.beginPath();
    const pts = path.points;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  private drawTrack(ctx: CanvasRenderingContext2D, path: TrackPath): void {
    const t = this.theme.track;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.tracePath(ctx, path);
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = t.glowBlur;
    ctx.strokeStyle = t.edge;
    ctx.lineWidth = t.edgeWidth;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = t.fill;
    ctx.lineWidth = t.fillWidth;
    ctx.stroke();

    if (t.pebbles) {
      let seed = 3;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let s = 0; s < path.length; s += 9) {
        const p = path.pointAt(s);
        const off = (rnd() - 0.5) * t.fillWidth * 0.8;
        ctx.fillStyle = t.pebbles[Math.floor(rnd() * t.pebbles.length)];
        ctx.beginPath();
        ctx.arc(p.x - Math.sin(p.angle) * off, p.y + Math.cos(p.angle) * off, 1 + rnd() * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = t.center;
    ctx.lineWidth = 3;
    this.tracePath(ctx, path);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  render(game: Game): void {
    const ctx = this.ctx;
    const v = this.view;
    const pw = this.canvas.width;
    const ph = this.canvas.height;
    const t = game.time;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bgLayer, 0, 0);
    this.theme.drawAnimated(ctx, pw, ph, t);

    const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const k = v.scale * v.dpr;
    ctx.setTransform(1, 0, 0, 1, shakeX * k, shakeY * k);
    ctx.drawImage(this.trackLayer, 0, 0);

    const base = (): void => ctx.setTransform(k, 0, 0, k, (v.ox + shakeX * v.scale) * v.dpr, (v.oy + shakeY * v.scale) * v.dpr);
    base();

    const path = game.level.path;
    this.drawPortal(ctx, path.pointAt(0), t);
    this.drawHole(ctx, path.pointAt(path.length), t, game.danger());
    if (this.showAimGuide && game.state === 'playing' && (game.aiming || !this.coarse)) {
      this.drawAimGuide(ctx, game);
    }
    this.drawBalls(ctx, game, base);
    this.drawProjectiles(ctx, game);
    this.drawShooter(ctx, game, base);
    this.drawEffects(ctx, game);
  }

  private drawBall(ctx: CanvasRenderingContext2D, color: number, x: number, y: number, rot: number, scale: number): void {
    const sp = this.sprites;
    const half = sp.half * scale;
    const body = sp.body[color % sp.body.length];
    const tx = ctx.getTransform();
    ctx.drawImage(sp.under, x - half, y - half, half * 2, half * 2);
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(body, -half, -half, half * 2, half * 2);
    ctx.setTransform(tx);
    ctx.drawImage(sp.gloss, x - half, y - half, half * 2, half * 2);
  }

  private drawBalls(ctx: CanvasRenderingContext2D, game: Game, base: () => void): void {
    const L = game.level.path.length;
    for (const b of game.chain.balls) {
      if (b.s < -BALL_RADIUS * 0.2) continue;
      const emerge = Math.min(1, Math.max(0, (b.s + BALL_RADIUS * 0.2) / BALL_DIAMETER));
      const sink = Math.min(1, Math.max(0, (L + BALL_RADIUS - b.s) / BALL_DIAMETER));
      const grow = 0.55 + 0.45 * b.grow;
      const scale = Math.min(emerge, sink) * grow;
      if (scale <= 0.02) continue;
      this.drawBall(ctx, b.color, b.x, b.y, b.angle + b.s / BALL_RADIUS, scale);
    }
    base();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, game: Game): void {
    for (const p of game.projectiles) {
      const color = this.theme.balls[p.color % this.theme.balls.length];
      p.trail.forEach((pt, i) => {
        ctx.globalAlpha = 0.35 * (1 - i / p.trail.length);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, BALL_RADIUS * (1 - i / 9), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      this.drawBall(ctx, p.color, p.x, p.y, game.time * 12, 1);
    }
  }

  private drawAimGuide(ctx: CanvasRenderingContext2D, game: Game): void {
    const s = game.shooter;
    const target = game.aimTarget();
    const color = this.theme.balls[s.current % this.theme.balls.length];
    const sx = s.x + Math.cos(s.angle) * (MUZZLE + BALL_RADIUS + 6);
    const sy = s.y + Math.sin(s.angle) * (MUZZLE + BALL_RADIUS + 6);
    ctx.save();
    ctx.strokeStyle = rgba(color, 0.75);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 14]);
    ctx.lineDashOffset = -game.time * 60;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (target.hit) {
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 12 + Math.sin(game.time * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, t: number): void {
    const colors = this.theme.portal;
    ctx.save();
    ctx.translate(p.x, p.y);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
    glow.addColorStop(0, rgba(colors[2], 0.9));
    glow.addColorStop(0.4, rgba(colors[0], 0.5));
    glow.addColorStop(1, rgba(colors[1], 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = colors[i % 2];
      ctx.beginPath();
      const r = 18 + i * 9;
      const a = t * (2 - i * 0.6) * (i % 2 ? -1 : 1);
      ctx.arc(0, 0, r, a, a + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHole(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, t: number, danger: number): void {
    const h = this.theme.hole;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (danger > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (6 + danger * 10));
      const dg = ctx.createRadialGradient(0, 0, 20, 0, 0, 90 + pulse * 20);
      dg.addColorStop(0, `rgba(255,30,60,${0.55 * danger})`);
      dg.addColorStop(1, 'rgba(255,30,60,0)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(0, 0, 110 + pulse * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    // Swirling arms.
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 6; arm++) {
      ctx.strokeStyle = h.arms[arm % h.arms.length];
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const f = i / 20;
        const r = 46 - f * 34;
        const a = t * 2.4 + arm * (Math.PI / 3) + f * 3.2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
    core.addColorStop(0, h.core);
    core.addColorStop(0.75, h.core);
    core.addColorStop(1, rgba(h.arms[0], 0.0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawShooter(ctx: CanvasRenderingContext2D, game: Game, base: () => void): void {
    const s = game.shooter;
    const th = this.theme.shooter;
    const R = SHOOTER_RADIUS;
    ctx.save();
    ctx.translate(s.x, s.y);

    // Soft halo.
    const halo = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.6);
    halo.addColorStop(0, rgba(this.theme.ui.accent2, 0.35));
    halo.addColorStop(1, rgba(this.theme.ui.accent2, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Body.
    const body = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    body.addColorStop(0, th.body[0]);
    body.addColorStop(1, th.body[1]);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = th.ring;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Orbiting lights.
    for (let i = 0; i < 10; i++) {
      const a = game.time * 0.8 + (i * Math.PI) / 5;
      ctx.fillStyle = i % 2 ? th.lights : th.ring;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(game.time * 5 + i);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (R - 11), Math.sin(a) * (R - 11), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Barrel.
    ctx.rotate(s.angle);
    const back = -s.recoil * 8;
    ctx.fillStyle = th.barrel;
    ctx.strokeStyle = th.ring;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(back + 4, -BALL_RADIUS - 5, MUZZLE + 8, (BALL_RADIUS + 5) * 2, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Loaded ball at the muzzle, next ball in the hub.
    const ease = 1 - Math.pow(1 - s.load, 3);
    const mx = s.x + Math.cos(s.angle) * (MUZZLE - s.recoil * 8);
    const my = s.y + Math.sin(s.angle) * (MUZZLE - s.recoil * 8);
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'title') {
      this.drawBall(ctx, s.current, mx, my, s.angle, 0.4 + 0.6 * ease);
    }
    const nx = s.x - Math.cos(s.angle) * 12;
    const ny = s.y - Math.sin(s.angle) * 12;
    ctx.save();
    ctx.fillStyle = mix(th.body[1], '#000000', 0.4);
    ctx.beginPath();
    ctx.arc(nx, ny, BALL_RADIUS * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawBall(ctx, s.next, nx, ny, 0, 0.52);
    base();
  }

  private drawEffects(ctx: CanvasRenderingContext2D, game: Game): void {
    const balls = this.theme.balls;
    const colorOf = (c: number | string): string => (typeof c === 'number' ? balls[c % balls.length] : c);
    const additive = this.theme.particle !== 'bubble';

    for (const r of game.rings) {
      if (r.life < 0) continue;
      const f = r.life / r.max;
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = colorOf(r.color);
      ctx.lineWidth = 6 * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, BALL_RADIUS * 0.6 + r.radius * f, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (additive) ctx.globalCompositeOperation = 'lighter';
    for (const p of game.particles) {
      const f = p.life / p.max;
      const size = p.size * (1 - f * 0.6);
      ctx.globalAlpha = 1 - f;
      const color = colorOf(p.color);
      switch (this.theme.particle) {
        case 'star': {
          ctx.fillStyle = color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin * p.life);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            const rr = i % 2 ? size * 0.3 : size;
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'bubble':
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath();
          ctx.arc(p.x, p.y - p.life * 60, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        case 'shard': {
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          const a = Math.atan2(p.vy, p.vx);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(a) * size * 2.5, p.y - Math.sin(a) * size * 2.5);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of game.floaters) {
      const p = f.life / f.max;
      const pop = Math.min(1, f.life / 0.12);
      ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      const size = f.size * (0.6 + 0.4 * pop);
      ctx.font = `900 ${size}px "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
      const color = f.color === 'accent' ? this.theme.ui.accent : colorOf(f.color);
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
