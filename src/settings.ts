import { THEMES, type ThemeId } from './game/themes';
import { detectLang, isLang, type Lang } from './i18n';

export interface Settings {
  theme: ThemeId;
  lang: Lang;
  sound: boolean;
  aimGuide: boolean;
  best: number;
}

const KEY = 'chroma-coil:settings';
const browserLang = (): Lang => detectLang(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);

function defaults(): Settings {
  return { theme: 'cosmic', lang: browserLang(), sound: true, aimGuide: true, best: 0 };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const base = defaults();
    if (!raw) return base;
    const parsed = { ...base, ...(JSON.parse(raw) as Partial<Settings>) };
    if (!(parsed.theme in THEMES)) parsed.theme = base.theme;
    // Settings saved before language support have no lang: follow the browser.
    if (!isLang(parsed.lang)) parsed.lang = base.lang;
    return parsed;
  } catch {
    return defaults();
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode etc.) — settings just won't persist.
  }
}
