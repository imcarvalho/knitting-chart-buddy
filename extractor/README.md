# chart_buddy extractor

Reads a one-page vector chart PDF and writes the chart as JSON (see `../schema/chart.schema.json`).

```sh
cd extractor && uv sync
uv run python -m chart_buddy.cli extract ../fixtures/Shanon_Sweater_tamanho3-back.pdf \
    --legend ../legend/shanon.json --id back-yoke --title "Back yoke" --size 3 -o ../out/back.json
uv run python -m chart_buddy.cli show ../out/back.json --row 2
uv run pytest
```
