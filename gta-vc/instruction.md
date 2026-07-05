# Running revcDOS (GTA: Vice City in the browser) on another Mac

This folder is a ready-to-run bundle. No Docker, no recompiling, no folder picking —
just start one server and open a page.

## What's in here

- `server.ts` — a small Bun static server that serves the game engine and your
  compiled game data together as one site.
- `revcdos-bin/` — the revcDOS engine (WebAssembly build), plus `auto.html` (the
  page you'll actually use) and the legacy `host.html` (manual folder-picker
  fallback, not needed for normal use).
- `vc-assets/` — your GTA: Vice City game data, already converted
  into the format revcDOS expects.

## Requirements

- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`).
- Any modern browser — Chrome, Edge, Firefox, or Safari all work equally well.
  Unlike an earlier version of this setup, nothing here relies on browser-specific
  folder-picker APIs anymore.

## Steps

1. Unzip this bundle anywhere on the other Mac.
2. Open Terminal, `cd` into the unzipped folder, and start the server:

   ```bash
   bun run server.ts
   ```

3. Open **http://localhost:8124/auto.html** in your browser.
4. That's it — the game loads and starts automatically. No "click to play" screen,
   no folder selection.

## Controls / UI

- **Fullscreen button** (top of the page): click this to go fullscreen. The game's
  own automatic fullscreen doesn't reliably fire in this hosting setup, so use this
  button instead.
- **Backtick key (`` ` ``) acts as Escape** in-game (opens the pause/menu). This is
  intentional: the real Escape key is reserved by the browser to exit fullscreen and
  can't be remapped, so backtick is used as a fullscreen-safe stand-in. Real Escape
  still exits fullscreen normally when you actually want that.
- **Export save / Import save buttons**: the game already saves automatically into
  the browser's local storage (IndexedDB) as you play, so progress persists across
  reloads on the same browser/machine without doing anything. These buttons are for
  backing up or transferring that save data:
  - **Export save** downloads a `revcdos-save-<timestamp>.json` file with your
    current save data.
  - **Import save** lets you load a previously-exported file back in — after
    importing, reload the page to see it in-game.

## Stopping the server

Press `Ctrl+C` in the Terminal window running `bun run server.ts`.

## Notes

- `vc-assets/local` is derived from your own purchased copy of
  Grand Theft Auto: Vice City — keep it private, don't redistribute it.
- Repeat page loads are fast: the compiled game data is cached by the browser
  essentially forever (it never changes once built), so only the first load pulls
  everything over the network.
- `host.html` (the old manual folder-picker page) is still present if you ever need
  it, but requires re-selecting the `vc-assets` folder each visit
  (or, in Chrome/Edge only, a one-time permission re-grant) and isn't actively
  maintained — `auto.html` is the supported path.
- If you ever need to regenerate `vc-assets` from raw game files (e.g. a
  different language version), you'll need the `revcdos` source repo
  (https://github.com/Carter54git/revcdos) and Docker — that's a separate, longer
  process not included in this bundle.
