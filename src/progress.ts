import { ENDLESS_START } from './game/level';

/**
 * Which levels are open and the best scores, saved on the device. A level stays open once it has
 * been unlocked. Entries are the regular levels (0, 1, 2) and endless (ENDLESS_START); every
 * endless round counts as the endless entry.
 */
export interface Progress {
  /** How many entries are open, counting from level 1 (1 … ENDLESS_START + 1). */
  unlocked: number;
  /** Best score per level ('0', '1', '2') and for any endless round ('endless'). */
  best: Record<string, number>;
  /** Furthest endless round cleared. */
  endlessRound: number;
}

const KEY = 'chroma-coil:progress';
const MAX_UNLOCKED = ENDLESS_START + 1;

const entry = (index: number): number => Math.min(index, ENDLESS_START);
const bestKey = (index: number): string => (index >= ENDLESS_START ? 'endless' : String(index));
const count = (v: unknown, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : min;

/** `legacyBest`: the single best score saved before levels existed, which was level 1's. */
export function loadProgress(legacyBest: number): Progress {
  const fresh: Progress = { unlocked: 1, best: legacyBest > 0 ? { '0': legacyBest } : {}, endlessRound: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<Progress>;
    const best: Record<string, number> = {};
    if (saved.best && typeof saved.best === 'object') {
      for (const [k, v] of Object.entries(saved.best)) if (typeof v === 'number' && v >= 0) best[k] = v;
    }
    return { unlocked: count(saved.unlocked, 1, MAX_UNLOCKED), best, endlessRound: count(saved.endlessRound, 0, 1e6) };
  } catch {
    return fresh;
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode etc.): progress lasts for this visit only.
  }
}

export function isUnlocked(p: Progress, index: number): boolean {
  return entry(index) < p.unlocked;
}

export function bestScore(p: Progress, index: number): number {
  return p.best[bestKey(index)] ?? 0;
}

/** Record a finished game. Returns true for a new best score. Clearing a level opens the next. */
export function recordResult(p: Progress, index: number, won: boolean, score: number): boolean {
  const key = bestKey(index);
  const isBest = !(key in p.best) || score > p.best[key];
  if (isBest) p.best[key] = Math.max(score, p.best[key] ?? 0);
  if (won) {
    p.unlocked = Math.max(p.unlocked, Math.min(MAX_UNLOCKED, entry(index) + 2));
    if (index >= ENDLESS_START) p.endlessRound = Math.max(p.endlessRound, index - ENDLESS_START + 1);
  }
  return isBest && score > 0;
}
