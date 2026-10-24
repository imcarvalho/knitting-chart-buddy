// Symbol legend and per-cell recognition. Port of extractor/chart_buddy/symbols.py: keep the two in step.

import { ExtractionError } from './errors'
import { bandIndex, cellW, chartCols, colIndex, colNumber, gridX0, inside, type Grid } from './grid'
import { MIN_GRID_LINE, type PageData, type Segment } from './page'

// Endpoint tolerance (cell units) when comparing a glyph stroke with a template stroke.
const STROKE_TOL = 0.3
// Two strokes closer than this (cell units, every coordinate) are one stroke drawn twice.
const DUPLICATE_TOL = 0.05
// Strokes of one glyph never get further apart than this (cell units).
const JOIN_TOL = 0.15

const PURL_TEXT = new Set(['-', '–', '‒', '—', '▬'])
const ARROWS: Record<string, 'left' | 'right'> = { '←': 'left', '→': 'right' }

export type Stroke = [number, number, number, number]

export interface LegendStep {
  count: number
  action: 'k' | 'p'
  fromCn?: boolean
}

export interface LegendSide {
  action?: 'k' | 'p'
  cn?: { count: number; hold: 'front' | 'back' }
  steps?: LegendStep[]
  text?: string
}

export interface LegendSymbolRaw {
  id: string
  name: string
  abbr?: string
  kind: 'stitch' | 'none' | 'ds' | 'increase' | 'cable'
  width: number
  text?: string
  verified?: boolean
  rs?: LegendSide
  ws?: LegendSide
  template?: { strokes: number[][]; marks?: number[] } | null
}

export interface LegendRaw {
  pattern?: string
  sizes?: Record<string, Record<string, { startRow?: number; endRow?: number }>>
  symbols: LegendSymbolRaw[]
}

export interface LegendSymbol {
  id: string
  name: string
  abbr: string
  kind: LegendSymbolRaw['kind']
  width: number
  raw: LegendSymbolRaw
  template: { strokes: Stroke[]; marks: number[] } | null
  verified: boolean
}

export interface Legend {
  pattern: string
  symbols: Map<string, LegendSymbol> // insertion order = legend order
  sizes: NonNullable<LegendRaw['sizes']>
}

function norm(x0: number, y0: number, x1: number, y1: number): Stroke {
  return x0 <= x1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0]
}

