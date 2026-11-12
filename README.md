# Chroma Coil

A vivid marble-shooter for desktop and mobile browsers, built with Vite and TypeScript (no framework; it's all canvas).

```bash
npm install
npm run dev      # dev server (also on your LAN, so you can test on a phone)
npm test         # chain-logic unit tests
npm run build    # type-check + production build into dist/
```

## Controls

|            | Desktop                                   | Mobile           |
| ---------- | ----------------------------------------- | ---------------- |
| Aim        | Move the mouse                            | Drag             |
| Shoot      | Left click                                | Release          |
| Swap balls | Right click, Space, or click the launcher | Tap the launcher |
| Pause      | P / Esc, or the pause button              | Pause button     |

## Layout

- `src/game/chain.ts`: chain simulation (spawning, pushing, insertion, matching, gap retraction and combos). Has no rendering, so it's unit-tested.
- `src/game/path.ts`: arc-length-parameterised track and the spiral generator.
- `src/game/level.ts`: level definition (track shape, ball count, colours, speeds).
- `src/game/game.ts`: game state, shooter, projectiles, effects and scoring.
- `src/game/renderer.ts`, `sprites.ts`: canvas rendering with cached background, track and ball sprites.
- `src/game/themes.ts`: the Cosmic, Reef and Neon themes (palettes, backgrounds, track styles, particles, sound timbre).
- `src/game/audio.ts`: synthesised sound effects (no audio files).
- `src/main.ts`, `src/settings.ts`: DOM UI, input and persisted settings.
