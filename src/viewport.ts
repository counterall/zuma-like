/**
 * The size the game should fill.
 *
 * iOS home-screen apps (black-translucent status bar, viewport-fit=cover) sometimes report a
 * viewport one status bar shorter than the screen, which left an empty band at the bottom
 * (issue #9). When that happens we size the game to the real screen instead.
 */

export interface ViewportInfo {
  innerWidth: number;
  innerHeight: number;
  /** iOS reports these in portrait terms whatever the orientation. */
  screenWidth: number;
  screenHeight: number;
  /** Running as an iOS home-screen app (navigator.standalone). */
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

export function readViewport(): ViewportInfo {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
    iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}
