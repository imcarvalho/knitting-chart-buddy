"""Assemble recognised cells into rows, working-order groups and the output document."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from .pdf_grid import ExtractionError, Grid, PageData, detect_grid, load_page
from .symbols import Cell, Glyph, Legend, Recognition, Symbol, recognise

ACTION_WORD = {"k": "knit", "p": "purl"}


@dataclass
class Options:
    chart_id: str
    title: str
    size: int | None = None
    construction: str | None = None  # "flat" | "round" | None (infer)
    pattern: str | None = None


def extract(pdf: str | Path, legend: Legend, opts: Options) -> dict:
    data = load_page(pdf)
    grid = detect_grid(data)
    rec = recognise(data, grid, legend)
    return build_document(data, grid, rec, legend, opts)


def build_document(data: PageData, grid: Grid, rec: Recognition, legend: Legend, opts: Options) -> dict:
    ws_bands = _ws_label_bands(data, grid)
    construction = opts.construction or ("flat" if ws_bands else "round")

    glyph_at: dict[tuple[int, int], Glyph] = {}
    for g in rec.glyphs:
        for k in range(g.width):
            glyph_at[(g.band, g.lo + k)] = g

    band_of_row = {row: band for band, row in grid.band_rows.items()}
    rows_out = []
    for row_number in sorted(band_of_row):
        band = band_of_row[row_number]
        if construction == "round":
            side = "RS"
        elif ws_bands:
            side = "WS" if band in ws_bands else "RS"
        else:
            side = "WS" if row_number % 2 == 1 else "RS"
        rows_out.append(_build_row(row_number, band, side, grid, rec, glyph_at, legend))

    warnings = continuity_check(grid, rec, legend)
    size_markers = _size_markers(data, grid)
    notes = _notes(data, grid)
    edge_note = next((n for n in notes if re.search(r"does\s+not\s+show", n, re.I)), None)
    repeats = _repeats(data, grid, opts.size)

    chart: dict = {
        "id": opts.chart_id,
        "title": opts.title,
        "construction": construction,
        "columns": _numbered_columns(data, grid),
        "repeats": repeats,
        "sizeMarkers": size_markers,
        "notes": notes,
        "rows": rows_out,
        "warnings": warnings,
    }
    if edge_note:
        chart["edgeNote"] = edge_note
    if opts.size is not None:
        chart["size"] = _size_range(opts, legend, size_markers, rows_out)

    used = sorted({g.symbol.id for g in rec.glyphs if g.symbol})
    return {
        "pattern": opts.pattern or legend.pattern,
        "source": {"file": Path(data.path).name, "sha256": hashlib.sha256(Path(data.path).read_bytes()).hexdigest()},
        "symbols": {sid: _symbol_out(legend.symbols[sid]) for sid in used},
        "charts": [chart],
    }


# ---------------------------------------------------------------- rows and groups


def _build_row(
    row: int,
    band: int,
    side: str,
    grid: Grid,
    rec: Recognition,
    glyph_at: dict[tuple[int, int], Glyph],
    legend: Legend,
) -> dict:
    direction = "rtl" if side == "RS" else "ltr"
    drawn = [rec.cells[(band, i)] for i in grid.chart_cols]  # left to right

    cells_out = []
    for c in drawn:
        out: dict = {"col": grid.col_number(c.idx), "symbol": _cell_symbol(c, legend)}
        g = glyph_at.get((band, c.idx))
        if g and g.symbol and g.symbol.kind == "cable":
            out["cableId"] = _cable_id(row, g, grid)
        if c.arrow:
            out["arrow"] = c.arrow
        cells_out.append(out)

    working = drawn if direction == "ltr" else list(reversed(drawn))
    worked = [c for c in working if c.symbol != "none"]
    groups: list[dict] = []
    seen_glyphs: set[int] = set()
    prev_pos: int | None = None
    pos_of = {c.idx: n for n, c in enumerate(working)}
    for c in worked:
        gap = prev_pos is not None and pos_of[c.idx] != prev_pos + 1
        prev_pos = pos_of[c.idx]
        g = glyph_at.get((band, c.idx))
        if g is not None:
            if id(g) in seen_glyphs:
                continue
            seen_glyphs.add(id(g))
            groups.append(_glyph_group(row, side, direction, g, grid))
            continue
        sym = legend.symbols[c.symbol]
        col = grid.col_number(c.idx)
        if sym.kind == "stitch":
            action = sym.raw[side.lower()]["action"]
            last = groups[-1] if groups else None
            if last and not gap and last["kind"] == ACTION_WORD[action]:
                last["cols"].append(col)
                last["count"] += 1
            else:
                groups.append({"cols": [col], "kind": ACTION_WORD[action], "count": 1})
        elif sym.kind == "ds":
            groups.append({"cols": [col], "kind": "ds", "text": sym.raw["text"], "short": "DS"})
        else:
            raise ExtractionError(f"no rule to work symbol {sym.id!r}", row=row, col=col)
    for gr in groups:
        if gr["kind"] in ("knit", "purl"):
            gr["text"] = f"{gr['kind'].capitalize()} {gr['count']}"
            gr["short"] = f"{gr['kind'][0]}{gr['count']}"

    row_out: dict = {"number": row, "side": side, "direction": direction, "cells": cells_out, "groups": groups}
    if any(c.symbol == "none" for c in drawn) and worked:
        start_cell, end_cell = worked[0], worked[-1]
        row_out["shortRow"] = {
            "start": "right" if direction == "rtl" else "left",
            "startCol": grid.col_number(start_cell.idx),
            "turnAfterCol": grid.col_number(end_cell.idx),
        }
    return row_out


def _cell_symbol(c: Cell, legend: Legend) -> str:
    sym = legend.symbols.get(c.symbol)
    if sym is not None and sym.kind == "cable":
        return "cable"
    return c.symbol


def _cable_id(row: int, g: Glyph, grid: Grid) -> str:
    cols = [grid.col_number(g.lo + k) for k in range(g.width)]
    return f"c-{row}-{min(cols)}"


def _glyph_group(row: int, side: str, direction: str, g: Glyph, grid: Grid) -> dict:
    sym = g.symbol
    assert sym is not None
    idxs = list(range(g.lo, g.lo + g.width))
    if direction == "rtl":
        idxs.reverse()
    cols = [grid.col_number(i) for i in idxs]
    if sym.kind == "increase":
        return {"cols": cols, "kind": "increase", "symbol": sym.id, "text": sym.raw["text"], "short": sym.abbr}
    spec = sym.raw.get(side.lower())
    if not spec:
        raise ExtractionError(f"{sym.name!r} has no instruction for the {side} side in the legend", row=row, col=cols[0])
    if "text" in spec:  # written explanation from the pattern, used as is
        return {
            "cols": cols, "kind": "cable", "symbol": sym.id, "cableId": _cable_id(row, g, grid),
            "legend": sym.name, "abbr": sym.abbr, "text": spec["text"], "short": f"[{sym.abbr}: {spec['text']}]",
            "verified": sym.verified,
        }  # fmt: skip
    cn = spec["cn"]
    hold_long = "at the BACK" if cn["hold"] == "back" else "in FRONT"
    hold_short = "BACK" if cn["hold"] == "back" else "FRONT"
    steps = [f"{s['action']}{s['count']}" + (" from cn" if s.get("fromCn") else "") for s in spec["steps"]]
    words = [
        f"{ACTION_WORD[s['action']]} {s['count']}" + (" from cable needle" if s.get("fromCn") else "") for s in spec["steps"]
    ]
    n = cn["count"]
    text = f"Slip {n} st{'s' if n > 1 else ''} to cable needle, hold {hold_long}, " + ", ".join(words)
    return {
        "cols": cols,
        "kind": "cable",
        "symbol": sym.id,
        "cableId": _cable_id(row, g, grid),
        "legend": sym.name,
        "abbr": sym.abbr,
        "cn": {"count": n, "hold": cn["hold"]},
        "steps": steps,
        "text": text,
        "short": f"[{sym.abbr}: sl{n} to cn {hold_short}, {', '.join(steps)}]",
        "verified": sym.verified,
    }


def _symbol_out(sym: Symbol) -> dict:
    out = {"id": sym.id, "name": sym.name, "abbr": sym.abbr, "kind": sym.kind, "width": sym.width}
    if sym.template:
        out["strokes"] = [list(s) for s in sym.template.strokes]
        out["marks"] = sym.template.marks
    return out


# ---------------------------------------------------------------- continuity


def cable_io(sym: Symbol) -> tuple[list[str], list[str]] | None:
    """Stitch types (k/p, RS appearance) entering and leaving an RS cable, left to right as drawn."""
    spec = sym.raw.get("rs")
    if not spec or "cn" not in spec:
        return None
    w, n = sym.width, spec["cn"]["count"]
    worked = [s["action"] for s in spec["steps"] if not s.get("fromCn") for _ in range(s["count"])]
    from_cn = [s["action"] for s in spec["steps"] if s.get("fromCn") for _ in range(s["count"])]
    if len(worked) + len(from_cn) != w or len(from_cn) != n:
        raise ExtractionError(f"legend entry {sym.id!r}: steps do not add up to its width")
    # Positions counted from the right (working order on the RS).
    inp = from_cn + worked  # stitch p goes to cn for p < n, the rest are worked in order
    out = worked + from_cn  # worked stitches land first, at the right; cn stitches last, at the left
    return list(reversed(inp)), list(reversed(out))


def continuity_check(grid: Grid, rec: Recognition, legend: Legend) -> list[dict]:
    band_of_row = {row: band for band, row in grid.band_rows.items()}
    glyph_at: dict[tuple[int, int], Glyph] = {}
    for g in rec.glyphs:
        for k in range(g.width):
            glyph_at[(g.band, g.lo + k)] = g

    def appearance(row: int, idx: int, want: str) -> str | None:
        band = band_of_row.get(row)
        if band is None:
            return None
        g = glyph_at.get((band, idx))
        if g is not None:
            io = cable_io(g.symbol) if g.symbol and g.symbol.kind == "cable" else None
            if io is None:
                return None
            seq = io[1] if want == "out" else io[0]
            return seq[idx - g.lo]
        sym = rec.cells[(band, idx)].symbol
        return {"empty": "k", "purl": "p"}.get(sym)

    warnings = []
    for g in rec.glyphs:
        if not g.symbol or g.symbol.kind != "cable":
            continue
        io = cable_io(g.symbol)
        if io is None:
            continue
        inp, out = io
        row = grid.band_rows[g.band]
        below = [appearance(row - 1, g.lo + k, "out") for k in range(g.width)]
        above = [appearance(row + 1, g.lo + k, "in") for k in range(g.width)]
        bad_in = [k for k, (b, e) in enumerate(zip(below, inp)) if b is not None and b != e]
        bad_out = [k for k, (a, e) in enumerate(zip(above, out)) if a is not None and a != e]
        if not bad_in and not bad_out:
            continue
        cols = sorted(grid.col_number(g.lo + k) for k in range(g.width))
        detail = (
            f"expected below {''.join(inp)} got {_seq(below)}; expected above {''.join(out)} got {_seq(above)} "
            "(left to right)"
        )
        if bad_out:
            severity, what = "warning", "row above does not match the cable's output"
        else:
            # The cable works a stitch differently from how it was made (knits a purl or purls a knit).
            # The row above confirms the result, so this is a deliberate stitch change, not an error.
            severity, what = "info", "cable changes the type of a stitch"
        warnings.append({
            "check": "continuity",
            "severity": severity,
            "row": row,
            "cols": cols,
            "symbol": g.symbol.id,
            "message": f"{g.symbol.name} on row {row}, cols {cols[0]} to {cols[-1]}: {what}; {detail}",
        })  # fmt: skip
    return warnings


def _seq(xs: list[str | None]) -> str:
    return "".join(x or "?" for x in xs)


# ---------------------------------------------------------------- text around the chart


def _lines(data: PageData) -> list[tuple[str, float, float, float, float]]:
    """Text lines as (text, x0, y0, x1, y1)."""
    lines: dict[tuple[int, int], list] = {}
    for w in data.words:
        lines.setdefault((w.block, w.line), []).append(w)
    out = []
    for ws in lines.values():
        ws.sort(key=lambda w: w.x0)
        out.append((
            " ".join(w.text for w in ws),
            min(w.x0 for w in ws), min(w.y0 for w in ws), max(w.x1 for w in ws), max(w.y1 for w in ws),
        ))  # fmt: skip
    return out


def _ws_label_bands(data: PageData, grid: Grid) -> set[int]:
    bands = set()
    for w in data.words:
        if w.text != "WS":
            continue
        idx = grid.col_index(w.cx)
        if idx is None or idx in grid.label_cols:
            band = grid.band_index(w.cy)
            if band is not None and band != grid.number_band:
                bands.add(band)
    return bands


SIZE_EN = re.compile(r"Size\s+(\d+)\s*,?\s*(end|start|begin)", re.I)
SIZE_KO = re.compile(r"(\d+)\s*사이즈\s*(여기까지|여기부터)?")


def _size_markers(data: PageData, grid: Grid) -> list[dict]:
    markers = []
    for text, x0, y0, x1, y1 in _lines(data):
        if grid.x0 <= (x0 + x1) / 2 <= grid.x1:
            continue
        band = grid.band_index((y0 + y1) / 2)
        if band is None or band not in grid.band_rows:
            continue
        m = SIZE_EN.search(text)
        if m:
            kind = "end" if m.group(2).lower() == "end" else "start"
            markers.append({"size": int(m.group(1)), "row": grid.band_rows[band], "kind": kind, "text": text})
            continue
        m = SIZE_KO.search(text)
        if m:
            kind = "start" if m.group(2) == "여기부터" else "end"
            markers.append({"size": int(m.group(1)), "row": grid.band_rows[band], "kind": kind, "text": text})
    return sorted(markers, key=lambda m: (m["size"], m["row"]))


def _notes(data: PageData, grid: Grid) -> list[str]:
    lines = [ln for ln in _lines(data) if ln[4] < grid.y0]
    lines.sort(key=lambda ln: (ln[2], ln[1]))
    return [ln[0] for ln in lines]


REPEAT = re.compile(r"Work\s+a\s+total\s+(.+?)\s+times", re.I)


def _repeats(data: PageData, grid: Grid, size: int | None) -> list[dict]:
    """'Work a total N times' brackets under the chart. Columns come from the text's horizontal extent."""
    out = []
    mid = (grid.x0 + grid.x1) / 2
    for text, x0, y0, x1, y1 in _lines(data):
        m = REPEAT.search(text)
        if not m or y0 < grid.y1:
            continue
        counts = [int(n) for n in re.findall(r"\d+", m.group(1))]
        if not counts:
            continue
        times = counts[size - 1] if size and len(counts) >= size else counts[0]
        a, b = grid.col_index(max(x0, grid.x0)), grid.col_index(min(x1, grid.x1))
        if a is None or b is None:
            continue
        cols = sorted(grid.col_number(i) for i in range(a, b + 1) if i not in grid.label_cols)
        out.append({"fromCol": cols[0], "toCol": cols[-1], "times": times, "side": "left" if (x0 + x1) / 2 < mid else "right"})
    return out


def _numbered_columns(data: PageData, grid: Grid) -> int:
    nums = [
        int(w.text)
        for w in data.words
        if w.text.isdigit() and grid.band_index(w.cy) == grid.number_band and grid.col_index(w.cx) not in grid.label_cols
    ]
    return max(nums)


def _size_range(opts: Options, legend: Legend, markers: list[dict], rows: list[dict]) -> dict:
    cfg = legend.sizes.get(str(opts.size), {}).get(opts.chart_id, {})
    start = cfg.get("startRow")
    end = cfg.get("endRow")
    for m in markers:
        if m["size"] == opts.size:
            if m["kind"] == "end" and end is None:
                end = m["row"]
            if m["kind"] == "start" and start is None:
                start = m["row"]
    return {
        "size": opts.size,
        "startRow": start if start is not None else rows[0]["number"],
        "endRow": end if end is not None else rows[-1]["number"],
    }
