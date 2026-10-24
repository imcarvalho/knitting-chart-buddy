# Knitting Chart Buddy - Specification

A tool that reads a knitting chart from a PDF and walks the knitter through it one stitch group at a
time: the whole row on screen, the working direction, the current group highlighted, and plain
instructions for each group, including cables (how many stitches go on the cable needle, front or
back, and what to knit).

**Input contract: always a single-page PDF containing exactly one chart.** The knitter extracts the
chart page from the full pattern beforehand. The PDF does not contain the legend, the written
instructions or other charts.

The first target is a single real pattern: **Shanon Sweater by @hongttoknit**, starting with its
back yoke chart. Generalising to other designers comes later and is out of scope for v1.

## 1. Goals and non-goals

### Goals (v1)

- Extract the chart from a one-page, one-chart PDF into a structured JSON file, cell by cell, with
  the meaning of every symbol resolved.
- A web app (PWA) that loads that JSON and lets the knitter step through a chart:
  - starts at row 1 (or a chosen row), one row at a time;
  - shows the full row and an arrow with the working direction;
  - shows the current stitch group ("purl 2", "knit 2", a cable) and advances to the next group with
    the space bar;
  - highlights the current group in the row;
  - for cables, shows the block and a plain instruction: "slip X stitches to a cable needle, hold in
    FRONT/BACK, knit/purl Y, then knit/purl Z from the cable needle".
- Remember progress (chart, row, group) across reloads.

### Non-goals (v1)

- Multi-page PDFs, several charts on one page, other designers' symbol sets, raster (image)
  charts, photos of charts.
- Editing charts.
- Row counters for the written (non-charted) parts of the pattern.

## 2. Repository layout

```
knitting-chart-buddy/
  SPEC.md                  this file
  fixtures/
    Shanon_Sweater_tamanho3-back.pdf   back yoke chart, size 3, one page (see 3.1)
  legend/
    shanon.json            symbol legend for this pattern: glyph templates + meanings (see 3.3)
  extractor/               Python, PyMuPDF
    pyproject.toml
    chart_buddy/
      pdf_grid.py          grid detection from vector drawings
      symbols.py           symbol recognition and legend
      chart.py             assembling rows, directions, groups
      cli.py               `extract fixtures/Shanon_Sweater_tamanho3-back.pdf -o out/back.json`
    tests/
  web/                     React + TypeScript + Vite, PWA
    src/
    tests/
  schema/
    chart.schema.json      JSON Schema shared by extractor and web app
```

Use `uv` or plain `venv` for Python, `pnpm` for the web app. Python 3.12+, Node 22+.

## 3. Source PDF facts (verified by hand)

### 3.0 The fixture

`fixtures/Shanon_Sweater_tamanho3-back.pdf`, checked with PyMuPDF:

- 1 page, 841.9 x 510.2 pt, no rotation, no images. PDF 1.4 written by macOS Quartz PDFContext (the
  page was extracted from a larger PDF with Preview).
- Back yoke chart of the Shanon Sweater, size 3 copy: rows 1 to 79, 30 numbered columns plus the
  edge columns that the chart only partly shows.
- 2937 drawing paths:
  - 2196 stroked paths (grid lines, cable strokes, brackets);
  - 414 white filled paths (cell backgrounds; ignore as symbols);
  - 196 black filled paths (purl dashes);
  - 85 grey filled paths, fill (0.75, 0.75, 0.75) (cells with no stitch);
  - 39 translucent filled rectangles, fill (0.7, 0.58, 0.9), opacity 0.4: lilac shading over each
    even row, added for readability. **Ignore them** (filter on fill_opacity < 1);
  - 7 white filled + stroked paths (boxes around notes).
- Text (3149 words) is extractable. "DS" labels and "DS ←" arrows are text. The red size marker
  "← 3사이즈 여기까지 (Size 3, end here)" sits next to row 77 (bbox x 750.8, y 101.4). The note
  "Work to row 77, cut the yarn." and "The chart does NOT show the all sts on the needle. The rest
  of the sts are worked in double moss stitch as in pattern." are at the top left.

Other charts of the same pattern (front, body, sleeves) will come later as their own one-page
fixtures. Facts about them below are for reference.

