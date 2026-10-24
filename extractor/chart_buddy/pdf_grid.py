"""Load a one-page chart PDF and detect its cell grid.

The grid is drawn as thin filled black rectangles (or stroked lines, for other files). Row-number
columns and the column-number band sit inside the grid, so after finding the lines we work out
which grid columns are labels and which band carries the column numbers.
"""

from __future__ import annotations

import bisect
import re
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

# A grid line must be at least this long (pt). Cable purl marks are ~1.5 pt, cells ~6 pt wide.
MIN_GRID_LINE = 20.0
# Thickness (pt) under which a filled rectangle counts as a line.
MAX_LINE_THICKNESS = 1.0
# Positions closer than this (pt) are the same grid line.
CLUSTER_TOL = 0.6

DIGITS = re.compile(r"^\d+$")


class ExtractionError(Exception):
    """A problem with the input that must not be guessed around."""

    def __init__(self, message: str, *, page: int = 1, row: int | None = None, col: int | None = None):
        where = [f"page {page}"]
        if row is not None:
            where.append(f"row {row}")
        if col is not None:
            where.append(f"column {col}")
        super().__init__(f"{', '.join(where)}: {message}")


@dataclass
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    block: int
    line: int

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass
class Segment:
    """A stroked straight line, in page coordinates."""

    x0: float
    y0: float
    x1: float
    y1: float


@dataclass
class Fill:
    rect: pymupdf.Rect
    color: tuple[float, ...]


@dataclass
class PageData:
    path: Path
    width: float
    height: float
    words: list[Word]
    segments: list[Segment]
    fills: list[Fill]
    grid_rects: list[pymupdf.Rect]  # thin black filled rectangles (grid lines)


def load_page(path: str | Path) -> PageData:
    path = Path(path)
    doc = pymupdf.open(path)
    try:
        if doc.page_count != 1:
            raise ExtractionError(
                f"expected a single-page PDF with one chart, got {doc.page_count} pages. "
                "Extract the chart page first."
            )
        page = doc[0]
        segments: list[Segment] = []
        fills: list[Fill] = []
        grid_rects: list[pymupdf.Rect] = []
        for d in page.get_drawings():
            fill = d.get("fill")
            opacity = d.get("fill_opacity")
            # Translucent shading (the lilac even-row bands) is decoration: drop it first.
            if fill is not None and opacity is not None and opacity < 1:
                continue
            if "s" in d["type"]:
                for item in d["items"]:
                    if item[0] == "l":
                        a, b = item[1], item[2]
                        segments.append(Segment(a.x, a.y, b.x, b.y))
                    elif item[0] == "re":
                        r = item[1]
                        for s in _rect_edges(r):
                            segments.append(s)
            if "f" in d["type"] and fill is not None:
                rect = d["rect"]
                is_black = all(c < 0.05 for c in fill)
                thin = min(rect.width, rect.height) < MAX_LINE_THICKNESS
                if is_black and thin and max(rect.width, rect.height) >= MIN_GRID_LINE:
                    grid_rects.append(rect)
                elif d["type"] == "f":
                    fills.append(Fill(rect, tuple(fill)))
        words = [Word(w[0], w[1], w[2], w[3], w[4], w[5], w[6]) for w in page.get_text("words")]
        return PageData(path, page.rect.width, page.rect.height, words, segments, fills, grid_rects)
    finally:
        doc.close()


def _rect_edges(r: pymupdf.Rect) -> list[Segment]:
    return [
        Segment(r.x0, r.y0, r.x1, r.y0),
        Segment(r.x0, r.y1, r.x1, r.y1),
        Segment(r.x0, r.y0, r.x0, r.y1),
        Segment(r.x1, r.y0, r.x1, r.y1),
    ]


@dataclass
class Line:
    pos: float  # x for vertical, y for horizontal
    start: float
    end: float


