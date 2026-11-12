/**
 * The launcher: an original cartoon tree frog sitting on a lily pad, seen from above.
 * All drawing is in world units around (0, 0); the frog faces +x before rotation.
 */

/** Lily pad radius. Layout tests keep the track clear of it. */
export const PAD_RADIUS = 66;
/** Where the frog keeps the next marble, on its back (local x). */
export const BACK_SLOT = -16;

const SKIN_LIGHT = '#a6ff5e';
const SKIN = '#3fd14a';
const SKIN_DARK = '#1f8f34';
const OUTLINE = '#126b28';
const SPOT = 'rgba(18, 107, 40, 0.5)';

export interface FrogPose {
  /** Facing angle in radians. */
  angle: number;
  /** 0..1, 1 right after a shot. */
  recoil: number;
  /** Seconds, drives breathing and blinking. */
  time: number;
}

export interface PadColors {
  light: string;
  dark: string;
  flower: string;
}

export function drawLilyPad(ctx: CanvasRenderingContext2D, colors: PadColors, glow: string): void {
  // Soft glow so the pad stands out on any background.
  const halo = ctx.createRadialGradient(0, 0, PAD_RADIUS * 0.8, 0, 0, PAD_RADIUS * 1.45);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, PAD_RADIUS * 1.45, 0, Math.PI * 2);
  ctx.fill();

  // Pad with the classic notch.
  const notch = 0.75;
  const g = ctx.createRadialGradient(-16, -16, 6, 0, 0, PAD_RADIUS);
  g.addColorStop(0, colors.light);
  g.addColorStop(1, colors.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, PAD_RADIUS, notch + 0.22, notch - 0.22 + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 60, 20, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Veins.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 1; i < 10; i++) {
    const a = notch + 0.22 + (i * (Math.PI * 2 - 0.44)) / 10;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * PAD_RADIUS * 0.88, Math.sin(a) * PAD_RADIUS * 0.88);
  }
  ctx.stroke();

  // A little flower on the rim.
  const fx = Math.cos(2.5) * PAD_RADIUS * 0.86;
  const fy = Math.sin(2.5) * PAD_RADIUS * 0.86;
  ctx.fillStyle = colors.flower;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.ellipse(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 6.5, 3.6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe14a';
  ctx.beginPath();
  ctx.arc(fx, fy, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function leg(ctx: CanvasRenderingContext2D, side: 1 | -1, back: boolean): void {
  const s = side;
  // Upper leg.
  if (back) blob(ctx, -28, 30 * s, 23, 12, 0.55 * s);
  else blob(ctx, 14, 31 * s, 13, 7.5, -0.6 * s);
  ctx.fill();
  ctx.stroke();
  // Webbed toes ending in round pads.
  const [hx, hy] = back ? [-44, 44 * s] : [22, 41 * s];
  const spread = back ? [Math.PI * 0.85, Math.PI * 0.7, Math.PI * 0.55] : [-0.2, 0.25, 0.7];
  for (const base of spread) {
    const a = base * s;
    const tx = hx + Math.cos(a) * 9;
    const ty = hy + Math.sin(a) * 9;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(tx, ty, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawFrog(ctx: CanvasRenderingContext2D, pose: FrogPose): void {
  ctx.save();
  ctx.rotate(pose.angle);
  ctx.translate(-pose.recoil * 6, 0);
  const breathe = 1 + 0.025 * Math.sin(pose.time * 2.6);
  ctx.scale(1, breathe);

  // Drop shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  blob(ctx, -4, 6, 50, 44);
  ctx.fill();

  ctx.fillStyle = SKIN;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const side of [1, -1] as const) {
    leg(ctx, side, true);
    leg(ctx, side, false);
  }

  // Body + head as one rounded shape.
  const skin = ctx.createRadialGradient(-6, -14, 4, 0, 0, 52);
  skin.addColorStop(0, SKIN_LIGHT);
  skin.addColorStop(0.55, SKIN);
  skin.addColorStop(1, SKIN_DARK);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(-8, 0, 38, 33, 0, 0, Math.PI * 2);
  ctx.ellipse(20, 0, 28, 31, 0, 0, Math.PI * 2);
  ctx.fill('nonzero');
  ctx.beginPath();
  ctx.ellipse(-8, 0, 38, 33, 0, Math.PI * 0.32, Math.PI * 1.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(20, 0, 28, 31, 0, -Math.PI * 0.62, Math.PI * 0.62);
  ctx.stroke();

  // Spots.
  ctx.fillStyle = SPOT;
  for (const [x, y, r] of [
    [-22, -13, 6],
    [-10, 16, 5],
    [-30, 9, 4],
    [2, -19, 3.5],
    [-36, -4, 3],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Saddle where the next marble rides.
  ctx.fillStyle = 'rgba(18, 107, 40, 0.6)';
  ctx.beginPath();
  ctx.arc(BACK_SLOT, 0, 15, 0, Math.PI * 2);
  ctx.fill();

  // Mouth: opens wide right after a shot.
  const open = pose.recoil;
  ctx.fillStyle = '#6a1036';
  blob(ctx, 41, 0, 7 + open * 4, 15 + open * 5);
  ctx.fill();
  ctx.fillStyle = '#ff7aa8';
  blob(ctx, 43, 0, 3 + open * 2, 8 + open * 3);
  ctx.fill();

  // Rosy cheeks.
  ctx.fillStyle = 'rgba(255, 120, 160, 0.55)';
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.arc(36, 25 * s, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big bulging eyes, with an occasional blink.
  const blinkPhase = pose.time % 4.2;
  const blinking = blinkPhase > 4.05;
  for (const s of [1, -1]) {
    const ex = 22;
    const ey = 21 * s;
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(ex - 9, ey);
      ctx.quadraticCurveTo(ex, ey + 5 * s, ex + 9, ey);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 1, ey, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(ex + 4, ey, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 2, ey - 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
