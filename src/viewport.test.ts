import { describe, expect, it } from 'vitest';
import { screenSize, type ViewportInfo } from './viewport';

// iPhone 16 Pro: 402×874 CSS px screen, the device in the issue screenshot.
const iphone = (over: Partial<ViewportInfo>): ViewportInfo => ({
  innerWidth: 402,
  innerHeight: 874,
  screenWidth: 402,
  screenHeight: 874,
  iosStandalone: false,
  ...over,
});

describe('screenSize (issue #9: fill the whole iPhone screen)', () => {
  it('uses the window size in a normal browser tab', () => {
    expect(screenSize(iphone({ innerHeight: 760 }))).toEqual({ width: 402, height: 760 });
    expect(screenSize({ innerWidth: 1280, innerHeight: 720, screenWidth: 1920, screenHeight: 1080, iosStandalone: false })).toEqual({ width: 1280, height: 720 });
  });

  it('covers the full screen in an iOS home-screen app that reports a status bar short (portrait)', () => {
    expect(screenSize(iphone({ innerHeight: 812, iosStandalone: true }))).toEqual({ width: 402, height: 874 });
  });

  it('does the same in landscape (iOS keeps screen.width/height in portrait terms)', () => {
    expect(screenSize(iphone({ innerWidth: 874, innerHeight: 340, iosStandalone: true }))).toEqual({ width: 874, height: 402 });
  });

  it('keeps the reported size when it already fills the screen', () => {
    expect(screenSize(iphone({ iosStandalone: true }))).toEqual({ width: 402, height: 874 });
  });

  it('leaves windowed apps alone (iPad Split View / Stage Manager), where the window is smaller on purpose', () => {
    const ipad = { screenWidth: 1024, screenHeight: 1366, iosStandalone: true };
    expect(screenSize({ ...ipad, innerWidth: 507, innerHeight: 1366 })).toEqual({ width: 507, height: 1366 });
    expect(screenSize({ ...ipad, innerWidth: 900, innerHeight: 700 })).toEqual({ width: 900, height: 700 });
  });

  it('leaves a full-width but shorter iPad window alone (Stage Manager / windowed apps)', () => {
    expect(screenSize({ innerWidth: 1366, innerHeight: 924, screenWidth: 1024, screenHeight: 1366, iosStandalone: true })).toEqual({ width: 1366, height: 924 });
  });

  it('corrects up to 120px short, and no more', () => {
    expect(screenSize(iphone({ innerHeight: 874 - 120, iosStandalone: true })).height).toBe(874);
    expect(screenSize(iphone({ innerHeight: 874 - 121, iosStandalone: true })).height).toBe(874 - 121);
  });

  it('tolerates a 1px rounding difference in width, but not more', () => {
    expect(screenSize(iphone({ innerWidth: 401, innerHeight: 812, iosStandalone: true })).height).toBe(874);
    expect(screenSize(iphone({ innerWidth: 400, innerHeight: 812, iosStandalone: true })).height).toBe(812);
  });

  it('ignores a big shortfall, which is a real layout change (e.g. keyboard), not the status-bar bug', () => {
    expect(screenSize(iphone({ innerHeight: 500, iosStandalone: true }))).toEqual({ width: 402, height: 500 });
  });
});

