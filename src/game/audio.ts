import type { Theme } from './themes';

/** Tiny synthesised sound kit — no audio files needed. */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private wave: OscillatorType = 'sine';

  setTheme(theme: Theme): void {
    this.wave = theme.audio.wave;
    if (this.filter) this.filter.frequency.value = theme.audio.cutoff;
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 5000;
      this.filter.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, opts: { at?: number; vol?: number; slide?: number; wave?: OscillatorType } = {}): void {
    if (!this.enabled || !this.ctx || !this.filter) return;
    const t0 = this.ctx.currentTime + (opts.at ?? 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.wave ?? this.wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
    const vol = (opts.vol ?? 0.5) * (osc.type === 'square' || osc.type === 'sawtooth' ? 0.45 : 1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.filter);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  shoot(): void {
    this.tone(520, 0.09, { slide: 1.8, vol: 0.25 });
  }

  swap(): void {
    this.tone(700, 0.05, { vol: 0.2 });
    this.tone(900, 0.05, { at: 0.04, vol: 0.2 });
  }

  insert(): void {
    this.tone(260, 0.06, { vol: 0.25, wave: 'triangle' });
  }

  pop(combo: number, count: number): void {
    const base = 440 * Math.pow(2, Math.min(combo - 1, 8) / 6);
    const notes = Math.min(3 + (count - 3), 6);
    for (let i = 0; i < notes; i++) {
      this.tone(base * Math.pow(2, (i * 4) / 12), 0.16, { at: i * 0.045, vol: 0.35 });
    }
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, { at: i * 0.11, vol: 0.4 }));
  }

  lose(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, { at: i * 0.16, vol: 0.4, slide: 0.9 }));
  }

  warn(): void {
    this.tone(180, 0.12, { vol: 0.25, wave: 'sawtooth' });
  }
}
