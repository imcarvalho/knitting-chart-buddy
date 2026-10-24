// Assembles recognised cells into rows, working-order groups and the output document.
// Port of extractor/chart_buddy/chart.py: keep the two in step (a parity test compares their output).

import type { Chart, Group, PatternDoc, Row, SymbolDef } from '../types'
import { ExtractionError } from './errors'
import { bandIndex, chartCols, colIndex, colNumber, gridX0, gridX1, gridY0, gridY1, type Grid } from './grid'
import type { PageData } from './page'
import { cellKey, type Cell, type Glyph, type Legend, type LegendSymbol, type Recognition } from './symbols'

const ACTION_WORD = { k: 'knit', p: 'purl' } as const

export interface Options {
  chartId: string
  title: string
  size?: number | null
  construction?: 'flat' | 'round' | null // null = infer
  pattern?: string | null
}

type Warning = Chart['warnings'][number] & { cols: number[]; symbol: string }

export function buildDocument(
  data: PageData,
  grid: Grid,
  rec: Recognition,
  legend: Legend,
  opts: Options,
  source: PatternDoc['source'],
): PatternDoc {
  const wsBands = wsLabelBands(data, grid)
  const construction = opts.construction ?? (wsBands.size ? 'flat' : 'round')
  const glyphAt = glyphMap(rec)

  const bandOfRow = new Map([...grid.bandRows].map(([band, row]) => [row, band]))
  const rows: Row[] = []
  for (const rowNumber of [...bandOfRow.keys()].sort((a, b) => a - b)) {
    const band = bandOfRow.get(rowNumber)!
    let side: Row['side']
    if (construction === 'round') side = 'RS'
    else if (wsBands.size) side = wsBands.has(band) ? 'WS' : 'RS'
    else side = rowNumber % 2 === 1 ? 'WS' : 'RS'
    rows.push(buildRow(rowNumber, band, side, grid, rec, glyphAt, legend))
  }

  const warnings = continuityCheck(grid, rec)
  const sizeMarkers = findSizeMarkers(data, grid)
  const notes = findNotes(data, grid)
  const edgeNote = notes.find((n) => /does\s+not\s+show/i.test(n))
  const chart: Chart = {
    id: opts.chartId,
    title: opts.title,
    construction,
    columns: numberedColumns(data, grid),
    repeats: findRepeats(data, grid, opts.size ?? null),
    sizeMarkers,
    notes,
    rows,
    warnings,
  }
  if (edgeNote) chart.edgeNote = edgeNote
  if (opts.size !== undefined && opts.size !== null) chart.size = sizeRange(opts, legend, sizeMarkers, rows)

  const used = [...new Set(rec.glyphs.filter((g) => g.symbol).map((g) => g.symbol!.id))].sort()
  return {
    pattern: opts.pattern || legend.pattern,
    source,
    symbols: Object.fromEntries(used.map((id) => [id, symbolOut(legend.symbols.get(id)!)])),
    charts: [chart],
  }
}

function glyphMap(rec: Recognition): Map<string, Glyph> {
  const m = new Map<string, Glyph>()
  for (const g of rec.glyphs) for (let k = 0; k < g.width; k++) m.set(cellKey(g.band, g.lo + k), g)
  return m
}

// ---------------------------------------------------------------- rows and groups

