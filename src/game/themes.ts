export type ThemeId = 'cosmic' | 'reef' | 'classic';
export type BallStyle = 'glossy' | 'pearl';
export type ParticleStyle = 'star' | 'bubble' | 'petal';

export interface Theme {
  id: ThemeId;
  /** Five vivid ball colours. */
  balls: string[];
  ballStyle: BallStyle;
  particle: ParticleStyle;
  track: {
    edge: string;
    edgeWidth: number;
    fill: string;
    fillWidth: number;
    center: string;
    glow: string;
    glowBlur: number;
    pebbles?: string[];
  };
  /** Lily pad under the frog launcher. */
  shooter: { light: string; dark: string; flower: string };
  hole: { core: string; arms: string[] };
  portal: string[];
  ui: { accent: string; accent2: string; text: string; panel: string };
  audio: { wave: OscillatorType; cutoff: number };
  drawStatic(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  drawAnimated(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
}

/** Deterministic PRNG so static backgrounds and animated layers agree. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------------------------------------------------------------- Cosmic

const cosmicStars = (() => {
  const r = mulberry(7);
  return Array.from({ length: 140 }, () => ({
    x: r(),
    y: r(),
    size: 0.6 + r() * 1.8,
    phase: r() * Math.PI * 2,
    speed: 0.6 + r() * 2.2,
    hue: r() < 0.25 ? '#9fe8ff' : r() < 0.4 ? '#ffc2f0' : '#ffffff',
  }));
})();

const cosmic: Theme = {
  id: 'cosmic',
  balls: ['#ff3d9a', '#22e4ff', '#9dff3a', '#ffcc1f', '#a35cff'],
  ballStyle: 'glossy',
  particle: 'star',
  track: {
    edge: '#b18cff',
    edgeWidth: 54,
    fill: 'rgba(14, 6, 46, 0.88)',
    fillWidth: 48,
    center: 'rgba(190, 160, 255, 0.28)',
    glow: 'rgba(160, 110, 255, 0.9)',
    glowBlur: 26,
  },
  shooter: { light: '#5fe0a8', dark: '#127a5a', flower: '#ff3d9a' },
  hole: { core: '#000000', arms: ['#ff8a3d', '#ff3d9a', '#a35cff'] },
  portal: ['#22e4ff', '#a35cff', '#ffffff'],
  ui: { accent: '#ff3d9a', accent2: '#22e4ff', text: '#f4efff', panel: 'rgba(24, 10, 60, 0.92)' },
  audio: { wave: 'sine', cutoff: 6000 },
  drawStatic(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#120540');
    g.addColorStop(0.55, '#1d0a52');
    g.addColorStop(1, '#06021c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const m = Math.max(w, h);
    ctx.globalCompositeOperation = 'lighter';
    blob(ctx, w * 0.15, h * 0.2, m * 0.45, 'rgba(255, 50, 160, 0.30)');
    blob(ctx, w * 0.9, h * 0.35, m * 0.4, 'rgba(30, 200, 255, 0.24)');
    blob(ctx, w * 0.6, h * 0.95, m * 0.5, 'rgba(140, 60, 255, 0.32)');
    blob(ctx, w * 0.35, h * 0.6, m * 0.25, 'rgba(255, 200, 60, 0.10)');
    ctx.globalCompositeOperation = 'source-over';
  },
  drawAnimated(ctx, w, h, t) {
    const unit = Math.min(w, h) / 600;
    for (const s of cosmicStars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.hue;
      const r = s.size * unit;
      ctx.fillRect(s.x * w - r / 2, s.y * h - r / 2, r, r);
      if (s.size > 2.1) {
        ctx.fillRect(s.x * w - r * 2, s.y * h - r / 6, r * 4, r / 3);
        ctx.fillRect(s.x * w - r / 6, s.y * h - r * 2, r / 3, r * 4);
      }
    }
    ctx.globalAlpha = 1;
    // Occasional shooting star.
    const cycle = (t % 7) / 7;
    if (cycle < 0.12) {
      const p = cycle / 0.12;
      const x = w * (0.1 + p * 0.7);
      const y = h * (0.05 + p * 0.3);
      const grd = ctx.createLinearGradient(x, y, x - 120 * unit, y - 50 * unit);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2 * unit;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 120 * unit, y - 50 * unit);
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- Reef

const reefBubbles = (() => {
  const r = mulberry(21);
  return Array.from({ length: 45 }, () => ({
    x: r(),
    offset: r(),
    size: 2 + r() * 7,
    speed: 0.04 + r() * 0.08,
    wobble: r() * Math.PI * 2,
  }));
})();

const reef: Theme = {
  id: 'reef',
  balls: ['#ff5a3c', '#ffd93b', '#1fe39a', '#ff4fc3', '#3d7bff'],
  ballStyle: 'pearl',
  particle: 'bubble',
  // A deep-water channel with a sandy rim: dark enough that every marble colour pops against it.
  track: {
    edge: '#f2c97d',
    edgeWidth: 60,
    fill: '#0b3048',
    fillWidth: 48,
    center: 'rgba(127, 243, 255, 0.3)',
    glow: 'rgba(0, 30, 60, 0.55)',
    glowBlur: 16,
    pebbles: ['#145a78', '#1d6f8f', '#0f4762', '#2a8aa8'],
  },
  shooter: { light: '#7be38a', dark: '#1b7a3c', flower: '#ff6fa8' },
  hole: { core: '#021a3a', arms: ['#7ff3ff', '#ffffff', '#3d7bff'] },
  portal: ['#ffd93b', '#ff5a3c', '#ffffff'],
  ui: { accent: '#ff5a3c', accent2: '#1fe39a', text: '#ffffff', panel: 'rgba(2, 60, 110, 0.92)' },
  audio: { wave: 'triangle', cutoff: 2600 },
  drawStatic(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#11d3e0');
    g.addColorStop(0.45, '#0a8fc4');
    g.addColorStop(1, '#063a7a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Seabed with colourful coral clumps.
    const r = mulberry(5);
    const bed = h * 0.93;
    ctx.fillStyle = '#e8c27a';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, bed + Math.sin(x * 0.01) * h * 0.015);
    ctx.lineTo(w, h);
    ctx.fill();
    const corals = ['#ff6fa8', '#ff8a3d', '#c45cff', '#ffd93b', '#ff4f6e'];
    const unit = Math.min(w, h) / 600;
    for (let i = 0; i < 14; i++) {
      const x = r() * w;
      const height = (30 + r() * 70) * unit;
      ctx.strokeStyle = corals[i % corals.length];
      ctx.lineCap = 'round';
      ctx.lineWidth = (5 + r() * 5) * unit;
      const branches = 3 + Math.floor(r() * 3);
      for (let b = 0; b < branches; b++) {
        const ang = -Math.PI / 2 + (r() - 0.5) * 1.3;
        ctx.beginPath();
        ctx.moveTo(x, bed + 4 * unit);
        ctx.quadraticCurveTo(
          x + Math.cos(ang) * height * 0.4,
          bed - height * 0.5,
          x + Math.cos(ang) * height,
          bed + Math.sin(ang) * height,
        );
        ctx.stroke();
      }
    }
  },
  drawAnimated(ctx, w, h, t) {
    // Swaying god-rays.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = w * (0.1 + i * 0.22) + Math.sin(t * 0.3 + i) * w * 0.04;
      const g = ctx.createLinearGradient(x, 0, x + w * 0.1, h);
      g.addColorStop(0, 'rgba(255,255,220,0.16)');
      g.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.03, 0);
      ctx.lineTo(x + w * 0.05, 0);
      ctx.lineTo(x + w * 0.2, h);
      ctx.lineTo(x + w * 0.02, h);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const unit = Math.min(w, h) / 600;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2 * unit;
    for (const b of reefBubbles) {
      const p = (b.offset + t * b.speed) % 1;
      const y = h * (1.05 - p * 1.1);
      const x = b.x * w + Math.sin(t * 1.5 + b.wobble) * 8 * unit;
      ctx.beginPath();
      ctx.arc(x, y, b.size * unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- Classic

/** Scattered meadow details, in 0..1 screen fractions so they work at any size. */
const meadow = (() => {
  const r = mulberry(33);
  return {
    tufts: Array.from({ length: 260 }, () => ({ x: r(), y: r(), s: 0.6 + r() * 0.8, shade: r() })),
    daisies: Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 0.7 + r() * 0.6, rot: r() * Math.PI })),
    clover: Array.from({ length: 30 }, () => ({ x: r(), y: r(), s: 0.8 + r() * 0.6, rot: r() * Math.PI * 2 })),
  };
})();

