"""Command line: `extract` a chart PDF to JSON, `show` a row of an extracted chart."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .chart import Options, extract
from .pdf_grid import ExtractionError
from .symbols import Legend

DEFAULT_LEGEND = Path(__file__).resolve().parents[2] / "legend" / "chart-symbols.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="chart_buddy", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    ex = sub.add_parser("extract", help="extract a one-page chart PDF into JSON")
    ex.add_argument("pdf", type=Path)
    ex.add_argument("--legend", type=Path, default=DEFAULT_LEGEND)
    ex.add_argument("--id", dest="chart_id", default="chart")
    ex.add_argument("--title", default="Chart")
    ex.add_argument("--size", type=int)
    ex.add_argument("--construction", choices=["flat", "round"])
    ex.add_argument("-o", "--output", type=Path)
    ex.add_argument("--pretty", action="store_true", help="indent the JSON output")

    sh = sub.add_parser("show", help="print rows of an extracted chart as text")
    sh.add_argument("json", type=Path)
    sh.add_argument("--row", type=int, action="append", help="row number (repeatable); default all rows")
    sh.add_argument("--chart", help="chart id (default: the first chart)")

    args = parser.parse_args(argv)
    if args.command == "extract":
        return _extract(args)
    return _show(args)


def _extract(args: argparse.Namespace) -> int:
    try:
        legend = Legend.load(args.legend)
        doc = extract(args.pdf, legend, Options(args.chart_id, args.title, args.size, args.construction))
    except ExtractionError as e:
        print(f"error: {args.pdf}: {e}", file=sys.stderr)
        return 1
    text = json.dumps(doc, indent=1 if args.pretty else None, ensure_ascii=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n")
    else:
        print(text)
    chart = doc["charts"][0]
    warnings = [w for w in chart["warnings"] if w["severity"] == "warning"]
    for w in warnings:
        print(f"warning: {w['message']}", file=sys.stderr)
    infos = len(chart["warnings"]) - len(warnings)
    print(
        f"{chart['title']}: {len(chart['rows'])} rows, {sum(len(r['groups']) for r in chart['rows'])} groups, "
        f"{len(warnings)} warning(s), {infos} note(s) (stitch type changes inside cables)",
        file=sys.stderr,
    )
    return 0


def format_row(chart: dict, row: dict) -> str:
    arrow = "right to left" if row["direction"] == "rtl" else "left to right"
    head = f"{chart['title']}, row {row['number']} ({row['side']}, {arrow})"
    return head + "\n" + " | ".join(g["short"] for g in row["groups"])


def _show(args: argparse.Namespace) -> int:
    doc = json.loads(args.json.read_text())
    charts = doc["charts"]
    chart = next((c for c in charts if c["id"] == args.chart), None) if args.chart else charts[0]
    if chart is None:
        print(f"error: no chart {args.chart!r}", file=sys.stderr)
        return 1
    rows = {r["number"]: r for r in chart["rows"]}
    wanted = args.row or sorted(rows)
    for n in wanted:
        if n not in rows:
            print(f"error: no row {n}", file=sys.stderr)
            return 1
        print(format_row(chart, rows[n]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
