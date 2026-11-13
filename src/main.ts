import './style.css';
import { Game, type GameState } from './game/game';
import { levelForScreen, sameBoard } from './game/level';
import { Renderer } from './game/renderer';
import { previewBackground, THEME_ORDER, THEMES, type ThemeId } from './game/themes';
import { loadSettings, saveSettings } from './settings';
import { LANG_NAMES, LANGS, setLang, t, translateDom, type Lang } from './i18n';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const $$ = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];

/** Hand-made tiles for themes whose rail isn't see-through; the rest are built from the theme (see previewBackground). */
const PREVIEW_BG: Partial<Record<ThemeId, string>> = {
  cosmic: 'radial-gradient(circle at 25% 30%, #ff32a0aa, transparent 55%), radial-gradient(circle at 80% 70%, #1ec8ff99, transparent 55%), #1a0850',
};

const settings = loadSettings();
setLang(settings.lang);
const canvas = $<HTMLCanvasElement>('#game');
const renderer = new Renderer(canvas);
const coarse = matchMedia('(pointer: coarse)').matches;

const screens = {
  title: $('#screen-title'),
  pause: $('#screen-pause'),
  result: $('#screen-result'),
  settings: $('#screen-settings'),
};
type ScreenName = keyof typeof screens | null;
let currentScreen: ScreenName = 'title';
/** Where to return to when the settings screen closes. */
let settingsReturn: ScreenName = null;

function showScreen(name: ScreenName): void {
  currentScreen = name;
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
}

const hud = $('#hud');
const scoreEl = $('#score');
const meter = $('.meter');
const meterFill = $('#meter-fill');
let shownScore = -1;

const game = new Game({
  onState(state: GameState) {
    hud.hidden = state === 'title';
    measureHud();
    if (state === 'playing') showScreen(null);
    else if (state === 'paused' && currentScreen !== 'settings') showScreen('pause');
    else if (state === 'won' || state === 'lost') setTimeout(() => showResult(state === 'won'), state === 'won' ? 1400 : 300);
  },
  onHud(score, progress, danger) {
    if (score !== shownScore) {
      shownScore = score;
      scoreEl.textContent = score.toLocaleString();
    }
    meterFill.style.width = `${Math.min(100, progress * 100).toFixed(1)}%`;
    meter.classList.toggle('danger', danger > 0);
  },
}, () => levelForScreen(window.innerWidth, window.innerHeight));

/** The last result shown, so it can be re-rendered when the language changes. */
let lastResult: { won: boolean; isBest: boolean } | null = null;

function showResult(won: boolean): void {
  const isBest = game.score > settings.best;
  if (isBest) {
    settings.best = game.score;
    saveSettings(settings);
  }
  lastResult = { won, isBest: isBest && game.score > 0 };
  renderResult();
  showScreen('result');
}

function renderResult(): void {
  if (!lastResult) return;
  $('#result-title').textContent = t(lastResult.won ? 'result.won' : 'result.lost');
  $('#result-score').textContent = game.score.toLocaleString();
  $('#result-best').textContent = lastResult.isBest ? t('result.newBest') : t('result.best', { score: settings.best.toLocaleString() });
}

// ---------------------------------------------------------------- Theme & settings

function applyTheme(id: ThemeId): void {
  const theme = THEMES[id];
  renderer.setTheme(theme);
  game.sfx.setTheme(theme);
  const root = document.documentElement.style;
  root.setProperty('--accent', theme.ui.accent);
  root.setProperty('--accent2', theme.ui.accent2);
  root.setProperty('--text', theme.ui.text);
  root.setProperty('--panel', theme.ui.panel);
  for (const card of $$('.theme-card')) card.setAttribute('aria-checked', String(card.dataset.theme === id));
}

function buildThemeCards(): void {
  const list = $('#theme-list');
  for (const id of THEME_ORDER) {
    const theme = THEMES[id];
    const card = document.createElement('button');
    card.className = 'theme-card';
    card.type = 'button';
    card.dataset.theme = id;
    card.setAttribute('role', 'radio');
    const dots = theme.balls.map((c) => `<span class="dot" style="background:radial-gradient(circle at 35% 35%, #fff8, ${c} 55%); box-shadow:0 0 8px ${c}"></span>`).join('');
    card.innerHTML = `<div class="preview" style="background:${PREVIEW_BG[id] ?? previewBackground(theme)}">${dots}</div>
      <div><div class="name" data-i18n="theme.${id}.name"></div><div class="desc" data-i18n="theme.${id}.tagline"></div></div>`;
    card.addEventListener('click', () => {
      settings.theme = id;
      saveSettings(settings);
      applyTheme(id);
    });
    list.appendChild(card);
  }
}

function applyLang(lang: Lang): void {
  setLang(lang);
  translateDom();
  for (const el of $$('.controls-hint')) el.textContent = t(coarse ? 'hint.touch' : 'hint.mouse');
  for (const btn of $$('.lang-btn')) btn.setAttribute('aria-checked', String(btn.dataset.lang === lang));
  renderResult();
  measureHud();
}

