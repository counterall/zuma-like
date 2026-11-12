import { THEMES, type ThemeId } from './game/themes';

export interface Settings {
  theme: ThemeId;
  sound: boolean;
  aimGuide: boolean;
  best: number;
}

const KEY = 'chroma-coil:settings';
const DEFAULTS: Settings = { theme: 'cosmic', sound: true, aimGuide: true, best: 0 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
    if (!(parsed.theme in THEMES)) parsed.theme = DEFAULTS.theme;
    return parsed;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode etc.) — settings just won't persist.
  }
}
