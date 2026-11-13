/**
 * On-device diagnostics for screen-size and tap problems (issues #9, #11). Turned on with
 * ?debug=viewport or by tapping the Settings title 5 times (debugFlag.ts); shows what the
 * browser reports and where each tap lands. Developer-only, so it is not translated.
 */
import { isIosWebApp, readViewport, readWebAppEnv, screenSize } from './viewport';

/** Shows the overlay; returns a function that removes it. */
export function showViewportDebug(): () => void {
  const panel = document.createElement('pre');
  panel.style.cssText =
    'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:99;margin:0;padding:8px 10px;' +
    'font:12px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.75);border-radius:8px;pointer-events:none;white-space:pre';
  document.body.appendChild(panel);
  // Reads env(safe-area-inset-*), which scripts can't query directly.
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  let lastTap = '(none yet)';

  const update = (): void => {
    const vv = window.visualViewport;
    const app = document.getElementById('app')!.getBoundingClientRect();
    const env = readWebAppEnv();
    const fit = screenSize(readViewport());
    const pad = getComputedStyle(probe);
    const inset = [pad.paddingTop, pad.paddingRight, pad.paddingBottom, pad.paddingLeft].map((v) => Math.round(parseFloat(v))).join(' ');
    panel.textContent = [
      `inner        ${innerWidth} x ${innerHeight}`,
      `visualVP     ${vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)} @ ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)} x${vv.scale.toFixed(2)}` : 'n/a'}`,
      `docElement   ${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`,
      `page         html ${Math.round(document.documentElement.getBoundingClientRect().height)}  body ${Math.round(document.body.getBoundingClientRect().height)}  scrollH ${document.documentElement.scrollHeight}`,
      `screen       ${screen.width} x ${screen.height}  dpr ${devicePixelRatio}`,
      `#app         ${Math.round(app.width)} x ${Math.round(app.height)} @ ${Math.round(app.left)},${Math.round(app.top)}`,
      `game size    ${fit.width} x ${fit.height}`,
      `safe area    ${inset} (t r b l)`,
      `scroll       ${scrollX},${scrollY}`,
      `standalone   ${env.standalone}  display ${env.displayMode}`,
      `iOS app      ${isIosWebApp(env)}`,
      `last tap     ${lastTap}`,
    ].join('\n');
  };

  const onTap = (e: PointerEvent): void => {
    const el = e.target as HTMLElement;
    const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 16)}"`;
    lastTap = `${Math.round(e.clientX)},${Math.round(e.clientY)} -> ${name}`;
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;left:${e.clientX - 6}px;top:${e.clientY - 6}px;width:12px;height:12px;border-radius:50%;background:#ff2d55;z-index:99;pointer-events:none`;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 1500);
    update();
  };
  const vv = window.visualViewport;
  window.addEventListener('pointerdown', onTap, true);
  window.addEventListener('resize', update);
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  const timer = setInterval(update, 1000);
  update();

  return () => {
    window.removeEventListener('pointerdown', onTap, true);
    window.removeEventListener('resize', update);
    vv?.removeEventListener('resize', update);
    vv?.removeEventListener('scroll', update);
    clearInterval(timer);
    panel.remove();
    probe.remove();
  };
}
