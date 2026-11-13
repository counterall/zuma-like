/** Keeping floating text (combo, points, "GREAT!") entirely on screen. */

import type { BoardFit } from './level';

/** A rectangle in world units. */
export interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Screen-pixel insets the text must stay clear of: the HUD across the top, notches at the sides. */
export interface Insets {
  margin: number;
  top?: number;
  left?: number;
  right?: number;
}

/** The part of the world that is visible on a vw×vh screen, minus the insets. */
export function visibleArea(fit: BoardFit, vw: number, vh: number, insets: Insets): Area {
  const m = insets.margin;
  const toX = (px: number) => (px - fit.ox) / fit.scale;
  const toY = (py: number) => (py - fit.oy) / fit.scale;
  return {
    left: toX(Math.max(m, insets.left ?? 0)),
    right: toX(vw - Math.max(m, insets.right ?? 0)),
    top: toY(Math.max(m, insets.top ?? 0)),
    bottom: toY(vh - m),
  };
}

/**
 * Where to draw a width×height label centred near (x, y) so all of it is inside `area`,
 * and how much to shrink it (scale ≤ 1) when it is bigger than the area itself.
 */
export function fitLabel(x: number, y: number, width: number, height: number, area: Area): { x: number; y: number; scale: number } {
  const scale = Math.min(1, (area.right - area.left) / width, (area.bottom - area.top) / height);
  const hw = (width * scale) / 2;
  const hh = (height * scale) / 2;
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  return { x: clamp(x, area.left + hw, area.right - hw), y: clamp(y, area.top + hh, area.bottom - hh), scale };
}