| Original page | Content |
|---|---|
| 2 | Abbreviation legend (vector symbols + text); not part of any fixture, see 3.3 |
| 9 | Back yoke chart (this fixture) |
| 10 | Front chart, rows 1 to 91 (two shoulders, then joined) |
| 11 | Body chart rows 74 to 156, and Sleeve chart rows 1 to 12 (two charts on one page: split before use) |

### 3.1 How the charts are drawn

The charts are **vector**, not images. That is what makes v1 feasible.

- **Grid**: thin horizontal and vertical line segments. In the back yoke fixture every horizontal
  grid line spans x = 28.7 to 743.5. On the front chart the main lines span x = 54.2 to 725.9 (some rows have shorter
  segments where the shoulders are separate). On the body/sleeve page the body grid spans x = 34.0 to 705.6 and
  the sleeve grid x = 173.6 to 572.6.
- **Row numbers**: text words made only of digits, in a column to the right of the chart (the back
  yoke also has a column on the left). Their vertical centre identifies the row band.
- **"WS" labels**: text "WS" next to odd row numbers on flat charts (back yoke, front).
- **Column numbers**: digit words under the chart (back yoke: 30 at x = 293.7 down to 1 at x = 476.2,
  about 6.3 pt per column).
- **Purl dash** ("-" symbol): a small filled black rectangle centred in the cell.
- **Empty cell**: no mark.
- **Grey cell**: filled grey rectangle = no stitch (outside the current short row, or outside the
  shoulder).
- **DS**: the text "DS" inside a cell = double stitch (German short rows).
- **Short-row arrows**: text "→" or "←" next to a row marks where that short row starts.
- **Cables**: line segments that cross several cells in one row. A short double line ("=") near
  the bottom of one cell of the cable marks the purl stitch that goes behind.
- **Size markers** (right margin, Korean + English, e.g. "← 3사이즈 여기까지 (Size 3, end here)").
  The fixture is a size-3 copy with only the size 3 marker (red). Original pages have markers for
  all six sizes in black; support both.
- **Repeat brackets**: under the chart, a bracket over some columns at each edge with the text
  "Work a total 9 times" (size 3; the original says "5 (7) 8 (9) 10 (11)").
- Fonts: chart text uses MalgunGothic and Calibri; some Korean text uses a CID font that some
  renderers cannot map. Read text with PyMuPDF `page.get_text("words")`, which works.

### 3.2 Legend and meaning of each symbol

The chart PDF does not include the legend. The legend lives in the repository as
`legend/shanon.json`: for each symbol, an id, its name as printed in the pattern, its width in
cells, its glyph template (normalised segments and marks, in cell units) and its meaning on RS and
WS. Build the templates once from the glyphs as they appear in the fixture chart (every cable used
in the back yoke appears there many times) and check them against the original legend page by eye.


| Symbol | Meaning on RS | Meaning on WS |
|---|---|---|
| empty | knit | purl |
| dash | purl | knit |
| back loop cast on symbol | cast on 1 st (backward loop) | same |
| DS | work the double stitch | same |
| m1r, m1l, m1rp, m1lp | increases | same |
| cables | see 3.3 | see 3.4 |

### 3.3 Cable naming convention: IMPORTANT

This pattern uses the **Korean convention**: the name says **which stitches end up on top**, not
which way the cable leans.

- "Left front" = the stitches that were on the **left** end up in front. Working right to left on
  the RS, the first stitches you meet are the right-hand ones, and they must go **behind**.
  **Left front = cable needle held BEHIND.**
- "Right front" = **cable needle held in FRONT.**

This is the opposite of the habit many knitters have from English patterns ("LC = hold in front").
The app must state front/back explicitly every time and never rely on the cable's name.

Verified on the back yoke chart (the fixture), row 2 (RS), comparing rows 1 and 3:

