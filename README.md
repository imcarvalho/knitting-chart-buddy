# Knitting Chart Buddy

Reads a knitting chart from a one-page vector PDF and walks the knitter through it one stitch group
at a time. See [SPEC.md](SPEC.md).

- `extractor/`: Python (PyMuPDF). PDF in, chart JSON out (`schema/chart.schema.json`).
- `legend/shanon.json`: symbol legend and glyph templates for the Shanon Sweater.
- `web/`: React + TypeScript + Vite PWA that steps through an extracted chart.

## Pattern files are not in the repository

The chart PDFs (`fixtures/`) and the chart JSON extracted from them (`web/public/samples/`) are
copyrighted pattern content and are git-ignored. Put your own copies in `fixtures/`:

- `fixtures/Shanon_Sweater_tamanho3-back.pdf`: the back yoke chart page, size 3.
- `fixtures/legend.pdf`: the abbreviation page (only used to check glyphs by eye).

The extractor tests and `pnpm sample` need the back yoke PDF. `pnpm test` and `pnpm e2e` generate
the sample JSON from it when it is missing.

## Extract a chart

```sh
cd extractor && uv sync
uv run python -m chart_buddy.cli extract ../fixtures/Shanon_Sweater_tamanho3-back.pdf \
    --legend ../legend/shanon.json --id back-yoke --title "Back yoke" --size 3 -o ../out/back.json
uv run python -m chart_buddy.cli show ../out/back.json --row 2
```

## Run the app

```sh
cd web && pnpm install
pnpm sample   # generate public/samples/back-yoke.json from the fixture PDF
pnpm dev
```

Open a JSON file (drop or pick), or use the bundled sample. Keys: Space / → / Page Down next group,
Backspace / ← / Page Up back, ↓ / ↑ next / previous row, `g` then a number to jump, `u` undo.
Touch: tap the right / left half of the instruction card, swipe up / down for rows.

## Tests

```sh
cd extractor && uv run pytest
cd web && pnpm test && pnpm e2e
```