/** A round bush seen from above: overlapping leafy clumps with a few blossoms. */
function bush(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: () => number, blossom: string | null): void {
  ctx.fillStyle = 'rgba(20, 60, 10, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.12, y + size * 0.16, size * 1.05, size * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  const lobes = 7 + Math.floor(r() * 4);
  const layers: [string, number][] = [['#2f8a2a', 1], ['#46a83a', 0.78], ['#6cc94a', 0.5]];
  for (const [color, k] of layers) {
    ctx.fillStyle = color;
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + r() * 0.4;
      const d = size * 0.55 * k;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d - size * 0.08 * (1 - k), y + Math.sin(a) * d - size * 0.1 * (1 - k), size * 0.45 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!blossom) return;
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * size * 0.75;
    ctx.fillStyle = blossom;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, size * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

function boulder(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number): void {
  ctx.fillStyle = 'rgba(20, 50, 10, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.1, y + ry * 0.2, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.4, rx * 0.1, x, y, rx * 1.1);
  g.addColorStop(0, '#e9e6dc');
  g.addColorStop(0.6, '#b5b0a3');
  g.addColorStop(1, '#7d786c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 66, 58, 0.5)';
  ctx.lineWidth = Math.max(1, rx * 0.04);
  // A jagged crack plus a sunlit highlight.
  ctx.beginPath();
  ctx.moveTo(x + rx * 0.15, y - ry * 0.55);
  ctx.lineTo(x + rx * 0.02, y - ry * 0.2);
  ctx.lineTo(x + rx * 0.2, y + ry * 0.05);
  ctx.lineTo(x + rx * 0.08, y + ry * 0.35);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.4, y - ry * 0.45, rx * 0.22, ry * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function daisy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number): void {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * size, y + Math.sin(a) * size, size * 0.85, size * 0.42, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffc928';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

const butterflies = [
  { color: '#ffb02e', speed: 0.11, phase: 0, ax: 0.38, ay: 0.3 },
  { color: '#ff6fb5', speed: 0.08, phase: 2.1, ax: 0.42, ay: 0.36 },
  { color: '#7cc8ff', speed: 0.095, phase: 4.2, ax: 0.3, ay: 0.4 },
];

const classic: Theme = {
  id: 'classic',
  balls: ['#ff4d4d', '#ffd43b', '#4dabff', '#8ce04a', '#c77dff'],
  ballStyle: 'glossy',
  particle: 'petal',
  // A dark, worn dirt path with a sandy edge, so every marble pops against it.
  track: {
    edge: '#d9ae6c',
    edgeWidth: 58,
    fill: '#4a321b',
    fillWidth: 48,
    center: 'rgba(255, 228, 170, 0.16)',
    glow: 'rgba(40, 70, 10, 0.45)',
    glowBlur: 12,
    pebbles: ['#6b4a2a', '#7d5a36', '#35230f', '#8f6d45'],
  },
  shooter: { light: '#4cc38a', dark: '#17603a', flower: '#ff6fb5' },
  hole: { core: '#140c04', arms: ['#d9ae6c', '#8f6d45', '#fff3d1'] },
  portal: ['#ffd43b', '#8ce04a', '#ffffff'],
  ui: { accent: '#ff7a1a', accent2: '#4dd2ff', text: '#ffffff', panel: 'rgba(74, 48, 22, 0.94)' },
  audio: { wave: 'triangle', cutoff: 3800 },
  drawStatic(ctx, w, h) {
    const unit = Math.min(w, h) / 600;
    // Sunny lawn with soft light and shade patches.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#a6dc55');
    g.addColorStop(0.5, '#8fcf45');
    g.addColorStop(1, '#73bb37');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const m = Math.max(w, h);
    blob(ctx, w * 0.3, h * 0.25, m * 0.35, 'rgba(255, 255, 190, 0.22)');
    blob(ctx, w * 0.75, h * 0.7, m * 0.3, 'rgba(40, 110, 20, 0.16)');
    blob(ctx, w * 0.1, h * 0.85, m * 0.25, 'rgba(40, 110, 20, 0.12)');
    // Faint mown stripes.
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    const band = 70 * unit;
    for (let x = -m; x < m; x += band * 2) ctx.fillRect(x, -m, band, m * 2);
    ctx.restore();

    const r = mulberry(91);
    // Grass tufts and clover.
    ctx.lineCap = 'round';
    for (const t of meadow.tufts) {
      const x = t.x * w;
      const y = t.y * h;
      const s = 5 * t.s * unit;
      ctx.strokeStyle = t.shade < 0.5 ? 'rgba(40, 110, 25, 0.55)' : 'rgba(200, 240, 120, 0.55)';
      ctx.lineWidth = 1.4 * unit;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y - s);
      ctx.lineTo(x, y);
      ctx.lineTo(x + s * 0.6, y - s);
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.1, y - s * 1.2);
      ctx.stroke();
    }
    for (const c of meadow.clover) {
      ctx.fillStyle = 'rgba(60, 140, 40, 0.75)';
      for (let i = 0; i < 3; i++) {
        const a = c.rot + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(c.x * w + Math.cos(a) * 3.2 * c.s * unit, c.y * h + Math.sin(a) * 3.2 * c.s * unit, 3 * c.s * unit, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const d of meadow.daisies) daisy(ctx, d.x * w, d.y * h, 3.2 * d.s * unit, d.rot);

    // Pond in the bottom-right corner, with a stone rim and lily pads.
    const px = w - 40 * unit;
    const py = h - 30 * unit;
    ctx.fillStyle = '#a49c88';
    ctx.beginPath();
    ctx.ellipse(px, py, 150 * unit, 110 * unit, -0.3, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      boulder(ctx, px + Math.cos(a) * 140 * unit, py + Math.sin(a) * 100 * unit, (11 + r() * 6) * unit, (8 + r() * 4) * unit, r() * 3);
    }
    const water = ctx.createRadialGradient(px - 40 * unit, py - 30 * unit, 10 * unit, px, py, 140 * unit);
    water.addColorStop(0, '#9be9ff');
    water.addColorStop(1, '#2e9fd6');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(px, py, 128 * unit, 90 * unit, -0.3, 0, Math.PI * 2);
    ctx.fill();
    for (const [lx, ly, ls] of [[-80, -30, 16], [-40, -60, 12], [-95, 15, 11]]) {
      ctx.fillStyle = '#3fae4a';
      ctx.beginPath();
      ctx.moveTo(px + lx * unit, py + ly * unit);
      ctx.arc(px + lx * unit, py + ly * unit, ls * unit, 0.4, Math.PI * 2 - 0.1);
      ctx.fill();
    }

    // Boulders in the bottom-left corner.
    boulder(ctx, 30 * unit, h - 60 * unit, 70 * unit, 55 * unit, 0.3);
    boulder(ctx, 95 * unit, h - 18 * unit, 45 * unit, 32 * unit, -0.2);
    boulder(ctx, 10 * unit, h - 140 * unit, 38 * unit, 30 * unit, 0.8);

    // Bushes around the edges, some in bloom.
    const blossoms = ['#ff8fc4', '#ffffff', null, '#ffd43b'];
    const spots: [number, number, number][] = [
      [0.04, 0.12, 70], [0.24, 0.02, 48], [0.55, 0.0, 58], [0.78, 0.05, 44], [0.97, 0.18, 75],
      [0.0, 0.5, 64], [1.0, 0.55, 56], [0.35, 1.0, 60], [0.62, 0.98, 46], [0.5, 0.5, 34],
    ];
    spots.forEach(([fx, fy, s], i) => bush(ctx, fx * w, fy * h, s * unit, r, blossoms[i % blossoms.length]));
  },
  drawAnimated(ctx, w, h, t) {
    const unit = Math.min(w, h) / 600;
    // Slow cloud shadows drifting across the lawn.
    for (let i = 0; i < 3; i++) {
      const x = (((t * 0.012 + i * 0.37) % 1.4) - 0.2) * w;
      const y = h * (0.2 + i * 0.3);
      blob(ctx, x, y, 220 * unit, 'rgba(20, 60, 0, 0.07)');
    }
    // Butterflies fluttering on lazy loops.
    for (const b of butterflies) {
      const a = t * b.speed * Math.PI * 2 + b.phase;
      const x = w * (0.5 + b.ax * Math.sin(a));
      const y = h * (0.5 + b.ay * Math.sin(a * 1.7 + 1));
      const dir = Math.atan2(b.ay * 1.7 * Math.cos(a * 1.7 + 1) * h, b.ax * Math.cos(a) * w);
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 14 + b.phase));
      const s = 7 * unit;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(dir);
      ctx.fillStyle = b.color;
      for (const side of [1, -1]) {
        ctx.beginPath();
        ctx.ellipse(s * 0.2, side * s * 0.8 * flap, s * 0.9, s * 0.75 * flap, 0, 0, Math.PI * 2);
        ctx.ellipse(-s * 0.6, side * s * 0.6 * flap, s * 0.6, s * 0.5 * flap, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#3a2410';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.9, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
};

export const THEMES: Record<ThemeId, Theme> = { cosmic, reef, classic };
export const THEME_ORDER: ThemeId[] = ['cosmic', 'reef', 'classic'];
