import './style.css';
import { Game, type GameState } from './game/game';
import { createLevel, ENDLESS_START, LEVELS, levelForScreen, sameBoard, type Level } from './game/level';
import { Renderer } from './game/renderer';
import { previewBackground, THEME_ORDER, THEMES, type ThemeId } from './game/themes';
import { loadSettings, saveSettings } from './settings';
import { bestScore, isUnlocked, loadProgress, recordResult, saveProgress } from './progress';
import { LANG_NAMES, LANGS, setLang, t, translateDom, type Lang } from './i18n';
import { debugFromUrl, loadDebug, saveDebug, tapCounter } from './debugFlag';
import { isIosWebApp, readViewport, readWebAppEnv, screenSize, sizePage } from './viewport';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const $$ = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];

/** Hand-made tiles for themes whose rail isn't see-through; the rest are built from the theme (see previewBackground). */
const PREVIEW_BG: Partial<Record<ThemeId, string>> = {
  cosmic: 'radial-gradient(circle at 25% 30%, #ff32a0aa, transparent 55%), radial-gradient(circle at 80% 70%, #1ec8ff99, transparent 55%), #1a0850',
};

const settings = loadSettings();
const progress = loadProgress(settings.best);
/** The level being played (or shown behind the menus): LEVELS index, or an endless round from ENDLESS_START. */
let levelIndex = 0;
/** Rolled each time endless mode starts, so every run gets its own order of boards. */
let endlessSeed = 0;
setLang(settings.lang);
const canvas = $<HTMLCanvasElement>('#game');
const renderer = new Renderer(canvas);
const coarse = matchMedia('(pointer: coarse)').matches;

const screens = {
  title: $('#screen-title'),
  levels: $('#screen-levels'),
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
}, () => {
  const { width, height } = screenSize(readViewport());
  return levelForScreen(width, height, levelIndex, endlessSeed);
});

/** "Level 2 · Switchback", or "Endless · Round 3". */
function levelTitle(level: Pick<Level, 'index' | 'track' | 'endlessRound'>): string {
  if (level.endlessRound) return `${t('level.endless')} · ${t('level.round', { n: level.endlessRound })}`;
  return `${t('level.number', { n: level.index + 1 })} · ${t(`level.${level.track}`)}`;
}

/** The last result shown, so it can be re-rendered when the language changes. */
let lastResult: { won: boolean; isBest: boolean } | null = null;

function showResult(won: boolean): void {
  const isBest = recordResult(progress, levelIndex, won, game.score);
  saveProgress(progress);
  lastResult = { won, isBest };
  renderResult();
  renderLevels();
  showScreen('result');
}

function renderResult(): void {
  if (!lastResult) return;
  const { won, isBest } = lastResult;
  $('#result-level').textContent = levelTitle(game.level);
  $('#result-title').textContent = t(won ? 'result.won' : 'result.lost');
  $('#result-score').textContent = game.score.toLocaleString();
  const best = bestScore(progress, levelIndex);
  $('#result-best').textContent = isBest ? t('result.newBest') : t('result.best', { score: best.toLocaleString() });
  const next = $('#btn-next');
  next.hidden = !won;
  next.textContent = t(levelIndex >= ENDLESS_START ? 'btn.nextRound' : levelIndex === ENDLESS_START - 1 ? 'btn.endless' : 'btn.nextLevel');
  const retry = $('#btn-retry');
  retry.textContent = t(won ? 'btn.playAgain' : 'btn.tryAgain');
  retry.classList.toggle('primary', !won);
  retry.classList.toggle('ghost', won);
}

// ---------------------------------------------------------------- Level select

/** A small picture of a level's track, drawn from the real path. */
function trackThumb(index: number): string {
  const level = createLevel(index, 'wide', 16 / 9);
  const pts = level.path.points.filter((_, i, all) => i % 4 === 0 || i === all.length - 1);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join('');
  const end = pts[pts.length - 1];
  return `<svg viewBox="-30 -30 ${level.width + 60} ${level.height + 60}" aria-hidden="true">
    <path d="${d}" style="fill:none;stroke:var(--accent2)" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <circle cx="${end.x}" cy="${end.y}" r="34" style="fill:var(--accent)"/>
    <circle cx="${level.shooter.x}" cy="${level.shooter.y}" r="46" fill="#3fbf4f"/></svg>`;
}