function buildRow(
  row: number,
  band: number,
  side: Row['side'],
  grid: Grid,
  rec: Recognition,
  glyphAt: Map<string, Glyph>,
  legend: Legend,
): Row {
  const direction = side === 'RS' ? 'rtl' : 'ltr'
  const drawn = chartCols(grid).map((i) => rec.cells.get(cellKey(band, i))!) // left to right

  const cells: Row['cells'] = drawn.map((c) => {
    const out: Row['cells'][number] = { col: colNumber(grid, c.idx), symbol: cellSymbol(c, legend) }
    const g = glyphAt.get(cellKey(band, c.idx))
    if (g?.symbol?.kind === 'cable') out.cableId = cableId(row, g, grid)
    if (c.arrow) out.arrow = c.arrow
    return out
  })

  const working = direction === 'ltr' ? drawn : [...drawn].reverse()
  const worked = working.filter((c) => c.symbol !== 'none')
  const posOf = new Map(working.map((c, n) => [c.idx, n]))
  const groups: Group[] = []
  const seen = new Set<Glyph>()
  let prevPos: number | null = null
  for (const c of worked) {
    const gap = prevPos !== null && posOf.get(c.idx) !== prevPos + 1
    prevPos = posOf.get(c.idx)!
    const g = glyphAt.get(cellKey(band, c.idx))
    if (g) {
      if (seen.has(g)) continue
      seen.add(g)
      groups.push(glyphGroup(row, side, direction, g, grid))
      continue
    }
    const sym = legend.symbols.get(c.symbol)
    const col = colNumber(grid, c.idx)
    if (!sym) throw new ExtractionError(`symbol ${JSON.stringify(c.symbol)} is not in the legend`, { row, col })
    if (sym.kind === 'stitch') {
      const action = sym.raw[side === 'RS' ? 'rs' : 'ws']!.action!
      const kind = ACTION_WORD[action]
      const last = groups[groups.length - 1]
      if (last && !gap && last.kind === kind) {
        last.cols.push(col)
        last.count! += 1
      } else {
        groups.push({ cols: [col], kind, count: 1, text: '', short: '' })
      }
    } else if (sym.kind === 'ds') {
      groups.push({ cols: [col], kind: 'ds', text: sym.raw.text ?? 'Work the double stitch', short: 'DS' })
    } else {
      throw new ExtractionError(`no rule to work symbol ${JSON.stringify(sym.id)}`, { row, col })
    }
  }
  for (const gr of groups) {
    if (gr.kind === 'knit' || gr.kind === 'purl') {
      gr.text = `${gr.kind[0].toUpperCase()}${gr.kind.slice(1)} ${gr.count}`
      gr.short = `${gr.kind[0]}${gr.count}`
    }
  }

  const out: Row = { number: row, side, direction, cells, groups }
  if (drawn.some((c) => c.symbol === 'none') && worked.length) {
    out.shortRow = {
      start: direction === 'rtl' ? 'right' : 'left',
      startCol: colNumber(grid, worked[0].idx),
      turnAfterCol: colNumber(grid, worked[worked.length - 1].idx),
    }
  }
  return out
}

function cellSymbol(c: Cell, legend: Legend): string {
  return legend.symbols.get(c.symbol)?.kind === 'cable' ? 'cable' : c.symbol
}

function cableId(row: number, g: Glyph, grid: Grid): string {
  const cols = Array.from({ length: g.width }, (_, k) => colNumber(grid, g.lo + k))
  return `c-${row}-${Math.min(...cols)}`
}

function glyphGroup(row: number, side: Row['side'], direction: Row['direction'], g: Glyph, grid: Grid): Group {
  const sym = g.symbol!
  const idxs = Array.from({ length: g.width }, (_, k) => g.lo + k)
  if (direction === 'rtl') idxs.reverse()
  const cols = idxs.map((i) => colNumber(grid, i))
  if (sym.kind === 'increase') {
    return { cols, kind: 'increase', symbol: sym.id, text: sym.raw.text ?? sym.name, short: sym.abbr }
  }
  const spec = sym.raw[side === 'RS' ? 'rs' : 'ws']
  if (!spec) throw new ExtractionError(`${JSON.stringify(sym.name)} has no instruction for the ${side} side in the legend`, { row, col: cols[0] })
  if (spec.text) {
    // written explanation from the pattern, used as is
    return {
      cols, kind: 'cable', symbol: sym.id, cableId: cableId(row, g, grid), legend: sym.name, abbr: sym.abbr,
      text: spec.text, short: `[${sym.abbr}: ${spec.text}]`, verified: sym.verified,
    } // prettier-ignore
  }
  const cn = spec.cn!
  const n = cn.count
  const holdLong = cn.hold === 'back' ? 'at the BACK' : 'in FRONT'
  const holdShort = cn.hold === 'back' ? 'BACK' : 'FRONT'
  const steps = spec.steps!.map((s) => `${s.action}${s.count}${s.fromCn ? ' from cn' : ''}`)
  const words = spec.steps!.map((s) => `${ACTION_WORD[s.action]} ${s.count}${s.fromCn ? ' from cable needle' : ''}`)
  return {
    cols,
    kind: 'cable',
    symbol: sym.id,
    cableId: cableId(row, g, grid),
    legend: sym.name,
    abbr: sym.abbr,
    cn: { count: n, hold: cn.hold },
    steps,
    text: `Slip ${n} st${n > 1 ? 's' : ''} to cable needle, hold ${holdLong}, ${words.join(', ')}`,
    short: `[${sym.abbr}: sl${n} to cn ${holdShort}, ${steps.join(', ')}]`,
    verified: sym.verified,
  }
}

