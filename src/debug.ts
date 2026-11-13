/**
 * On-device diagnostics for screen-size and tap problems (issue #9). Open the game with
 * ?debug=viewport to see what the browser reports and where each tap lands. Developer-only,
 * so it is not translated.
 */
export function showViewportDebug(): void {
  const panel = document.createElement('pre');
  panel.style.cssText =
    'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:99;margin:0;padding:8px 10px;' +
    'font:12px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.75);border-radius:8px;pointer-events:none;white-space:pre';
  document.body.appendChild(panel);
  let lastTap = '(none yet)';

  const update = (): void => {
    const vv = window.visualViewport;
    const app = document.getElementById('app')!.getBoundingClientRect();
    const nav = navigator as Navigator & { standalone?: boolean };
    panel.textContent = [
      `inner        ${innerWidth} x ${innerHeight}`,
      `visualVP     ${vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)} @ ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)} x${vv.scale.toFixed(2)}` : 'n/a'}`,
      `docElement   ${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`,
      `screen       ${screen.width} x ${screen.height}  dpr ${devicePixelRatio}`,
      `#app         ${Math.round(app.width)} x ${Math.round(app.height)} @ ${Math.round(app.left)},${Math.round(app.top)}`,
      `scroll       ${scrollX},${scrollY}   standalone ${nav.standalone === true}`,
      `last tap     ${lastTap}`,
    ].join('\n');
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target as HTMLElement;
      const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 16)}"`;
      lastTap = `${Math.round(e.clientX)},${Math.round(e.clientY)} -> ${name}`;
      const dot = document.createElement('div');
      dot.style.cssText = `position:fixed;left:${e.clientX - 6}px;top:${e.clientY - 6}px;width:12px;height:12px;border-radius:50%;background:#ff2d55;z-index:99;pointer-events:none`;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 1500);
      update();
    },
    true,
  );
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  setInterval(update, 1000);
  update();
}