function cmpTuple(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

export function loadLegend(raw: LegendRaw): Legend {
  const symbols = new Map<string, LegendSymbol>()
  for (const s of raw.symbols) {
    const t = s.template
    symbols.set(s.id, {
      id: s.id,
      name: s.name,
      abbr: s.abbr ?? '',
      kind: s.kind,
      width: s.width,
      raw: s,
      template: t ? { strokes: t.strokes.map((st) => norm(st[0], st[1], st[2], st[3])), marks: [...(t.marks ?? [])].sort((a, b) => a - b) } : null,
      verified: Boolean(s.verified),
    })
  }
  return { pattern: raw.pattern ?? '', symbols, sizes: raw.sizes ?? {} }
}

export interface Cell {
  band: number
  idx: number
  symbol: string
  arrow: 'left' | 'right' | null
}

export interface Glyph {
  band: number
  lo: number // first grid column index
  width: number
  strokes: Stroke[] // cell units, relative to lo
  marks: number[]
  symbol: LegendSymbol | null
}

export interface Recognition {
  cells: Map<string, Cell> // key "band,idx"
  glyphs: Glyph[]
}

export const cellKey = (band: number, idx: number) => `${band},${idx}`

export function recognise(data: PageData, grid: Grid, legend: Legend): Recognition {
  const cells = new Map<string, Cell>()
  for (let b = 0; b < grid.ys.length - 1; b++) {
    if (b === grid.numberBand) continue
    for (const i of chartCols(grid)) cells.set(cellKey(b, i), { band: b, idx: i, symbol: 'empty', arrow: null })
  }
  const glyphs: Glyph[] = []
  const where = (band: number, idx: number) => ({ row: grid.bandRows.get(band) ?? null, col: colNumber(grid, idx) })

  // Filled shapes: grey = no stitch. White = background. Anything else is unknown.
  for (const f of data.fills) {
    const r = f.rect
    if (!inside(grid, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)) continue
    if (isWhite(f.color)) continue
    const covered: Cell[] = []
    for (const c of cells.values()) {
      const cx = (grid.xs[c.idx] + grid.xs[c.idx + 1]) / 2
      const cy = (grid.ys[c.band] + grid.ys[c.band + 1]) / 2
      if (r.x0 - 0.2 <= cx && cx <= r.x1 + 0.2 && r.y0 - 0.2 <= cy && cy <= r.y1 + 0.2) covered.push(c)
    }
    if (isGrey(f.color)) {
      for (const c of covered) c.symbol = 'none'
    } else if (covered.length) {
      throw new ExtractionError(`unknown filled shape with colour ${f.color.map((v) => v.toFixed(2)).join(', ')}`, where(covered[0].band, covered[0].idx))
    }
  }

  // Text inside cells: purl dashes, DS, short-row arrows.
  for (const w of data.words) {
    const cx = (w.x0 + w.x1) / 2
    const cy = (w.y0 + w.y1) / 2
    const b = bandIndex(grid, cy)
    const i = colIndex(grid, cx)
    if (b === null || i === null) continue
    const cell = cells.get(cellKey(b, i))
    if (!cell) continue
    if (PURL_TEXT.has(w.text)) {
      const dx = Math.abs(cx - (grid.xs[i] + grid.xs[i + 1]) / 2) / cellW(grid)
      if (dx > 0.35) throw new ExtractionError(`purl dash is off-centre (${dx.toFixed(2)} cell)`, where(b, i))
      setSymbol(cell, 'purl', where(b, i))
    } else if (w.text === 'DS') {
      setSymbol(cell, 'ds', where(b, i))
    } else if (w.text in ARROWS) {
      cell.arrow = ARROWS[w.text]
      cell.symbol = 'none'
    } else {
      throw new ExtractionError(`unknown text ${JSON.stringify(w.text)} inside the chart`, where(b, i))
    }
  }

  // Strokes: cable and increase glyphs.
  for (const glyph of collectGlyphs(data.segments, grid)) {
    glyph.symbol = match(glyph, legend)
    if (!glyph.symbol) {
      const idx = grid.colSlope < 0 ? glyph.lo + glyph.width - 1 : glyph.lo
      throw new ExtractionError(
        `unknown glyph ${glyph.width} cell(s) wide, strokes ${fmt(glyph.strokes)}, marks [${glyph.marks.join(', ')}]`,
        where(glyph.band, idx),
      )
    }
    glyphs.push(glyph)
    for (let k = 0; k < glyph.width; k++) {
      const cell = cells.get(cellKey(glyph.band, glyph.lo + k))
      if (!cell) throw new ExtractionError('glyph runs outside the chart', where(glyph.band, glyph.lo))
      if (cell.symbol !== 'empty') {
        throw new ExtractionError(`glyph ${JSON.stringify(glyph.symbol.name)} overlaps a ${JSON.stringify(cell.symbol)} cell`, where(cell.band, cell.idx))
      }
      cell.symbol = glyph.symbol.id
    }
  }
  return { cells, glyphs }
}

function setSymbol(cell: Cell, symbol: string, where: { row: number | null; col: number }): void {
  if (cell.symbol !== 'empty') throw new ExtractionError(`cell holds both ${JSON.stringify(cell.symbol)} and ${JSON.stringify(symbol)}`, where)
  cell.symbol = symbol
}

const isWhite = (c: number[]) => c.every((v) => v > 0.95)
const isGrey = (c: number[]) => Math.max(...c) - Math.min(...c) < 0.05 && c[0] > 0.3 && c[0] < 0.95

function fmt(strokes: Stroke[]): string {
  return `[${strokes.map((s) => `(${s.map((v) => v.toFixed(2)).join(', ')})`).join(', ')}]`
}

function collectGlyphs(segments: Segment[], grid: Grid): Glyph[] {
  const perBand = new Map<number, Stroke[]>()
  for (const s of segments) {
    const length = Math.hypot(s.x1 - s.x0, s.y1 - s.y0)
    const axis = Math.abs(s.x0 - s.x1) < 0.01 || Math.abs(s.y0 - s.y1) < 0.01
    if (axis && length >= MIN_GRID_LINE) continue // grid line drawn as a stroke
    if (!(inside(grid, s.x0, s.y0) && inside(grid, s.x1, s.y1))) continue // outside the chart
    const band = bandIndex(grid, (s.y0 + s.y1) / 2)
    if (band === null || band === grid.numberBand) continue
    const top = grid.ys[band]
    const h = grid.ys[band + 1] - grid.ys[band]
    const fx = (x: number) => (x - gridX0(grid)) / cellW(grid)
    const st = norm(fx(s.x0), (s.y0 - top) / h, fx(s.x1), (s.y1 - top) / h)
    if (Math.min(st[1], st[3]) < -0.15 || Math.max(st[1], st[3]) > 1.15) {
      throw new ExtractionError('a stroke crosses a row boundary', { row: grid.bandRows.get(band), col: colNumber(grid, Math.trunc(st[0])) })
    }
    if (!perBand.has(band)) perBand.set(band, [])
    perBand.get(band)!.push(st)
  }

  const glyphs: Glyph[] = []
  for (const band of [...perBand.keys()].sort((a, b) => a - b)) {
    const strokes = dedupe(perBand.get(band)!)
    for (const group of clusterStrokes(strokes)) {
      const lo = Math.floor(Math.min(...group.map((s) => s[0])) + 0.2)
      const hi = Math.ceil(Math.max(...group.map((s) => s[2])) - 0.2)
      const marks: number[] = []
      const lines: Stroke[] = []
      for (const s of group) {
        if (Math.abs(s[1] - s[3]) < 0.05 && s[2] - s[0] < 0.5 && s[1] > 0.6) marks.push(Math.floor((s[0] + s[2]) / 2) - lo)
        else lines.push([s[0] - lo, s[1], s[2] - lo, s[3]])
      }
      glyphs.push({
        band,
        lo,
        width: Math.max(1, hi - lo),
        strokes: lines.sort(cmpTuple),
        marks: [...new Set(marks)].sort((a, b) => a - b),
        symbol: null,
      })
    }
  }
  return glyphs
}

function dedupe(strokes: Stroke[]): Stroke[] {
  const out: Stroke[] = []
  for (const s of strokes) {
    if (!out.some((o) => s.every((v, k) => Math.abs(v - o[k]) < DUPLICATE_TOL))) out.push(s)
  }
  return out
}

/** Groups strokes whose horizontal extents touch or overlap. */
function clusterStrokes(strokes: Stroke[]): Stroke[][] {
  const clusters: Stroke[][] = []
  for (const s of [...strokes].sort(cmpTuple)) {
    const last = clusters[clusters.length - 1]
    if (last && s[0] <= Math.max(...last.map((t) => t[2])) + JOIN_TOL) last.push(s)
    else clusters.push([s])
  }
  return clusters
}

function match(glyph: Glyph, legend: Legend): LegendSymbol | null {
  let best: [number, LegendSymbol] | null = null
  for (const sym of legend.symbols.values()) {
    const t = sym.template
    if (!t) continue
    if (sym.width !== glyph.width || t.strokes.length !== glyph.strokes.length) continue
    if (t.marks.length !== glyph.marks.length || t.marks.some((m, k) => m !== glyph.marks[k])) continue
    const err = strokeDistance(glyph.strokes, t.strokes)
    if (err !== null && (best === null || err < best[0])) best = [err, sym]
  }
  return best ? best[1] : null
}

/** Total endpoint error of a one-to-one stroke matching, or null if any stroke has no partner. */
function strokeDistance(a: Stroke[], b: Stroke[]): number | null {
  const remaining = [...b]
  let total = 0
  for (const s of a) {
    if (remaining.length === 0) return null
    let bestD = Infinity
    let bestJ = -1
    remaining.forEach((t, j) => {
      const d = Math.max(...s.map((v, k) => Math.abs(v - t[k])))
      if (d < bestD) {
        bestD = d
        bestJ = j
      }
    })
    if (bestD > STROKE_TOL) return null
    total += bestD
    remaining.splice(bestJ, 1)
  }
  return total
}
