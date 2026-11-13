/**
 * The size the game should fill.
 *
 * iOS home-screen apps (black-translucent status bar, viewport-fit=cover) sometimes report a
 * viewport one status bar shorter than the screen, which left an empty band at the bottom
 * (issue #9). When that happens we size the game to the real screen instead.
 *
 * Apps added from a page with a web manifest may open as a "web app" where navigator.standalone
 * is false, so the display-mode media query counts too (issue #11; not yet confirmed on a device).
 */

export interface ViewportInfo {
  innerWidth: number;
  innerHeight: number;
  /** iOS reports these in portrait terms whatever the orientation. */
  screenWidth: number;
  screenHeight: number;
  /** Running as an iOS home-screen app (see isIosWebApp). */
  iosStandalone: boolean;
}

/** Larger gaps are real layout changes (a keyboard, a split screen), not the status-bar bug. */
const MAX_SHORTFALL = 120;
/** The bug is seen on iPhones; iPads can have full-width windows that are shorter on purpose. */
const PHONE_MAX_SHORT_SIDE = 600;

export function screenSize(v: ViewportInfo): { width: number; height: number } {
  const width = v.innerWidth;
  let height = v.innerHeight;
  const short = Math.min(v.screenWidth, v.screenHeight);
  if (v.iosStandalone && short < PHONE_MAX_SHORT_SIDE) {
    const long = Math.max(v.screenWidth, v.screenHeight);
    const landscape = width > height;
    const fullWidth = landscape ? long : short;
    const fullHeight = landscape ? short : long;
    // Only for a full-width app on a phone; anything else may be smaller on purpose.
    const shortfall = fullHeight - height;
    if (Math.abs(width - fullWidth) <= 1 && shortfall > 0 && shortfall <= MAX_SHORTFALL) height = fullHeight;
  }
  return { width, height };
}

export interface WebAppEnv {
  userAgent: string;
  maxTouchPoints: number;
  /** navigator.standalone, the older iOS home-screen flag. */
  standalone: boolean;
  /** The matching CSS display-mode: 'browser', 'standalone', 'fullscreen' or 'minimal-ui'. */
  displayMode: string;
}

/** iPhone/iPod, or an iPad (which reports a Mac user agent but has touch). */
function isIos(env: WebAppEnv): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
}

/** Running as an app added to the iOS home screen, however iOS launched it. */
export function isIosWebApp(env: WebAppEnv): boolean {
  return isIos(env) && (env.standalone || env.displayMode !== 'browser');
}

const DISPLAY_MODES = ['fullscreen', 'standalone', 'minimal-ui'];

export function readWebAppEnv(): WebAppEnv {
  const match = (mode: string) => typeof matchMedia === 'function' && matchMedia(`(display-mode: ${mode})`).matches;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayMode: DISPLAY_MODES.find(match) ?? 'browser',
  };
}

export function readViewport(): ViewportInfo {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
    iosStandalone: isIosWebApp(readWebAppEnv()),
  };
}
