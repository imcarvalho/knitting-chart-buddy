"""Golden tests against fixtures/Shanon_Sweater_tamanho3-back.pdf."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pymupdf
import pytest

from chart_buddy.chart import Options, cable_io, extract
from chart_buddy.cli import format_row, main
from chart_buddy.pdf_grid import ExtractionError, load_page
from chart_buddy.symbols import Legend

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "fixtures" / "Shanon_Sweater_tamanho3-back.pdf"
LEGEND = ROOT / "legend" / "chart-symbols.json"
SCHEMA = ROOT / "schema" / "chart.schema.json"


@pytest.fixture(scope="module")
def legend() -> Legend:
    return Legend.load(LEGEND)


@pytest.fixture(scope="module")
def doc(legend: Legend) -> dict:
    return extract(FIXTURE, legend, Options("back-yoke", "Back yoke", size=3))


@pytest.fixture(scope="module")
def chart(doc: dict) -> dict:
    return doc["charts"][0]


def row(chart: dict, n: int) -> dict:
    return next(r for r in chart["rows"] if r["number"] == n)


def test_matches_schema(doc: dict) -> None:
    jsonschema.validate(doc, json.loads(SCHEMA.read_text()))


def test_row_count_and_size_marker(chart: dict) -> None:
    assert [r["number"] for r in chart["rows"]] == list(range(1, 80))
    assert {"size": 3, "row": 77, "kind": "end"}.items() <= chart["sizeMarkers"][0].items()
    assert chart["size"] == {"size": 3, "startRow": 1, "endRow": 77}
    assert chart["columns"] == 30


def test_flat_construction_and_sides(chart: dict) -> None:
    assert chart["construction"] == "flat"
    for r in chart["rows"]:
        if r["number"] % 2:
            assert (r["side"], r["direction"]) == ("WS", "ltr")
        else:
            assert (r["side"], r["direction"]) == ("RS", "rtl")


def test_row_1_ws_left_to_right(chart: dict) -> None:
    r = row(chart, 1)
    groups = r["groups"]
    # On the WS an empty cell is a purl and a dash is a knit.
    assert [g["text"] for g in groups[:4]] == ["Purl 2", "Knit 2", "Purl 2", "Knit 3"]
    assert groups[0]["cols"] == [30, 29]
    assert r["shortRow"] == {"start": "left", "startCol": 30, "turnAfterCol": 1}


def test_row_2_rs_right_to_left(chart: dict) -> None:
    g = row(chart, 2)["groups"]
    assert (g[0]["kind"], g[0]["cols"]) == ("ds", [1])
    assert (g[1]["text"], g[1]["cols"]) == ("Knit 1", [2])
    assert (g[2]["text"], g[2]["cols"]) == ("Purl 2", [3, 4])
    assert (g[3]["text"], g[3]["cols"]) == ("Knit 2", [5, 6])
    assert (g[4]["text"], g[4]["cols"]) == ("Purl 2", [7, 8])

    lfc = g[5]
    assert lfc["legend"] == "2/1 Left front cable (purl behind st)"
    assert lfc["cols"] == [9, 10, 11]
    assert lfc["cn"] == {"count": 1, "hold": "back"}
    assert lfc["steps"] == ["k2", "p1 from cn"]
    assert lfc["text"] == "Slip 1 st to cable needle, hold at the BACK, knit 2, purl 1 from cable needle"
    assert lfc["cableId"] == "c-2-9"

    rfc = g[6]
    assert rfc["legend"] == "1/2 Right front cable (purl behind st)"
    assert rfc["cols"] == [12, 13, 14]
    assert rfc["cn"] == {"count": 2, "hold": "front"}
    assert rfc["steps"] == ["p1", "k2 from cn"]


def test_show_output(chart: dict) -> None:
    text = format_row(chart, row(chart, 2))
    assert text.startswith(
        "Back yoke, row 2 (RS, right to left)\n"
        "DS | k1 | p2 | k2 | p2 | [2/1 LFC: sl1 to cn BACK, k2, p1 from cn] | "
        "[1/2 RFC: sl2 to cn FRONT, p1, k2 from cn] | "
    )


def test_cells_drawn_order_and_grey_cells(chart: dict) -> None:
    r = row(chart, 2)
    cols = [c["col"] for c in r["cells"]]
    assert cols == sorted(cols, reverse=True)  # left to right = high to low column numbers
    assert len(cols) == 112
    worked = {c for g in r["groups"] for c in g["cols"]}
    for c in r["cells"]:
        if c["symbol"] == "none":
            assert c["col"] not in worked


def test_short_row_arrows(chart: dict) -> None:
    arrows = {c["col"]: c["arrow"] for c in row(chart, 1)["cells"] if "arrow" in c}
    assert arrows == {31: "right"}
    assert row(chart, 3)["groups"][0]["kind"] == "ds"
    assert row(chart, 79).get("shortRow") is None


def test_continuity_has_no_real_mismatches(chart: dict) -> None:
    real = [w for w in chart["warnings"] if w["severity"] == "warning"]
    assert real == []
    # The known exceptions are cables that change a stitch's type: only the row below differs.
    assert {w["symbol"] for w in chart["warnings"]} <= {"rfc-1-2-p", "rfc-1-2-k"}


def test_all_cable_types_recognised(chart: dict) -> None:
    used = {g["symbol"] for r in chart["rows"] for g in r["groups"] if g["kind"] == "cable"}
    assert used == {"lfc-1-1", "rfc-1-1", "lfc-2-1-p", "rfc-1-2-p", "rfc-1-2-k", "rfc-2-2", "lfc-3-3", "rfc-3-3"}


def test_cable_io(legend: Legend) -> None:
    # 2/1 LFC purl behind: below p at the right (col 9), above p at the left (col 11).
    assert cable_io(legend.symbols["lfc-2-1-p"]) == (["k", "k", "p"], ["p", "k", "k"])
    assert cable_io(legend.symbols["rfc-1-2-p"]) == (["p", "k", "k"], ["k", "k", "p"])


def test_shading_does_not_matter(tmp_path: Path, legend: Legend, chart: dict) -> None:
    """Extra translucent shading over every row leaves the output unchanged."""
    data = load_page(FIXTURE)
    assert not any(f.color == (0.7, 0.58, 0.9) for f in data.fills)
    doc = pymupdf.open(FIXTURE)
    page = doc[0]
    for y in range(95, 460, 9):
        page.draw_rect(pymupdf.Rect(28, y, 744, y + 4), color=None, fill=(0.2, 0.8, 0.3), fill_opacity=0.4)
    out = tmp_path / "shaded.pdf"
    doc.save(out)
    shaded = extract(out, legend, Options("back-yoke", "Back yoke", size=3))["charts"][0]
    assert shaded["rows"] == chart["rows"]


def test_two_page_pdf_rejected(tmp_path: Path, legend: Legend) -> None:
    doc = pymupdf.open()
    doc.insert_pdf(pymupdf.open(FIXTURE))
    doc.insert_pdf(pymupdf.open(FIXTURE))
    out = tmp_path / "two.pdf"
    doc.save(out)
    with pytest.raises(ExtractionError, match="single-page"):
        extract(out, legend, Options("x", "x"))


def test_unknown_glyph_is_an_error(tmp_path: Path, legend: Legend) -> None:
    doc = pymupdf.open(FIXTURE)
    page = doc[0]
    # A stray, almost flat stroke high in an empty cell of row 79 (top band): no symbol looks like that.
    x = 28.54 + 6.27 * 3
    page.draw_line((x + 1, 94.2), (x + 5, 94.6), color=(0, 0, 0), width=0.33)
    out = tmp_path / "stray.pdf"
    doc.save(out)
    with pytest.raises(ExtractionError, match=r"row 79"):
        extract(out, legend, Options("x", "x"))


def test_cli_extract_and_show(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "back.json"
    args = ["extract", str(FIXTURE), "--legend", str(LEGEND), "--id", "back-yoke", "--title", "Back yoke"]
    assert main([*args, "--size", "3", "-o", str(out)]) == 0
    assert main(["show", str(out), "--row", "2"]) == 0
    assert "Back yoke, row 2 (RS, right to left)" in capsys.readouterr().out


def test_two_grids_rejected(tmp_path: Path, legend: Legend) -> None:
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=400)
    for left in (20, 320):  # two separate 10 x 10 grids
        for k in range(11):
            page.draw_line((left, 20 + 10 * k), (left + 100, 20 + 10 * k), width=0.3)
            page.draw_line((left + 10 * k, 20), (left + 10 * k, 120), width=0.3)
    out = tmp_path / "two-grids.pdf"
    doc.save(out)
    with pytest.raises(ExtractionError, match="2 separate grids"):
        extract(out, legend, Options("x", "x"))
