export type ThemeId = 'cosmic' | 'reef';
export type BallStyle = 'glossy' | 'pearl';
export type ParticleStyle = 'star' | 'bubble';

export interface Theme {
  id: ThemeId;
  name: string;
  tagline: string;
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
  shooter: { body: [string, string]; ring: string; lights: string; barrel: string };
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
  name: 'Cosmic',
  tagline: 'Nebulas, stardust & a hungry black hole',
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
  shooter: { body: ['#e9e4ff', '#5a3dc8'], ring: '#ffcc1f', lights: '#22e4ff', barrel: '#2a1870' },
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
  name: 'Reef',
  tagline: 'Sunlit lagoon, coral & pearly bubbles',
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
  shooter: { body: ['#fff4fb', '#ff7fb4'], ring: '#ffd93b', lights: '#1fe39a', barrel: '#b8346f' },
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

export const THEMES: Record<ThemeId, Theme> = { cosmic, reef };
export const THEME_ORDER: ThemeId[] = ['cosmic', 'reef'];
