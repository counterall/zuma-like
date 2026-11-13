# Chroma Coil

A vivid marble-shooter for desktop and mobile browsers, built with Vite and TypeScript (no framework; it's all canvas).

```bash
pnpm install
pnpm dev         # dev server (also on your LAN, so you can test on a phone)
pnpm test        # unit tests (chain logic, board layouts, theme contrast, on-screen labels, screen sizing, translations)
pnpm build       # type-check + production build into dist/
```

## Controls

|            | Desktop                                   | Mobile           |
| ---------- | ----------------------------------------- | ---------------- |
| Aim        | Move the mouse                            | Drag             |
| Shoot      | Left click                                | Release          |
| Swap balls | Right click, Space, or click the frog | Tap the frog |
| Pause      | P / Esc, or the pause button              | Pause button     |

## Layout

- `src/game/chain.ts`: chain simulation (spawning, pushing, insertion, matching, gap retraction and combos). Has no rendering, so it's unit-tested.
- `src/game/path.ts`: arc-length-parameterised track and the spiral generator.
- `src/game/level.ts`: level definition (track shape, ball count, colours, speeds) in three board layouts, picked from the screen shape when a game starts: `wide` (desktop and landscape tablets, the main target), `tall` (portrait screens) and `compact` (landscape phones). The `wide` board is 600 units tall and its width follows the screen's aspect ratio (4:3 to 2:1), so the track fills the screen and marbles render large; its marble count scales with the track length.
- `src/game/game.ts`: game state, shooter, projectiles, effects and scoring.
- `src/game/renderer.ts`, `sprites.ts`: canvas rendering with cached background, track and ball sprites.
- `src/game/labels.ts`: keeps floating text (combos, points) entirely on screen and clear of the HUD, shrinking it if needed.
- `src/game/themes.ts`: the Cosmic, Reef and Classic themes (palettes, backgrounds, track styles, particles, sound timbre). Backgrounds are drawn in code; there are no image assets. Reef and Classic draw a see-through rail (the ground shows through) and rim each marble so it stays readable; the contrast test checks marbles against the rail blended over the ground.
- `src/game/audio.ts`: synthesised sound effects (no audio files).
- `src/game/frog.ts`: the frog-on-a-lily-pad launcher.
- `src/i18n.ts`: UI text in English and Simplified Chinese. The language is picked from the browser on first visit and can be changed in Settings. Static text in `index.html` is tagged with `data-i18n` keys.
- `src/main.ts`, `src/settings.ts`: DOM UI, input and persisted settings.
- `src/viewport.ts`: the size the game fills; works around iPhone home-screen apps reporting a viewport one status bar short of the screen. It counts as a home-screen app when `navigator.standalone` is set or the `display-mode` media query isn't `browser` (apps added from a page with a manifest may open without the first). The page itself (html, body and `#app`) is sized to that, and `#app` is not `position: fixed`: with only a fixed `#app` taller than the 812 px document iOS reported, the game was cut off at 812 (#11). `src/debug.ts`: on-device diagnostics showing what the browser reports and where each tap lands. Turn it on with `?debug=viewport`, or, inside the home-screen app, by tapping the Settings title 5 times quickly (again to turn it off, or `?debug=off`); the choice is remembered on the device (`src/debugFlag.ts`).
