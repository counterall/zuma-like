# Chroma Coil

An original marble shooter in the browser. Roll-in chains of marbles follow a track toward a vortex. A frog on a lily pad shoots marbles into the chain, and 3 or more of a colour pop. It has its own name, tracks and art, and must stay original: no recreation of an existing game's look, levels or assets.

- **Stack:** Vite + TypeScript, plain DOM + canvas (no framework), Vitest. Package manager is **pnpm**.
- **Live site:** https://counterall.github.io/zuma-like/, deployed by GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main` that changes more than Markdown files (`**.md` changes alone don't deploy; run the workflow by hand to force one). The deploy runs `pnpm test` and `pnpm build`.
- **Modules and levels:** README.md is the map of `src/` and the level table. Keep it up to date in the same change.

## Commands

```bash
pnpm install
pnpm dev           # dev server, also on the LAN (vite host: true) for phone testing
pnpm test          # unit tests
npx tsc --noEmit   # type-check
pnpm build         # type-check + production build into dist/ (vite base './', so the app is served at /)
```

## Product rules

- **Look:** vivid, saturated, eye-catching. Three themes: Cosmic, Reef and Classic. Any new themed visual needs a version for every theme.
- **Platforms:** desktop and tablet first, phones second but they must work. There are three board layouts, chosen by screen shape: `wide`, `compact` (landscape phones) and `tall` (portrait). Every track must fit all three.
- **iPhone home-screen app:** must keep working, including the full-screen fix in `src/viewport.ts` (`sizePage`; `#app` must not be `position: fixed`).
- **Translations:** all user-facing text must be in both English and Simplified Chinese (`src/i18n.ts`). Developer-only debug text is exempt.
- **Saved data:** settings live in `chroma-coil:settings` and level progress in `chroma-coil:progress`. Don't break saved data. Migrate old fields instead.
- **Tests guard the design**, so keep them passing rather than loosening them:
  - marble-vs-track contrast and distinct marble colours (`themes.test.ts`)
  - tracks inside the board, no overlapping coils, clear of the frog, clear of the HUD (`level.test.ts`)
  - every translation key present in both languages (`i18n.test.ts`)

## Development workflow

### General

- **Branches:** work in a git worktree under `../zuma-like-worktrees/<branch>`, made from the latest `origin/main`. Never develop in the main checkout; the user may be running a dev server there.
- **Tests first:** turn the request into tests and check that they fail before implementing.
- **Verify** with `pnpm test`, `npx tsc --noEmit` and `pnpm build`. For UI or layout changes, also run a real-browser check (see "Browser checks" below).
- **Review:** have an independent `code-reviewer` subagent review the diff. Give it the requirements and the constraints above, not your own conclusions. Fix the findings that hold up, and list declined ones in the PR.
- **Pull requests:** describe "What changed", "Behaviour choices to review" and "Testing" (what ran, which engines, what wasn't verified).
- **Never merge.** The user reviews and merges, and merging deploys.

### Tasks from GitHub issues (`/github-issues`, also run on an hourly loop)

- **Triage:** skip issues that already have an open PR. Clean up worktrees and branches whose PRs are merged, then fast-forward main. If a worktree still has uncommitted work, leave it.
- **Branch:** one worktree per issue, on branch `issue-<n>-<slug>`.
- **Shipping:** commit, push and open the PR without asking.
- **Unconfirmed fixes:** use `Closes #<n>` normally. If the fix can only be confirmed on the user's device (iOS issues), use `Refs #<n>` and let the user close the issue.

### Tasks from the chat (not from an issue)

- **Same build steps:** worktree, tests, verify, review.
- **Hand over before committing:** start a dev server from the worktree (`npx vite --port <free port>`) and give the user the local and LAN URLs. Don't commit, push or open a PR until the user has tried it and says to.
- **Ship:** on the go-ahead, commit, push and open a PR. If the branch's earlier PR has already been merged, put the follow-up on a fresh branch from `origin/main`.

### Browser checks

- **Playwright:** install `playwright-core` in a scratch directory, not in the project. Use system Chrome (`/usr/bin/google-chrome`) and the cached Firefox. Playwright's WebKit can't launch on this machine (`libavif16` is missing), so say that Safari/WebKit wasn't verified.
- **Servers:** run them on a free port in the 43xx or 51xx range. Block third-party requests and stop every server you start.
  - The production build is served at `/` by `vite preview`.
  - The dev server exposes `window.game` for driving states, such as forcing a win with `game.chain.balls = []; game.chain.remaining = 0`.
- **What to cover:** take screenshots of desktop (1280×800), portrait phone (390×844, 360×640) and landscape phone (844×390, 740×360, 667×375) in all three themes, and look at them.
- **iOS diagnostics:** add `?debug=viewport` to the URL, or inside the home-screen app tap the Settings title 5 times. This shows what the device reports. Ask the user for a screenshot of it rather than guessing at iOS layout bugs.

### Git

- Commit and push only when the user says to, or as part of the issue workflow above.
- End commit messages with the `Co-Authored-By` trailer for the model, and PR descriptions with the Claude Code footer.