def _grid_lines(data: PageData) -> tuple[list[Line], list[Line]]:
    horiz: list[Line] = []
    vert: list[Line] = []
    for r in data.grid_rects:
        if r.width >= r.height:
            horiz.append(Line((r.y0 + r.y1) / 2, r.x0, r.x1))
        else:
            vert.append(Line((r.x0 + r.x1) / 2, r.y0, r.y1))
    for s in data.segments:
        if abs(s.y0 - s.y1) < 0.01 and abs(s.x1 - s.x0) >= MIN_GRID_LINE:
            horiz.append(Line(s.y0, min(s.x0, s.x1), max(s.x0, s.x1)))
        elif abs(s.x0 - s.x1) < 0.01 and abs(s.y1 - s.y0) >= MIN_GRID_LINE:
            vert.append(Line(s.x0, min(s.y0, s.y1), max(s.y0, s.y1)))
    return horiz, vert


def _cluster(values: list[float], tol: float = CLUSTER_TOL) -> list[float]:
    out: list[list[float]] = []
    for v in sorted(values):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(c) / len(c) for c in out]


@dataclass
class Grid:
    xs: list[float]  # vertical line positions, ascending
    ys: list[float]  # horizontal line positions, ascending (top to bottom)
    label_cols: set[int] = field(default_factory=set)  # grid column indices holding row numbers
    number_band: int | None = None  # band index holding column numbers
    band_rows: dict[int, int] = field(default_factory=dict)  # band index -> row number
    col_slope: int = -1  # column number = col_slope * grid index + col_offset
    col_offset: int = 0

    @property
    def x0(self) -> float:
        return self.xs[0]

    @property
    def x1(self) -> float:
        return self.xs[-1]

    @property
    def y0(self) -> float:
        return self.ys[0]

    @property
    def y1(self) -> float:
        return self.ys[-1]

    @property
    def cell_w(self) -> float:
        return (self.x1 - self.x0) / (len(self.xs) - 1)

    @property
    def cell_h(self) -> float:
        return (self.y1 - self.y0) / (len(self.ys) - 1)

    def col_index(self, x: float) -> int | None:
        if x < self.x0 or x > self.x1:
            return None
        return min(bisect.bisect(self.xs, x) - 1, len(self.xs) - 2)

    def band_index(self, y: float) -> int | None:
        if y < self.y0 or y > self.y1:
            return None
        return min(bisect.bisect(self.ys, y) - 1, len(self.ys) - 2)

    def inside(self, x: float, y: float) -> bool:
        return self.x0 <= x <= self.x1 and self.y0 <= y <= self.y1

    @property
    def chart_cols(self) -> list[int]:
        return [i for i in range(len(self.xs) - 1) if i not in self.label_cols]

    def col_number(self, idx: int) -> int:
        return self.col_slope * idx + self.col_offset

    def cell_rect(self, band: int, idx: int) -> pymupdf.Rect:
        return pymupdf.Rect(self.xs[idx], self.ys[band], self.xs[idx + 1], self.ys[band + 1])


def detect_grid(data: PageData) -> Grid:
    horiz, vert = _grid_region(*_grid_lines(data))
    grid = Grid(xs=_cluster([v.pos for v in vert]), ys=_cluster([h.pos for h in horiz]))
    _check_regular(grid.xs, "column")
    _check_regular(grid.ys, "row")
    _detect_labels(data, grid)
    return grid


