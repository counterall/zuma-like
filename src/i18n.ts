/** UI strings in English and Simplified Chinese. */

export type Lang = 'en' | 'zh';
export const LANGS: Lang[] = ['en', 'zh'];
/** Each language's name, written in that language. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', zh: '简体中文' };
/** BCP 47 tags for <html lang>. */
const HTML_LANG: Record<Lang, string> = { en: 'en', zh: 'zh-Hans' };

const en = {
  'title.tag': 'Shoot marbles into the rolling chain. Match 3 or more of a colour to pop them before they reach the vortex!',
  'title.play': 'Play',
  'title.phoneNote': 'Best played on a tablet or desktop. Phones work too: the board reshapes itself to fit when you rotate.',
  'btn.settings': 'Settings',
  'btn.resume': 'Resume',
  'btn.restart': 'Restart',
  'btn.playAgain': 'Play again',
  'btn.done': 'Done',
  'pause.title': 'Paused',
  'result.won': 'Cleared!',
  'result.lost': 'Swallowed!',
  'result.points': 'points',
  'result.newBest': '★ New best score! ★',
  'result.best': 'Best: {score}',
  'hud.score': 'Score',
  'hud.progress': 'Level progress',
  'hud.pause': 'Pause',
  'settings.title': 'Settings',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
  'settings.sound': 'Sound effects',
  'settings.aim': 'Aim guide',
  'hint.touch': 'Drag to aim, release to shoot · Tap the frog to swap balls',
  'hint.mouse': 'Aim with the mouse · Click to shoot · Right-click, Space or click the frog to swap · P to pause',
  'theme.cosmic.name': 'Cosmic',
  'theme.cosmic.tagline': 'Nebulas, stardust & a hungry black hole',
  'theme.reef.name': 'Reef',
  'theme.reef.tagline': 'Sunlit lagoon, coral & pearly bubbles',
  'theme.classic.name': 'Classic',
  'theme.classic.tagline': 'Sunny meadow, mossy trail & daisies',
  'board.label': 'Chroma Coil game board',
  'fx.combo': 'COMBO ×{n}',
  'fx.great': 'GREAT!',
  'fx.cleared': 'CLEARED!',
};

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  'title.tag': '把弹珠射进滚动的珠链，凑齐 3 颗或以上同色弹珠即可消除，别让它们滚进漩涡！',
  'title.play': '开始游戏',
  'title.phoneNote': '在平板或电脑上体验最佳。手机也能玩：旋转屏幕时棋盘会自动适配。',
  'btn.settings': '设置',
  'btn.resume': '继续',
  'btn.restart': '重新开始',
  'btn.playAgain': '再玩一次',
  'btn.done': '完成',
  'pause.title': '已暂停',
  'result.won': '通关！',
  'result.lost': '被吞没了！',
  'result.points': '分',
  'result.newBest': '★ 新纪录！★',
  'result.best': '最高分：{score}',
  'hud.score': '得分',
  'hud.progress': '关卡进度',
  'hud.pause': '暂停',
  'settings.title': '设置',
  'settings.theme': '主题',
  'settings.language': '语言',
  'settings.sound': '音效',
  'settings.aim': '瞄准线',
  'hint.touch': '拖动瞄准，松手发射 · 点击青蛙交换弹珠',
  'hint.mouse': '鼠标瞄准 · 单击发射 · 右键、空格或点击青蛙换珠 · P 键暂停',
  'theme.cosmic.name': '星空',
  'theme.cosmic.tagline': '星云、星尘和贪吃的黑洞',
  'theme.reef.name': '珊瑚礁',
  'theme.reef.tagline': '阳光泻湖、珊瑚和珍珠泡泡',
  'theme.classic.name': '经典',
  'theme.classic.tagline': '阳光草地、青苔小径和雏菊',
  'board.label': 'Chroma Coil 游戏棋盘',
  'fx.combo': '连击 ×{n}',
  'fx.great': '太棒了！',
  'fx.cleared': '通关！',
};

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, zh };

let current: Lang = 'en';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[lang];
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as string[]).includes(value);
}

/** Best guess from the browser's preferred languages; any Chinese variant maps to zh. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'zh') return 'zh';
    if (base === 'en') return 'en';
  }
  return 'en';
}

/** Translate a key, filling `{name}` placeholders from params. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[current][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Apply translations to every element marked with data-i18n / data-i18n-aria. */
export function translateDom(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n as MessageKey);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria as MessageKey));
}