function renderLevels(): void {
  const list = $('#level-list');
  list.replaceChildren();
  const entries = [...LEVELS.map((_, i) => i), ENDLESS_START];
  for (const index of entries) {
    const endless = index === ENDLESS_START;
    const open = isUnlocked(progress, index);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.disabled = !open;
    const num = endless ? '∞' : t('level.number', { n: index + 1 });
    const name = endless ? t('level.endless') : t(`level.${LEVELS[index].track}`);
    const best = bestScore(progress, index);
    let desc = '';
    if (!open) desc = t('level.lockedHint', { n: index });
    else if (endless) desc = progress.endlessRound ? t('level.furthest', { n: progress.endlessRound }) : t('level.endlessHint');
    else if (best) desc = t('level.best', { score: best.toLocaleString() });
    const thumb = endless ? '<span class="infinity">∞</span>' : trackThumb(index);
    card.innerHTML = `<div class="thumb">${thumb}${open ? '' : '<span class="lock">🔒</span>'}</div>
      <div class="num"></div><div class="name"></div><div class="desc"></div>`;
    card.querySelector('.num')!.textContent = num;
    card.querySelector('.name')!.textContent = name;
    card.querySelector('.desc')!.textContent = desc;
    if (!open) card.setAttribute('aria-label', `${name}: ${t('level.locked')}`);
    card.addEventListener('click', () => {
      if (endless) levelIndex = -1; // a fresh endless run from the list
      startLevel(index);
    });
    list.appendChild(card);
  }
}

function openLevels(): void {
  if (game.state !== 'title') game.quit();
  renderLevels();
  showScreen('levels');
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
    // The five everyday colours; the sixth only appears in endless rounds.
    const dots = theme.balls.slice(0, 5).map((c) => `<span class="dot" style="background:radial-gradient(circle at 35% 35%, #fff8, ${c} 55%); box-shadow:0 0 8px ${c}"></span>`).join('');
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
  renderLevels();
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

function startLevel(index: number): void {
  // Entering endless mode (round 1) starts a new run with its own random order of boards.
  if (index === ENDLESS_START && levelIndex !== ENDLESS_START) endlessSeed = Math.floor(Math.random() * 2 ** 31);
  levelIndex = index;
  game.sfx.unlock();
  game.start();
  game.showIntro(levelTitle(game.level));
}
/** Play the current level (or endless round) again from the start. */
const startGame = (): void => startLevel(levelIndex);
const nextLevel = (): void => startLevel(levelIndex + 1);
for (const el of $$('[data-restart]')) el.addEventListener('click', startGame);
for (const el of $$('[data-open-levels]')) el.addEventListener('click', openLevels);
$('#btn-next').addEventListener('click', nextLevel);
$('#btn-levels-back').addEventListener('click', () => showScreen('title'));
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
    else if (currentScreen === 'levels') showScreen('title');
    else if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
  } else if (e.code === 'Enter' && e.target instanceof HTMLButtonElement) {
    // A focused button handles Enter itself (as a click); don't also run the shortcut.
  } else if (e.code === 'Enter' && currentScreen === 'title') {
    openLevels();
  } else if (e.code === 'Enter' && currentScreen === 'result') {
    if (lastResult?.won) nextLevel();
    else startGame();
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

const app = $('#app');

/** iOS can leave the page scrolled after rotation or a viewport change; then taps land offset. */
function resetScroll(): void {
  // Leave pinch-zoom panning alone (iOS allows zoom despite user-scalable=no).
  if ((window.visualViewport?.scale ?? 1) > 1.01) return;
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
}
// The page can be taller than the window iOS reports (see resize), so never let it stay scrolled.
window.addEventListener('scroll', resetScroll, { passive: true });

function resize(): void {
  const { width: w, height: h } = screenSize(readViewport());
  sizePage({ html: document.documentElement, body: document.body, app }, w, h);
  resetScroll();
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
/** Re-measure now and again shortly after: iOS reports the final size late after rotating or returning. */
let settleTimers: number[] = [];
let pendingFrame = 0;
function scheduleResize(): void {
  for (const id of settleTimers) clearTimeout(id);
  cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(resize);
  settleTimers = [250, 800].map((ms) => window.setTimeout(resize, ms));
}
window.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', scheduleResize);
window.addEventListener('pageshow', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleResize);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleResize();
});
resize();
// Viewport diagnostics: ?debug=viewport, or tap the Settings title 5 times (see debugFlag.ts).
let debugOn = false;
let hideDebug: (() => void) | null = null;
let debugModule: Promise<typeof import('./debug')> | null = null;
function setDebug(on: boolean): void {
  saveDebug(on);
  debugOn = on;
  if (!on) {
    hideDebug?.();
    hideDebug = null;
    return;
  }
  debugModule ??= import('./debug');
  void debugModule.then((m) => {
    // Still wanted once loaded, and not already showing (taps can race the import).
    if (debugOn && !hideDebug) hideDebug = m.showViewportDebug();
  });
}
const debugUrl = debugFromUrl(location.search);
if (debugUrl !== undefined) setDebug(debugUrl);
else if (loadDebug()) setDebug(true);
// Only where the URL can't be changed: in a browser tab, ?debug=viewport is enough.
if (isIosWebApp(readWebAppEnv())) {
  const debugTap = tapCounter(5, 3000);
  $('#screen-settings h2').addEventListener('pointerdown', (e) => {
    if (debugTap(e.timeStamp)) setDebug(!debugOn);
  });
}
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
