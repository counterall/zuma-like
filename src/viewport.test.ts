import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIosWebApp, readViewport, readWebAppEnv, screenSize, type ViewportInfo, type WebAppEnv } from './viewport';

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


describe('isIosWebApp (issue #11: detect home-screen apps launched from the manifest)', () => {
  const iphoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
  const ipadUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
  const androidUa = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
  const env = (over: Partial<WebAppEnv>): WebAppEnv => ({ userAgent: iphoneUa, maxTouchPoints: 5, standalone: false, displayMode: 'browser', ...over });

  it('is true for the legacy navigator.standalone flag', () => {
    expect(isIosWebApp(env({ standalone: true }))).toBe(true);
  });

  it('is true when iOS opens the manifest web app (display-mode standalone/fullscreen) without navigator.standalone', () => {
    expect(isIosWebApp(env({ displayMode: 'standalone' }))).toBe(true);
    expect(isIosWebApp(env({ displayMode: 'fullscreen' }))).toBe(true);
    expect(isIosWebApp(env({ displayMode: 'minimal-ui' }))).toBe(true);
  });

  it('is true for iPads, which report a Mac user agent', () => {
    expect(isIosWebApp(env({ userAgent: ipadUa, displayMode: 'standalone' }))).toBe(true);
  });

  it('is false in a Safari tab', () => {
    expect(isIosWebApp(env({}))).toBe(false);
  });

  it('is false for installed apps elsewhere, where the viewport is already right (Android, desktop Mac)', () => {
    expect(isIosWebApp(env({ userAgent: androidUa, displayMode: 'standalone' }))).toBe(false);
    expect(isIosWebApp(env({ userAgent: ipadUa, maxTouchPoints: 0, displayMode: 'standalone' }))).toBe(false);
  });
});

describe('readViewport (issue #11: wiring the detection into the game size)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (mode: string, standalone?: boolean) => {
    vi.stubGlobal('window', { innerWidth: 402, innerHeight: 812 });
    vi.stubGlobal('screen', { width: 402, height: 874 });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)', maxTouchPoints: 5, standalone });
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === `(display-mode: ${mode})` }));
  };

  it('fills the screen for a manifest web app without navigator.standalone', () => {
    stub('standalone');
    expect(readWebAppEnv()).toMatchObject({ standalone: false, displayMode: 'standalone' });
    expect(screenSize(readViewport())).toEqual({ width: 402, height: 874 });
  });

  it('prefers fullscreen when several display modes match, and leaves Safari tabs alone', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5 });
    expect(readWebAppEnv().displayMode).toBe('fullscreen');
    stub('browser');
    expect(screenSize(readViewport())).toEqual({ width: 402, height: 812 });
  });
});
