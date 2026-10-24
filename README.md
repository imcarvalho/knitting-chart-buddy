# Knitting Chart Buddy

Reads a knitting chart from a one-page vector PDF and walks the knitter through it one stitch group
at a time. See [SPEC.md](SPEC.md).

- `extractor/`: Python (PyMuPDF). PDF in, chart JSON out (`schema/chart.schema.json`).
- `legend/shanon.json`: symbol legend and glyph templates for the Shanon Sweater.
- `web/`: React + TypeScript + Vite PWA that steps through an extracted chart.

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
pnpm sample   # regenerate public/samples/back-yoke.json from the fixture
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
