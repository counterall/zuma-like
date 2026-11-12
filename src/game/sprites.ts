import { BALL_RADIUS } from './chain';
import type { Theme } from './themes';

export interface BallSprites {
  /** One rotating body sprite per ball colour. */
  body: HTMLCanvasElement[];
  /** Static highlight drawn on top (does not rotate with the roll). */
  gloss: HTMLCanvasElement;
  /** Static soft shadow drawn underneath. */
  under: HTMLCanvasElement;
  /** Half the sprite's side length, in world units. */
  half: number;
}

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeCanvas(px: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(4, Math.ceil(px));
  return [c, c.getContext('2d')!];
}

/** Small per-colour symbol so colours are distinguishable without relying on hue alone. */
export function drawSymbol(ctx: CanvasRenderingContext2D, index: number, r: number): void {
  ctx.beginPath();
  switch (index % 5) {
    case 0:
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      break;
    case 1: {
      // Plus sign — stays distinct from the square when the ball rotates.
      const a = r * 0.72;
      const b = r * 0.24;
      ctx.moveTo(-b, -a);
      ctx.lineTo(b, -a);
      ctx.lineTo(b, -b);
      ctx.lineTo(a, -b);
      ctx.lineTo(a, b);
      ctx.lineTo(b, b);
      ctx.lineTo(b, a);
      ctx.lineTo(-b, a);
      ctx.lineTo(-b, b);
      ctx.lineTo(-a, b);
      ctx.lineTo(-a, -b);
      ctx.lineTo(-b, -b);
      break;
    }
    case 2:
      ctx.moveTo(0, -r * 0.75);
      ctx.lineTo(r * 0.68, r * 0.5);
      ctx.lineTo(-r * 0.68, r * 0.5);
      break;
    case 3:
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.32 : r * 0.78;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      break;
    default:
      ctx.rect(-r * 0.5, -r * 0.5, r, r);
  }
  ctx.closePath();
}

export function buildBallSprites(theme: Theme, pxPerUnit: number): BallSprites {
  const R = BALL_RADIUS;
  const pad = theme.ballStyle === 'neon' ? 12 : 6;
  const half = R + pad;
  const px = half * 2 * pxPerUnit;

  const body = theme.balls.map((color, index) => {
    const [canvas, ctx] = makeCanvas(px);
    ctx.scale(canvas.width / (half * 2), canvas.height / (half * 2));
    ctx.translate(half, half);
    drawBody(ctx, theme, color, index, R);
    return canvas;
  });

  const [gloss, g] = makeCanvas(px);
  g.scale(gloss.width / (half * 2), gloss.height / (half * 2));
  g.translate(half, half);
  const strength = theme.ballStyle === 'neon' ? 0.45 : 0.9;
  g.save();
  g.rotate(-0.6);
  const hl = g.createRadialGradient(-R * 0.05, -R * 0.52, 0, -R * 0.05, -R * 0.52, R * 0.5);
  hl.addColorStop(0, `rgba(255,255,255,${strength})`);
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.beginPath();
  g.ellipse(-R * 0.05, -R * 0.52, R * 0.5, R * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = `rgba(255,255,255,${strength * 0.8})`;
  g.beginPath();
  g.arc(-R * 0.42, -R * 0.42, R * 0.1, 0, Math.PI * 2);
  g.fill();

  const [under, u] = makeCanvas(px);
  u.scale(under.width / (half * 2), under.height / (half * 2));
  u.translate(half, half);
  const sh = u.createRadialGradient(3, 5, R * 0.6, 3, 5, R * 1.15);
  sh.addColorStop(0, theme.ballStyle === 'neon' ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.45)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  u.fillStyle = sh;
  u.fillRect(-half, -half, half * 2, half * 2);

  return { body, gloss, under, half };
}

function drawBody(ctx: CanvasRenderingContext2D, theme: Theme, color: string, index: number, R: number): void {
  if (theme.ballStyle === 'neon') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    core.addColorStop(0, rgba(color, 0.55));
    core.addColorStop(0.7, rgba(color, 0.2));
    core.addColorStop(1, rgba(color, 0.35));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, R - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.strokeStyle = mix(color, '#ffffff', 0.6);
    ctx.lineWidth = 2.5;
    drawSymbol(ctx, index, R * 0.62);
    ctx.stroke();
    ctx.shadowBlur = 0;
    return;
  }

  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
  g.addColorStop(0, mix(color, '#ffffff', 0.55));
  g.addColorStop(0.5, color);
  g.addColorStop(1, mix(color, '#000000', theme.ballStyle === 'pearl' ? 0.3 : 0.5));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.clip();
  if (theme.ballStyle === 'pearl') {
    // Iridescent sheen + a curling stripe.
    const sheen = ctx.createLinearGradient(-R, R, R, -R);
    sheen.addColorStop(0, 'rgba(120,255,255,0.0)');
    sheen.addColorStop(0.45, 'rgba(255,160,255,0.28)');
    sheen.addColorStop(0.6, 'rgba(160,255,230,0.28)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(R * 0.9, 0, R * 1.2, Math.PI * 0.75, Math.PI * 1.25);
    ctx.stroke();
  } else {
    // Glossy marble: a light equatorial band.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-R, -R * 0.2, R * 2, R * 0.4);
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeStyle = mix(color, '#000000', 0.35);
  ctx.lineWidth = 1.5;
  drawSymbol(ctx, index, R * 0.42);
  ctx.fill();
  ctx.stroke();
}
