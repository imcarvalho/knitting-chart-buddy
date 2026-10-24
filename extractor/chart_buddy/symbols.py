"""Symbol legend and per-cell symbol recognition."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

from .pdf_grid import MIN_GRID_LINE, ExtractionError, Grid, PageData, Segment

# Endpoint tolerance (cell units) when comparing a glyph stroke with a template stroke.
STROKE_TOL = 0.3
# Two strokes closer than this (cell units, every coordinate) are one stroke drawn twice.
DUPLICATE_TOL = 0.05
# Strokes of one glyph never get further apart than this (cell units).
JOIN_TOL = 0.15

PURL_TEXT = {"-", "–", "‒", "—", "▬"}
ARROWS = {"←": "left", "→": "right"}


@dataclass
class Template:
    strokes: list[tuple[float, float, float, float]]
    marks: list[int]


@dataclass
class Symbol:
    id: str
    name: str
    abbr: str
    kind: str  # stitch | none | ds | increase | cable
    width: int
    raw: dict
    template: Template | None = None
    verified: bool = False


@dataclass
class Legend:
    pattern: str
    symbols: dict[str, Symbol]
    sizes: dict[str, dict[str, dict[str, int]]]
    raw: dict

    @classmethod
    def load(cls, path: str | Path) -> Legend:
        raw = json.loads(Path(path).read_text())
        symbols: dict[str, Symbol] = {}
        for s in raw["symbols"]:
            t = s.get("template")
            template = None
            if t:
                template = Template([_norm(*st) for st in t["strokes"]], sorted(t.get("marks", [])))
            symbols[s["id"]] = Symbol(
                id=s["id"],
                name=s["name"],
                abbr=s.get("abbr", ""),
                kind=s["kind"],
                width=s["width"],
                raw=s,
                template=template,
                verified=bool(s.get("verified", False)),
            )
        return cls(raw.get("pattern", ""), symbols, raw.get("sizes", {}), raw)

    def glyph_symbols(self) -> list[Symbol]:
        return [s for s in self.symbols.values() if s.template is not None]


def _norm(x0: float, y0: float, x1: float, y1: float) -> tuple[float, float, float, float]:
    """Orient a stroke so that x0 <= x1."""
    return (x0, y0, x1, y1) if x0 <= x1 else (x1, y1, x0, y0)


@dataclass
class Cell:
    band: int
    idx: int
    symbol: str = "empty"
    arrow: str | None = None  # "left" / "right": short-row start marker
    cable_id: str | None = None


@dataclass
class Glyph:
    band: int
    lo: int  # first grid column index
    width: int
    strokes: list[tuple[float, float, float, float]]  # cell units, relative to lo
    marks: list[int]
    symbol: Symbol | None = None


@dataclass
class Recognition:
    cells: dict[tuple[int, int], Cell]
    glyphs: list[Glyph] = field(default_factory=list)


def recognise(data: PageData, grid: Grid, legend: Legend) -> Recognition:
    bands = [b for b in range(len(grid.ys) - 1) if b != grid.number_band]
    cols = grid.chart_cols
    cells = {(b, i): Cell(b, i) for b in bands for i in cols}
    rec = Recognition(cells)

    def where(band: int, idx: int) -> dict:
        return {"row": grid.band_rows.get(band), "col": grid.col_number(idx)}

    # Filled shapes: grey = no stitch. White = background. Anything else is unknown.
    for f in data.fills:
        r = f.rect
        if not grid.inside((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2):
            continue
        if _is_white(f.color):
            continue
        covered = [
            (b, i)
            for (b, i) in cells
            if r.x0 - 0.2 <= (grid.xs[i] + grid.xs[i + 1]) / 2 <= r.x1 + 0.2
            and r.y0 - 0.2 <= (grid.ys[b] + grid.ys[b + 1]) / 2 <= r.y1 + 0.2
        ]
        if _is_grey(f.color):
            for key in covered:
                cells[key].symbol = "none"
        elif covered:
            b, i = covered[0]
            raise ExtractionError(f"unknown filled shape with colour {f.color}", **where(b, i))

    # Text inside cells: purl dashes, DS, short-row arrows.
    for w in data.words:
        b, i = grid.band_index(w.cy), grid.col_index(w.cx)
        if b is None or i is None or (b, i) not in cells:
            continue
        cell = cells[(b, i)]
        if w.text in PURL_TEXT:
            dx = abs(w.cx - (grid.xs[i] + grid.xs[i + 1]) / 2) / grid.cell_w
            if dx > 0.35:
                raise ExtractionError(f"purl dash is off-centre ({dx:.2f} cell)", **where(b, i))
            _set(cell, "purl", where(b, i))
        elif w.text == "DS":
            _set(cell, "ds", where(b, i))
        elif w.text in ARROWS:
            cell.arrow = ARROWS[w.text]
            cell.symbol = "none"
        else:
            raise ExtractionError(f"unknown text {w.text!r} inside the chart", **where(b, i))

    # Strokes: cable and increase glyphs.
    for glyph in _collect_glyphs(data.segments, grid):
        glyph.symbol = _match(glyph, legend)
        first = where(glyph.band, glyph.lo)
        if glyph.symbol is None:
            raise ExtractionError(
                f"unknown glyph {glyph.width} cell(s) wide, strokes {_fmt(glyph.strokes)}, marks {glyph.marks}",
                **where(glyph.band, glyph.lo + glyph.width - 1 if grid.col_slope < 0 else glyph.lo),
            )
        rec.glyphs.append(glyph)
        for k in range(glyph.width):
            key = (glyph.band, glyph.lo + k)
            if key not in cells:
                raise ExtractionError("glyph runs outside the chart", **first)
            cell = cells[key]
            if cell.symbol not in ("empty",):
                raise ExtractionError(f"glyph {glyph.symbol.name!r} overlaps a {cell.symbol!r} cell", **where(*key))
            cell.symbol = glyph.symbol.id
    return rec


def _set(cell: Cell, symbol: str, where: dict) -> None:
    if cell.symbol not in ("empty",):
        raise ExtractionError(f"cell holds both {cell.symbol!r} and {symbol!r}", **where)
    cell.symbol = symbol


def _is_white(c: tuple[float, ...]) -> bool:
    return all(v > 0.95 for v in c)


def _is_grey(c: tuple[float, ...]) -> bool:
    return max(c) - min(c) < 0.05 and 0.3 < c[0] < 0.95


def _fmt(strokes: list[tuple[float, ...]]) -> str:
    return "[" + ", ".join("(" + ", ".join(f"{v:.2f}" for v in s) + ")" for s in strokes) + "]"


def _collect_glyphs(segments: list[Segment], grid: Grid) -> list[Glyph]:
    per_band: dict[int, list[tuple[float, float, float, float]]] = {}
    for s in segments:
        length = math.hypot(s.x1 - s.x0, s.y1 - s.y0)
        axis = abs(s.x0 - s.x1) < 0.01 or abs(s.y0 - s.y1) < 0.01
        if axis and length >= MIN_GRID_LINE:
            continue  # grid line drawn as a stroke
        if not (grid.inside(s.x0, s.y0) and grid.inside(s.x1, s.y1)):
            continue  # outside the chart (brackets, notes)
        band = grid.band_index((s.y0 + s.y1) / 2)
        if band is None or band == grid.number_band:
            continue
        top, h = grid.ys[band], grid.ys[band + 1] - grid.ys[band]
        fx = lambda x: (x - grid.x0) / grid.cell_w  # noqa: E731
        st = _norm(fx(s.x0), (s.y0 - top) / h, fx(s.x1), (s.y1 - top) / h)
        if min(st[1], st[3]) < -0.15 or max(st[1], st[3]) > 1.15:
            raise ExtractionError(
                "a stroke crosses a row boundary", row=grid.band_rows.get(band), col=grid.col_number(int(st[0]))
            )
        per_band.setdefault(band, []).append(st)

    glyphs: list[Glyph] = []
    for band, strokes in sorted(per_band.items()):
        strokes = _dedupe(strokes)
        for cluster in _cluster_strokes(strokes):
            lo = math.floor(min(s[0] for s in cluster) + 0.2)
            hi = math.ceil(max(s[2] for s in cluster) - 0.2)
            marks, lines = [], []
            for s in cluster:
                if abs(s[1] - s[3]) < 0.05 and s[2] - s[0] < 0.5 and s[1] > 0.6:
                    marks.append(int(math.floor((s[0] + s[2]) / 2)) - lo)
                else:
                    lines.append((s[0] - lo, s[1], s[2] - lo, s[3]))
            glyphs.append(Glyph(band, lo, max(1, hi - lo), sorted(lines), sorted(set(marks))))
    return glyphs


def _dedupe(strokes: list[tuple[float, float, float, float]]) -> list[tuple[float, float, float, float]]:
    out: list[tuple[float, float, float, float]] = []
    for s in strokes:
        if not any(all(abs(a - b) < DUPLICATE_TOL for a, b in zip(s, o)) for o in out):
            out.append(s)
    return out


def _cluster_strokes(strokes: list[tuple[float, float, float, float]]) -> list[list[tuple[float, float, float, float]]]:
    """Group strokes whose horizontal extents touch or overlap."""
    clusters: list[list] = []
    for s in sorted(strokes):
        if clusters and s[0] <= max(t[2] for t in clusters[-1]) + JOIN_TOL:
            clusters[-1].append(s)
        else:
            clusters.append([s])
    return clusters


def _match(glyph: Glyph, legend: Legend) -> Symbol | None:
    best: tuple[float, Symbol] | None = None
    for sym in legend.glyph_symbols():
        t = sym.template
        assert t is not None
        if sym.width != glyph.width or t.marks != glyph.marks or len(t.strokes) != len(glyph.strokes):
            continue
        err = _stroke_distance(glyph.strokes, t.strokes)
        if err is not None and (best is None or err < best[0]):
            best = (err, sym)
    return best[1] if best else None


def _stroke_distance(a: list[tuple[float, ...]], b: list[tuple[float, ...]]) -> float | None:
    """Total endpoint error of a one-to-one stroke matching, or None if any stroke has no partner."""
    remaining = list(b)
    total = 0.0
    for s in a:
        dists = [(max(abs(x - y) for x, y in zip(s, t)), j) for j, t in enumerate(remaining)]
        if not dists:
            return None
        d, j = min(dists)
        if d > STROKE_TOL:
            return None
        total += d
        remaining.pop(j)
    return total