function symbolOut(sym: LegendSymbol): SymbolDef {
  const out: SymbolDef = { id: sym.id, name: sym.name, abbr: sym.abbr, kind: sym.kind, width: sym.width }
  if (sym.template) {
    out.strokes = sym.template.strokes.map((s) => [...s] as [number, number, number, number])
    out.marks = sym.template.marks
  }
  return out
}

// ---------------------------------------------------------------- continuity

/** Stitch types (k/p, RS appearance) entering and leaving an RS cable, left to right as drawn. */
export function cableIo(sym: LegendSymbol): [string[], string[]] | null {
  const spec = sym.raw.rs
  if (!spec?.cn || !spec.steps) return null
  const expand = (fromCn: boolean) =>
    spec.steps!.filter((s) => Boolean(s.fromCn) === fromCn).flatMap((s) => Array<string>(s.count).fill(s.action))
  const worked = expand(false)
  const fromCn = expand(true)
  if (worked.length + fromCn.length !== sym.width || fromCn.length !== spec.cn.count) {
    throw new ExtractionError(`legend entry ${JSON.stringify(sym.id)}: steps do not add up to its width`)
  }
  // Positions counted from the right (working order on the RS): cn stitches first, worked ones land first.
  const inp = [...fromCn, ...worked]
  const out = [...worked, ...fromCn]
  return [inp.reverse(), out.reverse()]
}

function continuityCheck(grid: Grid, rec: Recognition): Warning[] {
  const bandOfRow = new Map([...grid.bandRows].map(([band, row]) => [row, band]))
  const glyphAt = glyphMap(rec)

  const appearance = (row: number, idx: number, want: 'in' | 'out'): string | null => {
    const band = bandOfRow.get(row)
    if (band === undefined) return null
    const g = glyphAt.get(cellKey(band, idx))
    if (g) {
      const io = g.symbol?.kind === 'cable' ? cableIo(g.symbol) : null
      if (!io) return null
      return (want === 'out' ? io[1] : io[0])[idx - g.lo]
    }
    const sym = rec.cells.get(cellKey(band, idx))!.symbol
    return sym === 'empty' ? 'k' : sym === 'purl' ? 'p' : null
  }
  const seq = (xs: (string | null)[]) => xs.map((x) => x ?? '?').join('')

  const warnings: Warning[] = []
  for (const g of rec.glyphs) {
    if (g.symbol?.kind !== 'cable') continue
    const io = cableIo(g.symbol)
    if (!io) continue
    const [inp, out] = io
    const row = grid.bandRows.get(g.band)!
    const ks = Array.from({ length: g.width }, (_, k) => k)
    const below = ks.map((k) => appearance(row - 1, g.lo + k, 'out'))
    const above = ks.map((k) => appearance(row + 1, g.lo + k, 'in'))
    const badIn = below.some((b, k) => b !== null && b !== inp[k])
    const badOut = above.some((a, k) => a !== null && a !== out[k])
    if (!badIn && !badOut) continue
    const cols = ks.map((k) => colNumber(grid, g.lo + k)).sort((a, b) => a - b)
    const detail =
      `expected below ${inp.join('')} got ${seq(below)}; expected above ${out.join('')} got ${seq(above)} ` +
      '(left to right)'
    // A cable that works a stitch differently from how it was made (knits a purl or purls a knit) is a
    // deliberate stitch change when the row above confirms the result.
    const [severity, what] = badOut
      ? (['warning', "row above does not match the cable's output"] as const)
      : (['info', 'cable changes the type of a stitch'] as const)
    warnings.push({
      check: 'continuity',
      severity,
      row,
      cols,
      symbol: g.symbol.id,
      message: `${g.symbol.name} on row ${row}, cols ${cols[0]} to ${cols[cols.length - 1]}: ${what}; ${detail}`,
    })
  }
  return warnings
}

// ---------------------------------------------------------------- text around the chart

