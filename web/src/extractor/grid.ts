// Grid detection. Port of extractor/chart_buddy/pdf_grid.py: keep the two in step.

import { ExtractionError } from './errors'
import { MIN_GRID_LINE, type PageData } from './page'

// Positions closer than this (pt) are the same grid line.
const CLUSTER_TOL = 0.6
const DIGITS = /^\d+$/

interface Line {
  pos: number // x for vertical, y for horizontal
  start: number
  end: number
}

export interface Grid {
  xs: number[] // vertical line positions, ascending
  ys: number[] // horizontal line positions, ascending (top to bottom)
  labelCols: Set<number> // grid column indices holding row numbers
  numberBand: number // band index holding column numbers
  bandRows: Map<number, number> // band index -> row number
  colSlope: number // column number = colSlope * grid index + colOffset
  colOffset: number
}

export const gridX0 = (g: Grid) => g.xs[0]
export const gridX1 = (g: Grid) => g.xs[g.xs.length - 1]
export const gridY0 = (g: Grid) => g.ys[0]
export const gridY1 = (g: Grid) => g.ys[g.ys.length - 1]
export const cellW = (g: Grid) => (gridX1(g) - gridX0(g)) / (g.xs.length - 1)
export const nBands = (g: Grid) => g.ys.length - 1
export const nCols = (g: Grid) => g.xs.length - 1

/** Index of the last element <= x (Python's bisect.bisect(a, x) - 1). */
function bisectRight(a: number[], x: number): number {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (x < a[mid]) hi = mid
    else lo = mid + 1
  }
  return lo
}

export function colIndex(g: Grid, x: number): number | null {
  if (x < gridX0(g) || x > gridX1(g)) return null
  return Math.min(bisectRight(g.xs, x) - 1, g.xs.length - 2)
}

export function bandIndex(g: Grid, y: number): number | null {
  if (y < gridY0(g) || y > gridY1(g)) return null
  return Math.min(bisectRight(g.ys, y) - 1, g.ys.length - 2)
}

export function inside(g: Grid, x: number, y: number): boolean {
  return gridX0(g) <= x && x <= gridX1(g) && gridY0(g) <= y && y <= gridY1(g)
}

export function chartCols(g: Grid): number[] {
  const out: number[] = []
  for (let i = 0; i < nCols(g); i++) if (!g.labelCols.has(i)) out.push(i)
  return out
}

export const colNumber = (g: Grid, idx: number) => g.colSlope * idx + g.colOffset

function gridLines(data: PageData): [Line[], Line[]] {
  const horiz: Line[] = []
  const vert: Line[] = []
  for (const r of data.gridRects) {
    if (r.x1 - r.x0 >= r.y1 - r.y0) horiz.push({ pos: (r.y0 + r.y1) / 2, start: r.x0, end: r.x1 })
    else vert.push({ pos: (r.x0 + r.x1) / 2, start: r.y0, end: r.y1 })
  }
  for (const s of data.segments) {
    if (Math.abs(s.y0 - s.y1) < 0.01 && Math.abs(s.x1 - s.x0) >= MIN_GRID_LINE) {
      horiz.push({ pos: s.y0, start: Math.min(s.x0, s.x1), end: Math.max(s.x0, s.x1) })
    } else if (Math.abs(s.x0 - s.x1) < 0.01 && Math.abs(s.y1 - s.y0) >= MIN_GRID_LINE) {
      vert.push({ pos: s.x0, start: Math.min(s.y0, s.y1), end: Math.max(s.y0, s.y1) })
    }
  }
  return [horiz, vert]
}

export function cluster(values: number[], tol = CLUSTER_TOL): number[] {
  const out: number[][] = []
  for (const v of [...values].sort((a, b) => a - b)) {
    const last = out[out.length - 1]
    if (last && v - last[last.length - 1] <= tol) last.push(v)
    else out.push([v])
  }
  return out.map((c) => c.reduce((a, b) => a + b, 0) / c.length)
}

export function detectGrid(data: PageData): Grid {
  const [horiz, vert] = gridRegion(...gridLines(data))
  const grid: Grid = {
    xs: cluster(vert.map((v) => v.pos)),
    ys: cluster(horiz.map((h) => h.pos)),
    labelCols: new Set(),
    numberBand: -1,
    bandRows: new Map(),
    colSlope: -1,
    colOffset: 0,
  }
  checkRegular(grid.xs, 'column')
  checkRegular(grid.ys, 'row')
  detectLabels(data, grid)
  return grid
}