| Columns | Row 1 (below) | Row 3 (above) | Cable on row 2 | Instruction |
|---|---|---|---|---|
| 9 to 11 | purl at 9, knit at 10 and 11 | knit at 9 and 10, purl at 11 | 2/1 Left front cable (purl behind st) | slip 1 (the purl) to cable needle, hold BEHIND, k2, p1 from cable needle |
| 12 to 14 | knit at 12 and 13, purl at 14 | purl at 12, knit at 13 and 14 | 1/2 Right front cable (purl behind st) | slip 2 to cable needle, hold in FRONT, p1, k2 from cable needle |

Expected instructions for every cable in the legend (derived from the convention; the two marked
"verified" were checked against the chart, the rest must be confirmed by the continuity check in
5.3 before shipping):

| Legend name | Width | Instruction (RS, right to left) |
|---|---|---|
| 1/1 Left front cable | 2 | sl1 to cn, hold behind, k1, k1 from cn |
| 1/1 Right front cable | 2 | sl1 to cn, hold in front, k1, k1 from cn |
| 2/1 Left front cable (purl behind st) | 3 | sl1 to cn, hold behind, k2, p1 from cn (**verified**) |
| 1/2 Right front cable (purl behind st) | 3 | sl2 to cn, hold in front, p1, k2 from cn (**verified**) |
| 1/2 Right front cable (knit behind st) | 3 | sl2 to cn, hold in front, k1, k2 from cn |
| 2/2 Right front cable | 4 | sl2 to cn, hold in front, k2, k2 from cn |
| 3/3 Right front cable | 6 | sl3 to cn, hold in front, k3, k3 from cn |
| 3/3 Left front cable | 6 | sl3 to cn, hold behind, k3, k3 from cn |
| 2/2 Left front cable (p2 behind sts) | 4 | sl2 to cn, hold behind, k2, p2 from cn |
| 2/2 Right front cable (p2 behind sts) | 4 | sl2 to cn, hold in front, p2, k2 from cn |

### 3.4 Cables worked on the WS (front chart only, future fixture)

The front chart has two WS cables with their own written explanation next to the chart:

- "k / pp": 2 sts in back, k1, then p2 from cable needle.
- "pp / k": 1 st in front, p2, then k1 from cable needle.

Use these texts as written. Do not apply the RS convention to them.

### 3.5 Working direction

- Whether a chart is flat or in the round is inferred: "WS" labels next to the row numbers mean
  flat. A CLI flag `--construction flat|round` overrides it.
- **Flat charts (back yoke, front)**: odd rows are WS (labelled "WS"), read **left to right**;
  even rows are RS, read **right to left**.
- **In the round (body, sleeves)**: every row is RS, read **right to left**.
- Short rows (back yoke rows 1 to about 48; front rows near the neck): a row starts at the arrow or
  DS and stops at the turn; grey cells are not worked.

### 3.6 Things the chart does not show

- The chart omits the double moss stitch edges ("The chart does NOT show all sts on the needle").
  v1 shows only charted cells and says so on screen ("plus edge stitches in moss stitch").
- Repeats: the bracketed columns at the edges repeat "9 times" for size 3. v1 shows the bracket
  and the repeat count; it does not expand the repeat into individual stitches.
- Size: v1 is configured for size 3 (start and end rows per chart in a small config file), but the
  extractor reads all size markers it finds.

## 4. Data model

`schema/chart.schema.json` (JSON Schema draft 2020-12). One PDF in, one chart out: the `charts`
array always has exactly one element (kept as an array so several extracted files can be merged
into one pattern later). Sketch:

```jsonc
{
  "pattern": "Shanon Sweater",
  "source": { "file": "Shanon_Sweater_tamanho3-back.pdf", "sha256": "..." },
  "charts": [
    {
      "id": "back-yoke",
      "title": "Back yoke",
      "construction": "flat",          // "flat" | "round"
      "columns": 30,                    // numbered columns; edge cells get negative / >N indices
      "repeats": [{ "fromCol": 31, "toCol": 32, "times": 9, "side": "left" }],
      "sizeMarkers": [{ "size": 3, "row": 77, "kind": "end" }],
      "rows": [
        {
          "number": 2,
          "side": "RS",                 // "RS" | "WS"
          "direction": "rtl",           // "rtl" | "ltr" (as worked)
          "cells": [                    // in chart order, left to right, as drawn
            { "col": 1, "symbol": "ds" },
            { "col": 2, "symbol": "empty" },
            { "col": 9, "symbol": "cable", "cableId": "c-2-9" }
          ],
          "groups": [                   // in WORKING order, see 5.4
            { "cols": [1], "kind": "ds", "text": "Work the double stitch" },
            { "cols": [2], "kind": "knit", "count": 1, "text": "Knit 1" },
            { "cols": [3, 4], "kind": "purl", "count": 2, "text": "Purl 2" },
            {
              "cols": [9, 10, 11], "kind": "cable",
              "legend": "2/1 Left front cable (purl behind st)",
              "cn": { "count": 1, "hold": "back" },
              "steps": ["k2", "p1 from cn"],
              "text": "Slip 1 st to cable needle, hold at the BACK, knit 2, purl 1 from cable needle"
            }
          ],
          "shortRow": { "start": "right", "turnAfterCol": 31 }
        }
      ]
    }
  ]
}
```

Rules:

- `cells` are always stored in drawn order (left to right). `groups` are in working order.
- Every group carries `text`, the exact sentence the UI shows. The UI never builds instructions.
- WS groups translate symbols to the action on the WS (empty = purl, dash = knit).
- Grey cells are omitted from `groups`; keep them in `cells` as `"none"`.

## 5. Extractor

Python 3.12, PyMuPDF (`pymupdf`), no OCR, no ML.

### 5.1 Grid detection

1. Open the PDF; fail with a clear message if it has more than one page.
2. Drop filled paths with fill_opacity < 1 (shading) before anything else.
3. Collect horizontal and vertical segments from `page.get_drawings()` (items `l`, and thin `re`).
4. Cluster y values of horizontal lines into row boundaries and x values of vertical lines into
   column boundaries. Exactly one grid is expected; fail if more than one grid region is found.
5. Map each row band to its row number using the row-number words (digit words in the label
   column; match by vertical centre).
6. Map each column band to its number using the column-number words under the chart. Cells
   outside the numbered range (edges, repeat columns) get indices continuing past the numbers.

### 5.2 Symbol recognition per cell

- Filled white rectangle covering the cell: background, not a symbol.
- Small filled black rectangle centred in the cell: `purl` (dash).
- Filled grey rectangle covering the cell: `none`.
- Text inside the cell: `ds`, arrows, etc.
- Line segments: collect all segments whose bbox lies within one row band. Group connected or
  overlapping segments into a cable glyph spanning N adjacent cells. Normalise the glyph to the
  cell grid (relative segment endpoints in cell units) and match against the glyph templates in
  `legend/shanon.json`. Matching: compare the set of normalised segments with a tolerance;
  the small "=" mark is part of the signature and decides which stitch is the purl.
- Ignore large translucent filled rectangles (row shading) and anything outside the grid.
- Any cell or glyph that does not match a known symbol is an error, reported with page, row and
  column. Never guess silently.

### 5.3 Validation: stitch continuity

For every cable, check the cells directly below and above it in the same columns:

- The knit/purl pattern in the row below must match the cable's input order, and the row above must
  match its output order, given the instruction in 3.3.
- Report any mismatch as a warning with page/row/columns. Use this to confirm the unverified rows of
  the table in 3.3 and to catch recognition errors.

### 5.4 Grouping

Walk the row in working direction and merge consecutive cells with the same action into one group:
"Knit 3", "Purl 2". A cable is always its own group. A DS is its own group. Increases are their own
group. Stop at the short-row turn.

### 5.5 CLI and output

```
python -m chart_buddy.cli extract fixtures/Shanon_Sweater_tamanho3-back.pdf \
    --legend legend/shanon.json --id back-yoke --title "Back yoke" --size 3 -o out/back.json
python -m chart_buddy.cli show out/back.json --row 2
```

`show` prints the row as text, for checking by eye, for example:

```
Back yoke, row 2 (RS, right to left)
DS | k1 | p2 | k2 | p2 | [2/1 LFC: sl1 to cn BACK, k2, p1 from cn] | [1/2 RFC: sl2 to cn FRONT, p1, k2 from cn] | ...
```

## 6. Web app