function buildLangButtons(): void {
  const list = $('#lang-list');
  for (const lang of LANGS) {
    const btn = document.createElement('button');
    btn.className = 'lang-btn';
    btn.type = 'button';
    btn.dataset.lang = lang;
    btn.lang = lang === 'zh' ? 'zh-Hans' : lang;
    btn.setAttribute('role', 'radio');
    btn.textContent = LANG_NAMES[lang];
    btn.addEventListener('click', () => {
      settings.lang = lang;
      saveSettings(settings);
      applyLang(lang);
    });
    list.appendChild(btn);
  }
}

function openSettings(): void {
  if (currentScreen === 'settings') return;
  settingsReturn = currentScreen;
  game.pause();
  showScreen('settings');
}

function closeSettings(): void {
  showScreen(settingsReturn);
  // Opened from the in-game HUD: jump straight back into play.
  if (settingsReturn === null) game.resume();
}

buildThemeCards();
buildLangButtons();
applyTheme(settings.theme);
applyLang(settings.lang);

const soundOpt = $<HTMLInputElement>('#opt-sound');
const aimOpt = $<HTMLInputElement>('#opt-aim');
soundOpt.checked = settings.sound;
aimOpt.checked = settings.aimGuide;
game.sfx.enabled = settings.sound;
renderer.showAimGuide = settings.aimGuide;
soundOpt.addEventListener('change', () => {
  settings.sound = game.sfx.enabled = soundOpt.checked;
  saveSettings(settings);
});
aimOpt.addEventListener('change', () => {
  settings.aimGuide = renderer.showAimGuide = aimOpt.checked;
  saveSettings(settings);
});


// ---------------------------------------------------------------- Buttons

const startGame = (): void => {
  game.sfx.unlock();
  game.start();
};
$('#btn-play').addEventListener('click', startGame);
for (const el of $$('[data-restart]')) el.addEventListener('click', startGame);
for (const el of $$('[data-open-settings]')) el.addEventListener('click', openSettings);
$('#btn-settings-done').addEventListener('click', closeSettings);
$('#btn-resume').addEventListener('click', () => game.resume());
$('#btn-pause').addEventListener('click', () => game.pause());

// ---------------------------------------------------------------- Input

function worldFromEvent(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return renderer.toWorld(e.clientX - rect.left, e.clientY - rect.top);
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  game.sfx.unlock();
  if (game.state !== 'playing') return;
  const p = worldFromEvent(e);
  if (e.pointerType === 'mouse') {
    if (e.button === 2 || game.isOnShooter(p.x, p.y)) {
      game.swap();
      return;
    }
    if (e.button !== 0) return;
    game.setAim(p.x, p.y);
    game.fire();
    return;
  }
  // Touch / pen: tap the launcher to swap, otherwise aim while held and fire on release.
  if (game.isOnShooter(p.x, p.y)) {
    game.swap();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  game.aiming = true;
  game.setAim(p.x, p.y);
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || game.aiming) {
    const p = worldFromEvent(e);
    game.setAim(p.x, p.y);
  }
});

const endAim = (e: PointerEvent, fire: boolean): void => {
  if (!game.aiming) return;
  game.aiming = false;
  if (fire) {
    const p = worldFromEvent(e);
    game.setAim(p.x, p.y);
    // Make sure the barrel points at the release point before firing.
    game.update(0);
    game.fire();
  }
};
canvas.addEventListener('pointerup', (e) => endAim(e, true));
canvas.addEventListener('pointercancel', (e) => endAim(e, false));

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'KeyS') {
    e.preventDefault();
    game.swap();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    if (currentScreen === 'settings') closeSettings();
    else if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
  } else if (e.code === 'Enter' && (currentScreen === 'title' || currentScreen === 'result')) {
    startGame();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});
window.addEventListener('blur', () => game.pause());

// ---------------------------------------------------------------- Layout & loop

/** Keep floating text (combos, points) clear of the HUD and of notches at the screen sides. */
function measureHud(): void {
  if (hud.hidden) return;
  const style = getComputedStyle(hud);
  const bottoms = [...hud.children].map((el) => el.getBoundingClientRect().bottom);
  renderer.labelInsets = {
    margin: 8,
    top: Math.max(0, ...bottoms) + 4,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  };
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // On the title screen, switch to the board that fits the new screen shape. Anywhere else
  // the board stays (scaled to fit): a game in progress keeps it, and after a game ends
  // resetting would wipe the score the result screen shows. "Play again" builds a fresh board.
  if (game.state === 'title' && !sameBoard(game.level, w, h)) game.reset();
  renderer.setLevel(game.level);
  renderer.resize(w, h, window.devicePixelRatio || 1);
  measureHud();
  phoneNote.hidden = Math.min(w, h) >= 600;
}
const phoneNote = $('#phone-note');
window.addEventListener('resize', resize);
resize();
// The HUD's height can change once its web font arrives.
void document.fonts?.ready.then(measureHud);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.setLevel(game.level);
  renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev-only handle for debugging from the console.
if (import.meta.env.DEV) Object.assign(window, { game, renderer });