def _grid_region(horiz: list[Line], vert: list[Line]) -> tuple[list[Line], list[Line]]:
    """Group touching lines into regions and return the one grid.

    Small regions (boxes around notes) are ignored. Fails when there is no grid or more than one.
    """
    tol = 2.0
    regions: list[tuple[list[float], list[Line], list[Line]]] = []  # bbox, horizontals, verticals
    for ln, is_h in [(h, True) for h in horiz] + [(v, False) for v in vert]:
        box = [ln.start, ln.pos, ln.end, ln.pos] if is_h else [ln.pos, ln.start, ln.pos, ln.end]
        hs, vs = ([ln], []) if is_h else ([], [ln])
        merged = True
        while merged:
            merged = False
            for other in regions:
                b = other[0]
                if box[0] <= b[2] + tol and b[0] <= box[2] + tol and box[1] <= b[3] + tol and b[1] <= box[3] + tol:
                    box = [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
                    hs, vs = hs + other[1], vs + other[2]
                    regions.remove(other)
                    merged = True
                    break
        regions.append((box, hs, vs))
    grids = [r for r in regions if len(_cluster([h.pos for h in r[1]])) >= 3 and len(_cluster([v.pos for v in r[2]])) >= 3]
    if not grids:
        raise ExtractionError("no chart grid found (not enough grid lines; is this a vector chart?)")
    if len(grids) > 1:
        raise ExtractionError(
            f"found {len(grids)} separate grids; the input must contain exactly one chart. "
            "Crop the page to one chart first."
        )
    return grids[0][1], grids[0][2]


def _check_regular(positions: list[float], what: str) -> None:
    gaps = [b - a for a, b in zip(positions, positions[1:])]
    if not gaps:
        raise ExtractionError(f"grid has no {what}s")
    median = sorted(gaps)[len(gaps) // 2]
    bad = [g for g in gaps if abs(g - median) > 0.25 * median]
    if bad:
        raise ExtractionError(f"irregular {what} spacing in grid (median {median:.2f} pt, odd gaps {bad[:5]})")


def _detect_labels(data: PageData, grid: Grid) -> None:
    """Find the column-number band, the row-number columns, and map bands to rows."""
    digit_cells: dict[tuple[int, int], int] = {}
    for w in data.words:
        if not DIGITS.match(w.text) or not grid.inside(w.cx, w.cy):
            continue
        band, idx = grid.band_index(w.cy), grid.col_index(w.cx)
        if band is not None and idx is not None:
            digit_cells[(band, idx)] = int(w.text)

    n_bands = len(grid.ys) - 1

    # Column numbers: the band holding the most digit words.
    per_band: dict[int, int] = {}
    for band, _ in digit_cells:
        per_band[band] = per_band.get(band, 0) + 1
    if not per_band:
        raise ExtractionError("no row or column numbers found inside the grid")
    number_band = max(per_band, key=lambda b: (per_band[b], b))
    if per_band[number_band] < 3:
        raise ExtractionError("could not find the column-number band")
    grid.number_band = number_band

    # Row numbers: grid columns where most bands carry a digit word.
    per_col: dict[int, int] = {}
    for band, idx in digit_cells:
        if band != number_band:
            per_col[idx] = per_col.get(idx, 0) + 1
    grid.label_cols = {i for i, n in per_col.items() if n >= max(3, (n_bands - 1) // 2)}
    if not grid.label_cols:
        raise ExtractionError("could not find the row-number column")

    for band in range(n_bands):
        if band == number_band:
            continue
        found = {digit_cells[(band, i)] for i in grid.label_cols if (band, i) in digit_cells}
        if len(found) > 1:
            raise ExtractionError(f"row labels disagree in grid band {band}: {sorted(found)}")
        if found:
            grid.band_rows[band] = found.pop()
    missing = [b for b in range(n_bands) if b != number_band and b not in grid.band_rows]
    if missing:
        raise ExtractionError(f"grid bands {missing} have no row number")

    # Column numbers follow col = slope * idx + offset with slope = +1 or -1.
    pairs = [(idx, n) for (band, idx), n in digit_cells.items() if band == number_band and idx not in grid.label_cols]
    pairs.sort()
    slope = -1 if pairs[0][1] > pairs[-1][1] else 1
    offsets = {n - slope * idx for idx, n in pairs}
    if len(offsets) != 1:
        raise ExtractionError(f"column numbers are not one per column: {pairs}")
    grid.col_slope, grid.col_offset = slope, offsets.pop()