React + TypeScript + Vite, installable PWA, works offline once loaded. No backend: the JSON is
bundled or loaded from a file picker (drag and drop).

### 6.1 Screens

1. **Open**: drop or pick an extracted JSON file (one chart). Remember recently opened charts and
   the last position in each.
2. **Row view** (main screen):
   - Chart title, row number, side (RS/WS), and a large arrow showing direction (← or →).
   - The full row rendered as a strip of cells with the chart symbols (SVG, redrawn from the JSON,
     not a screenshot of the PDF), with column numbers. The row below and the row above are shown
     smaller and dimmed for context.
   - The current group highlighted in the strip (outline + background), first group on entering
     a row.
   - A large instruction card with the current group's `text`. For cables: the cable glyph drawn
     large, the cable needle count and FRONT/BACK in large type, and the steps as a short list.
   - A small "next" preview with the following group.
   - Edge note when the chart omits edge stitches, and the repeat count when the group is inside a
     repeat bracket.

### 6.2 Controls

| Action | Keyboard | Touch |
|---|---|---|
| Next group (at row end: next row) | Space, →, Page Down | tap right half / big Next button |
| Previous group | Backspace, ←, Page Up | tap left half / Back button |
| Next / previous row | ↓ / ↑ | swipe up / down |
| Jump to row | `g` then number | row number field |

Page Down / Page Up make Bluetooth page turners (which send those keys) work. Volume keys are not
reliably available in a browser; do not depend on them.

### 6.3 State

- Persist `{ patternHash, chartId, row, groupIndex }` in IndexedDB (or localStorage behind a
  try/catch) after every step.
- Keep a short undo history so a mistaken tap can be undone.

### 6.4 Accessibility

- Every control reachable by keyboard; visible focus.
- The instruction card is an `aria-live="polite"` region so the current group is announced.
- The highlight never relies on colour alone (outline + background + the instruction card).
- Large text option, high contrast theme, light and dark themes, respects `prefers-reduced-motion`.
- Screen wake lock while a chart is open (Wake Lock API, with a toggle).

## 7. Testing

### Extractor

- Golden tests against `fixtures/Shanon_Sweater_tamanho3-back.pdf`:
  - Back yoke row 1 (WS, left to right, starting at column 30): "Purl 2, Knit 2, ..." Note:
    on the WS an empty cell is a **purl** and a dash is a **knit**.
  - Back yoke row 2 (RS, right to left): DS at column 1, k1 (col 2), p2 (cols 3 to 4), k2 (cols 5 to
    6), p2 (cols 7 to 8), 2/1 Left front cable (purl behind) on cols 9 to 11 with cn BACK, 1/2 Right
    front cable (purl behind) on cols 12 to 14 with cn FRONT.
  - Continuity check (5.3) passes for every cable in all charts, or lists only known exceptions.
- Row count: 79 rows. Size 3 end marker detected at row 77.
- The 39 shading rectangles are ignored: the output is identical if they are removed.
- A two-page PDF is rejected with a clear error.

### Web app

- Unit tests (Vitest) for navigation and state persistence.
- Component tests (Testing Library) for the row view, including keyboard controls and the live
  region.
- One Playwright test that loads the fixture JSON and steps through back yoke row 2.

## 8. Milestones

1. **Extractor, back yoke only**: grid, symbols, rows 1 to 10 grouped, `show` output matching the
   golden tests.
2. **Extractor, other charts** (each as its own one-page fixture): front (including WS cables
   and the split shoulders), body, sleeves; continuity check; size markers and repeats.
3. **Web app MVP**: load JSON, row view, space to advance, highlight, cable card, persistence.
4. **Polish**: PWA install, wake lock, page-turner keys, accessibility pass, dark mode.
5. **Later** (not v1): configurable legend for other patterns, expanding repeats and edge stitches,
   raster charts.

## 9. Open questions

- Should edge moss stitches be generated from a rule so the row shows the true stitch count?
- Should the app also count rows of the written parts (sleeve decreases every 8 rounds, etc.)?
- Is the PDF allowed in the repository, or must each user supply their own copy?
- The body and sleeve charts share one original page; split it into two one-page PDFs (crop) before
  extraction, or allow a crop box on the CLI?