/** Groups touching lines into regions and returns the one grid. Small boxes (notes) are ignored. */
function gridRegion(horiz: Line[], vert: Line[]): [Line[], Line[]] {
  const tol = 2.0
  type Region = { box: number[]; hs: Line[]; vs: Line[] }
  const regions: Region[] = []
  const all: [Line, boolean][] = [...horiz.map((h): [Line, boolean] => [h, true]), ...vert.map((v): [Line, boolean] => [v, false])]
  for (const [ln, isH] of all) {
    let box = isH ? [ln.start, ln.pos, ln.end, ln.pos] : [ln.pos, ln.start, ln.pos, ln.end]
    let hs = isH ? [ln] : []
    let vs = isH ? [] : [ln]
    let merged = true
    while (merged) {
      merged = false
      for (let k = 0; k < regions.length; k++) {
        const b = regions[k].box
        if (box[0] <= b[2] + tol && b[0] <= box[2] + tol && box[1] <= b[3] + tol && b[1] <= box[3] + tol) {
          box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])]
          hs = [...hs, ...regions[k].hs]
          vs = [...vs, ...regions[k].vs]
          regions.splice(k, 1)
          merged = true
          break
        }
      }
    }
    regions.push({ box, hs, vs })
  }
  const grids = regions.filter((r) => cluster(r.hs.map((h) => h.pos)).length >= 3 && cluster(r.vs.map((v) => v.pos)).length >= 3)
  if (grids.length === 0) throw new ExtractionError('no chart grid found (not enough grid lines; is this a vector chart?)')
  if (grids.length > 1) {
    throw new ExtractionError(
      `found ${grids.length} separate grids; the input must contain exactly one chart. Crop the page to one chart first.`,
    )
  }
  return [grids[0].hs, grids[0].vs]
}

function checkRegular(positions: number[], what: string): void {
  const gaps = positions.slice(1).map((p, i) => p - positions[i])
  if (gaps.length === 0) throw new ExtractionError(`grid has no ${what}s`)
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
  const bad = gaps.filter((g) => Math.abs(g - median) > 0.25 * median)
  if (bad.length) {
    throw new ExtractionError(
      `irregular ${what} spacing in grid (median ${median.toFixed(2)} pt, odd gaps ${bad.slice(0, 5).map((b) => b.toFixed(2)).join(', ')})`,
    )
  }
}

/** Finds the column-number band, the row-number columns, and maps bands to rows. */
function detectLabels(data: PageData, grid: Grid): void {
  const digitCells = new Map<string, number>() // "band,idx" -> number
  const key = (b: number, i: number) => `${b},${i}`
  const parse = (k: string) => k.split(',').map(Number) as [number, number]
  for (const w of data.words) {
    const cx = (w.x0 + w.x1) / 2
    const cy = (w.y0 + w.y1) / 2
    if (!DIGITS.test(w.text) || !inside(grid, cx, cy)) continue
    const b = bandIndex(grid, cy)
    const i = colIndex(grid, cx)
    if (b !== null && i !== null) digitCells.set(key(b, i), Number.parseInt(w.text, 10))
  }
  const bands = nBands(grid)

  // Column numbers: the band holding the most digit words.
  const perBand = new Map<number, number>()
  for (const k of digitCells.keys()) {
    const [b] = parse(k)
    perBand.set(b, (perBand.get(b) ?? 0) + 1)
  }
  if (perBand.size === 0) throw new ExtractionError('no row or column numbers found inside the grid')
  let numberBand = -1
  for (const [b, n] of perBand) {
    const best = perBand.get(numberBand) ?? -1
    if (n > best || (n === best && b > numberBand)) numberBand = b
  }
  if ((perBand.get(numberBand) ?? 0) < 3) throw new ExtractionError('could not find the column-number band')
  grid.numberBand = numberBand

  // Row numbers: grid columns where most bands carry a digit word.
  const perCol = new Map<number, number>()
  for (const k of digitCells.keys()) {
    const [b, i] = parse(k)
    if (b !== numberBand) perCol.set(i, (perCol.get(i) ?? 0) + 1)
  }
  const threshold = Math.max(3, Math.floor((bands - 1) / 2))
  grid.labelCols = new Set([...perCol].filter(([, n]) => n >= threshold).map(([i]) => i))
  if (grid.labelCols.size === 0) throw new ExtractionError('could not find the row-number column')

  for (let b = 0; b < bands; b++) {
    if (b === numberBand) continue
    const found = new Set<number>()
    for (const i of grid.labelCols) {
      const n = digitCells.get(key(b, i))
      if (n !== undefined) found.add(n)
    }
    if (found.size > 1) throw new ExtractionError(`row labels disagree in grid band ${b}: ${[...found].sort((x, y) => x - y)}`)
    if (found.size === 1) grid.bandRows.set(b, [...found][0])
  }
  const missing: number[] = []
  for (let b = 0; b < bands; b++) if (b !== numberBand && !grid.bandRows.has(b)) missing.push(b)
  if (missing.length) throw new ExtractionError(`grid bands ${missing.join(', ')} have no row number`)

  // Column numbers follow col = slope * idx + offset with slope = +1 or -1.
  const pairs = [...digitCells]
    .map(([k, n]) => [...parse(k), n] as [number, number, number])
    .filter(([b, i]) => b === numberBand && !grid.labelCols.has(i))
    .map(([, i, n]) => [i, n] as [number, number])
    .sort((p, q) => p[0] - q[0] || p[1] - q[1])
  const slope = pairs[0][1] > pairs[pairs.length - 1][1] ? -1 : 1
  const offsets = new Set(pairs.map(([i, n]) => n - slope * i))
  if (offsets.size !== 1) throw new ExtractionError(`column numbers are not one per column: ${JSON.stringify(pairs)}`)
  grid.colSlope = slope
  grid.colOffset = [...offsets][0]
}
