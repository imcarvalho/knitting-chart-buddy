# Knitting Chart Buddy

[![Deploy](https://github.com/imcarvalho/knitting-chart-buddy/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/imcarvalho/knitting-chart-buddy/actions/workflows/deploy.yml)

Are you like me and keep getting lost in knitting charts / can't see the tiny graphs? 

HERE'S AN APP FOR YOU! 

<img width="2224" height="1724" alt="CleanShot 2026-10-25 at 19 02 51@2x" src="https://github.com/user-attachments/assets/252c4e2d-2889-4751-990a-a5d52f4ee587" />


Reads a knitting chart from a one-page vector PDF and walks the knitter through it one stitch group
at a time. Pattern information and progress is stored locally on the browser.


See [SPEC.md](SPEC.md).

- `extractor/`: Python (PyMuPDF). PDF in, chart JSON out (`schema/chart.schema.json`).
- `legend/chart-symbols.json`: symbol legend and glyph templates for the Shanon Sweater.
- `web/`: React + TypeScript + Vite PWA that steps through a chart. It reads chart PDFs itself
  (`web/src/extractor/`, a TypeScript port of the Python extractor running on pdf.js), so the
  PDF never leaves the device.

## Pattern files are not in the repository

The chart PDFs (`fixtures/`) and the chart JSON extracted from them (`web/tests/fixtures/`) are
copyrighted pattern content and are git-ignored. Put your own copies in `fixtures/`.

The sample JSON is only used by the tests. It lives under `web/tests/`, not `web/public/`, so it
never ends up in a build, and the app has no bundled sample. The extractor tests and `pnpm sample`
need the back yoke PDF. `pnpm test` and `pnpm e2e` generate the sample JSON from it when it is
missing.

## Extract a chart

```sh
cd extractor && uv sync
uv run python -m chart_buddy.cli extract ../fixtures/Shanon_Sweater_tamanho3-back.pdf \
    --legend ../legend/chart-symbols.json --id back-yoke --title "Back yoke" --size 3 -o ../out/back.json
uv run python -m chart_buddy.cli show ../out/back.json --row 2
```

## Run the app

```sh
cd web && pnpm install
pnpm dev
```

Drop or pick a one-page chart PDF: the app reads it on the device, asks for the chart name and
size, and starts at row 1. The extracted chart and your position are saved on the device (chart in
IndexedDB, position in localStorage), so it reopens where you left off. Extracted .json files open
too. Keys: Space / → / Page Down next group,
Backspace / ← / Page Up back, ↓ / ↑ next / previous row, `g` then a number to jump, `u` undo.
Touch: tap the right / left half of the instruction card, swipe up / down for rows.

## Styles and themes

Styles are written in TypeScript with [vanilla-extract](https://vanilla-extract.style), which turns
them into a static CSS file at build time. Each component has its own `*.css.ts` file next to it.

`web/src/styles/` holds the shared parts, in three layers:

- `palettes.ts`: colour primitives, the raw colours of each palette (fairyfloss, high contrast).
- `themes.ts`: each theme maps the semantic tokens (`bg`, `surface`, `text`, `accent`, `front`,
  `back`, ...) onto colours from its palette, and sets its label and colour scheme.
- `tokens.css.ts`: the token contract. It turns every theme into CSS custom properties under
  `:root[data-theme='<name>']`. Components only use these tokens (`vars.color.*`), never palette
  colours.

`global.css.ts` has the element styles (body, buttons, focus ring) and `ui.css.ts` the shared
classes (primary button, form fields).

To add a theme:

1. Add its colours to `palettes.ts`.
2. Add an entry to `themes` in `themes.ts`, with a value for every token. TypeScript fails the build
   if one is missing.

The settings menu lists every theme in `themes`, and the app sets `<html data-theme>` to the one
chosen. Keep text at 4.5:1 contrast or more, and chart lines and controls at 3:1 or more.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds `web/` and publishes it on every push to `main` (or by hand
from the Actions tab). The app is then at `https://<user>.github.io/knitting-chart-buddy/`.

One-time setup: in the repository on GitHub, go to Settings, Pages, and set Source to
"GitHub Actions".

How it works:

- Pages serves the app from `/<repo>/`, so the workflow sets `BASE_PATH=/<repo>/` for the build.
  `vite.config.ts` uses it as Vite's `base` and as the PWA's `start_url` and `scope`. Without
  `BASE_PATH` the base is `/`, which is what `pnpm dev`, `pnpm preview` and the e2e test use.
- `pnpm build` type-checks only the shipped code (`tsconfig.app.json`), because the tests need the
  git-ignored sample and a clean checkout does not have it. `pnpm typecheck` still checks
  everything locally.
- The workflow fails if a PDF or a sample chart ends up in `dist/`.
- The app keeps working offline after the first visit. After a deploy it updates itself on the
  next load.

To try the Pages build locally:

```sh
cd web && BASE_PATH=/knitting-chart-buddy/ pnpm build && pnpm preview --base /knitting-chart-buddy/
```

## Keeping the two extractors in step

The Python extractor (`extractor/`) is the reference. The TypeScript port in `web/src/extractor/`
mirrors it file by file (`pdf_grid.py` / `grid.ts` + `page.ts`, `symbols.py` / `symbols.ts`,
`chart.py` / `chart.ts`). `web/tests/unit/extractor.test.ts` checks that both produce identical
JSON for the fixture, so change both together.

## Tests

```sh
cd extractor && uv run pytest
cd web && pnpm typecheck && pnpm test && pnpm e2e
```
