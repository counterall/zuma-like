import html from '../index.html?raw';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_ORDER } from './game/themes';
import { detectLang, LANGS, MESSAGES, setLang, t, type MessageKey } from './i18n';

afterEach(() => setLang('en'));

describe('i18n', () => {
  it('has a non-empty translation for every key in every language', () => {
    const keys = Object.keys(MESSAGES.en) as MessageKey[];
    for (const lang of LANGS) {
      expect(Object.keys(MESSAGES[lang]).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(MESSAGES[lang][key].trim(), `${lang}:${key}`).not.toBe('');
    }
  });

  it('keeps the same placeholders across languages', () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(MESSAGES.en) as MessageKey[]) {
      expect(holes(MESSAGES.zh[key]), key).toEqual(holes(MESSAGES.en[key]));
    }
  });

  it('translates every key the page and themes reference', () => {
    const used = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
    for (const id of THEME_ORDER) used.push(`theme.${id}.name`, `theme.${id}.tagline`);
    expect(used.length).toBeGreaterThan(10);
    for (const key of used) expect(MESSAGES.en, key).toHaveProperty([key]);
  });

  it('fills placeholders in the current language', () => {
    expect(t('fx.combo', { n: 3 })).toBe('COMBO ×3');
    setLang('zh');
    expect(t('fx.combo', { n: 3 })).toBe('连击 ×3');
    expect(t('result.best', { score: '1,200' })).toBe('最高分：1,200');
  });

  it('picks Chinese for any Chinese browser locale, otherwise English', () => {
    expect(detectLang(['zh-CN', 'en'])).toBe('zh');
    expect(detectLang(['zh-Hans-SG'])).toBe('zh');
    expect(detectLang(['fi-FI', 'zh-TW'])).toBe('zh');
    expect(detectLang(['en-GB', 'zh-CN'])).toBe('en');
    expect(detectLang(['fi-FI'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});