function wsLabelBands(data: PageData, grid: Grid): Set<number> {
  const bands = new Set<number>()
  for (const w of data.words) {
    if (w.text !== 'WS') continue
    const idx = colIndex(grid, (w.x0 + w.x1) / 2)
    if (idx === null || grid.labelCols.has(idx)) {
      const band = bandIndex(grid, (w.y0 + w.y1) / 2)
      if (band !== null && band !== grid.numberBand) bands.add(band)
    }
  }
  return bands
}

const SIZE_EN = /Size\s+(\d+)\s*,?\s*(end|start|begin)/i
const SIZE_KO = /(\d+)\s*사이즈\s*(여기까지|여기부터)?/

function findSizeMarkers(data: PageData, grid: Grid): Chart['sizeMarkers'] {
  const markers: Chart['sizeMarkers'] = []
  for (const { text, rect } of data.lines) {
    const cx = (rect.x0 + rect.x1) / 2
    if (gridX0(grid) <= cx && cx <= gridX1(grid)) continue
    const band = bandIndex(grid, (rect.y0 + rect.y1) / 2)
    if (band === null || !grid.bandRows.has(band)) continue
    const row = grid.bandRows.get(band)!
    let m = SIZE_EN.exec(text)
    if (m) {
      markers.push({ size: Number(m[1]), row, kind: m[2].toLowerCase() === 'end' ? 'end' : 'start', text })
      continue
    }
    m = SIZE_KO.exec(text)
    if (m) markers.push({ size: Number(m[1]), row, kind: m[2] === '여기부터' ? 'start' : 'end', text })
  }
  return markers.sort((a, b) => a.size - b.size || a.row - b.row)
}

function findNotes(data: PageData, grid: Grid): string[] {
  return data.lines
    .filter((l) => l.rect.y1 < gridY0(grid))
    .sort((a, b) => a.rect.y0 - b.rect.y0 || a.rect.x0 - b.rect.x0)
    .map((l) => l.text)
}

const REPEAT = /Work\s+a\s+total\s+(.+?)\s+times/i

/** "Work a total N times" brackets under the chart. Columns come from the text's horizontal extent. */
function findRepeats(data: PageData, grid: Grid, size: number | null): Chart['repeats'] {
  const out: Chart['repeats'] = []
  const mid = (gridX0(grid) + gridX1(grid)) / 2
  for (const { text, rect } of data.lines) {
    const m = REPEAT.exec(text)
    if (!m || rect.y0 < gridY1(grid)) continue
    const counts = (m[1].match(/\d+/g) ?? []).map(Number)
    if (counts.length === 0) continue
    const times = size && counts.length >= size ? counts[size - 1] : counts[0]
    const a = colIndex(grid, Math.max(rect.x0, gridX0(grid)))
    const b = colIndex(grid, Math.min(rect.x1, gridX1(grid)))
    if (a === null || b === null) continue
    const cols: number[] = []
    for (let i = a; i <= b; i++) if (!grid.labelCols.has(i)) cols.push(colNumber(grid, i))
    cols.sort((x, y) => x - y)
    out.push({ fromCol: cols[0], toCol: cols[cols.length - 1], times, side: (rect.x0 + rect.x1) / 2 < mid ? 'left' : 'right' })
  }
  return out
}

function numberedColumns(data: PageData, grid: Grid): number {
  let max = 0
  for (const w of data.words) {
    if (!/^\d+$/.test(w.text)) continue
    if (bandIndex(grid, (w.y0 + w.y1) / 2) !== grid.numberBand) continue
    const idx = colIndex(grid, (w.x0 + w.x1) / 2)
    if (idx === null || grid.labelCols.has(idx)) continue
    max = Math.max(max, Number(w.text))
  }
  return max
}

function sizeRange(opts: Options, legend: Legend, markers: Chart['sizeMarkers'], rows: Row[]): NonNullable<Chart['size']> {
  const cfg = legend.sizes[String(opts.size)]?.[opts.chartId] ?? {}
  let start = cfg.startRow
  let end = cfg.endRow
  for (const m of markers) {
    if (m.size !== opts.size) continue
    if (m.kind === 'end' && end === undefined) end = m.row
    if (m.kind === 'start' && start === undefined) start = m.row
  }
  return { size: opts.size!, startRow: start ?? rows[0].number, endRow: end ?? rows[rows.length - 1].number }
}
