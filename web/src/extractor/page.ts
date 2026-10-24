// Reads one PDF page into plain shapes and words with pdf.js, in top-left page coordinates
// (y grows downwards), the same frame PyMuPDF uses in the Python extractor.

import { ExtractionError } from './errors'

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface Word extends Rect {
  text: string
  line: number // index of the text line the word belongs to
}

export interface Segment {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface Fill {
  rect: Rect
  color: [number, number, number]
}

export interface PageData {
  width: number
  height: number
  words: Word[]
  lines: { text: string; rect: Rect }[]
  segments: Segment[]
  fills: Fill[]
  gridRects: Rect[] // thin black filled rectangles (grid lines)
}

// A grid line must be at least this long (pt). Cable purl marks are ~1.5 pt, cells ~6 pt wide.
export const MIN_GRID_LINE = 20
// Thickness (pt) under which a filled rectangle counts as a line.
const MAX_LINE_THICKNESS = 1

/** The parts of the pdf.js module this file uses (the browser and Node builds both fit). */
export interface PdfJs {
  getDocument: (src: Record<string, unknown>) => { promise: Promise<PdfDocument>; destroy: () => Promise<void> }
  OPS: Record<string, number>
}

interface PdfDocument {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
}

interface PdfPage {
  getViewport: (o: { scale: number }) => {
    width: number
    height: number
    convertToViewportPoint: (x: number, y: number) => number[]
  }
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>
  getTextContent: () => Promise<{ items: unknown[] }>
}

interface TextItem {
  str: string
  transform: number[]
  width: number
  height: number
}

export interface LoadOptions {
  cMapUrl?: string
  standardFontDataUrl?: string
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(m: Matrix, n: Matrix): Matrix {
  // m then n, as PDF concatenates: [x y 1] * m * n
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export async function loadPage(pdfjs: PdfJs, data: Uint8Array, options: LoadOptions = {}): Promise<PageData> {
  const task = pdfjs.getDocument({
    data,
    cMapUrl: options.cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: options.standardFontDataUrl,
    isEvalSupported: false,
    verbosity: 0,
  })
  let doc: PdfDocument
  try {
    doc = await task.promise
  } catch (e) {
    await task.destroy()
    throw new ExtractionError(`cannot read this PDF (${e instanceof Error ? e.message : String(e)})`)
  }
  try {
    if (doc.numPages !== 1) {
      throw new ExtractionError(
        `expected a single-page PDF with one chart, got ${doc.numPages} pages. Extract the chart page first.`,
      )
    }
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const toView = (x: number, y: number): [number, number] => {
      const [vx, vy] = viewport.convertToViewportPoint(x, y)
      return [vx, vy]
    }
    const shapes = readShapes(pdfjs.OPS, await page.getOperatorList(), toView)
    const text = readText((await page.getTextContent()).items as TextItem[], toView)
    return { width: viewport.width, height: viewport.height, ...shapes, ...text }
  } finally {
    await task.destroy()
  }
}

interface GState {
  ctm: Matrix
  fill: [number, number, number] | null
  fillAlpha: number
}

function readShapes(
  OPS: Record<string, number>,
  ops: { fnArray: number[]; argsArray: unknown[][] },
  toView: (x: number, y: number) => [number, number],
): Pick<PageData, 'segments' | 'fills' | 'gridRects'> {
  const segments: Segment[] = []
  const fills: Fill[] = []
  const gridRects: Rect[] = []
  const stack: GState[] = []
  let gs: GState = { ctm: IDENTITY, fill: [0, 0, 0], fillAlpha: 1 }

  const FILL = new Set([OPS.fill, OPS.eoFill])
  const STROKE = new Set([OPS.stroke, OPS.closeStroke])
  const FILL_STROKE = new Set([OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke])

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]
    if (fn === OPS.save) stack.push({ ...gs })
    else if (fn === OPS.restore) gs = stack.pop() ?? gs
    else if (fn === OPS.transform) gs = { ...gs, ctm: multiply(args as Matrix, gs.ctm) }
    else if (fn === OPS.setFillRGBColor) gs = { ...gs, fill: hexToRgb(args[0] as string) }
    else if (fn === OPS.setGState) {
      for (const [key, value] of args[0] as [string, unknown][]) {
        if (key === 'ca') gs = { ...gs, fillAlpha: value as number }
      }
    } else if (fn === OPS.constructPath) {
      const paint = args[0] as number
      const isFill = FILL.has(paint) || FILL_STROKE.has(paint)
      const isStroke = STROKE.has(paint) || FILL_STROKE.has(paint)
      if (!isFill && !isStroke) continue // clipping paths
      // Translucent shading (the lilac even-row bands) is decoration: drop it first.
      if (isFill && gs.fillAlpha < 1) continue
      const subpaths = pathPoints((args[1] as ArrayLike<number>[])[0], gs.ctm, toView)
      if (isStroke) {
        for (const sp of subpaths) {
          for (let k = 1; k < sp.points.length; k++) {
            const [a, b] = [sp.points[k - 1], sp.points[k]]
            segments.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1] })
          }
        }
      }
      if (isFill && gs.fill) {
        const rect = bbox(subpaths.flatMap((sp) => sp.points))
        if (!rect) continue
        const w = rect.x1 - rect.x0
        const h = rect.y1 - rect.y0
        const black = gs.fill.every((c) => c < 0.05)
        if (black && Math.min(w, h) < MAX_LINE_THICKNESS && Math.max(w, h) >= MIN_GRID_LINE) gridRects.push(rect)
        else if (!isStroke) fills.push({ rect, color: gs.fill })
      }
    }
  }
  return { segments, fills, gridRects }
}

function pathPoints(
  data: ArrayLike<number>,
  ctm: Matrix,
  toView: (x: number, y: number) => [number, number],
): { points: [number, number][] }[] {
  const out: { points: [number, number][] }[] = []
  let current: [number, number][] = []
  const pt = (x: number, y: number) => toView(...apply(ctm, x, y))
  for (let k = 0; k < data.length; ) {
    const op = data[k++]
    if (op === 0) {
      if (current.length) out.push({ points: current })
      current = [pt(data[k], data[k + 1])]
      k += 2
    } else if (op === 1) {
      current.push(pt(data[k], data[k + 1]))
      k += 2
    } else if (op === 2) {
      current.push(pt(data[k + 4], data[k + 5])) // curves: endpoints only (no curved symbols yet)
      k += 6
    } else if (op === 3) {
      current.push(pt(data[k + 2], data[k + 3]))
      k += 4
    } else if (op === 4) {
      if (current.length > 1) current.push(current[0])
    } else {
      throw new ExtractionError(`unsupported path operator ${op}`)
    }
  }
  if (current.length) out.push({ points: current })
  return out
}

function bbox(points: [number, number][]): Rect | null {
  if (points.length === 0) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Splits text runs into words and groups them into lines, like PyMuPDF's get_text("words"). */
function readText(
  items: TextItem[],
  toView: (x: number, y: number) => [number, number],
): Pick<PageData, 'words' | 'lines'> {
  interface Run {
    x0: number
    x1: number
    base: number
    size: number
    words: Omit<Word, 'line'>[]
  }
  const runs: Run[] = []
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue
    const [a, b, c, d, e, f] = it.transform
    const size = Math.hypot(c, d) || it.height
    const [sx, base] = toView(e, f)
    const [ex] = toView(e + it.width * (a / (Math.hypot(a, b) || 1)), f + it.width * (b / (Math.hypot(a, b) || 1)))
    const left = Math.min(sx, ex)
    const width = Math.abs(ex - sx)
    const top = base - size * 0.8
    const bottom = base + size * 0.25
    const words: Omit<Word, 'line'>[] = []
    const n = it.str.length
    for (const m of it.str.matchAll(/\S+/g)) {
      const start = m.index ?? 0
      words.push({
        text: m[0],
        x0: left + (width * start) / n,
        x1: left + (width * (start + m[0].length)) / n,
        y0: top,
        y1: bottom,
      })
    }
    runs.push({ x0: left, x1: left + width, base, size, words })
  }

  // Runs on the same baseline that follow each other closely form a line.
  // Left to right, so each line only ever grows rightwards (baselines can differ by rounding noise).
  runs.sort((p, q) => p.x0 - q.x0 || p.base - q.base)
  const lineRuns: Run[][] = []
  for (const r of runs) {
    const line = lineRuns.find((l) => {
      const last = l[l.length - 1]
      return (
        Math.abs(last.base - r.base) < 0.3 * r.size &&
        Math.abs(last.size - r.size) < 0.2 * r.size &&
        r.x0 - last.x1 < r.size
      )
    })
    if (line) line.push(r)
    else lineRuns.push([r])
  }

  const words: Word[] = []
  const lines: PageData['lines'] = []
  lineRuns.sort((p, q) => p[0].base - q[0].base || p[0].x0 - q[0].x0)
  lineRuns.forEach((l, li) => {
    const ws = l.flatMap((r) => r.words).sort((p, q) => p.x0 - q.x0)
    for (const w of ws) words.push({ ...w, line: li })
    lines.push({
      text: ws.map((w) => w.text).join(' '),
      rect: {
        x0: Math.min(...ws.map((w) => w.x0)),
        y0: Math.min(...ws.map((w) => w.y0)),
        x1: Math.max(...ws.map((w) => w.x1)),
        y1: Math.max(...ws.map((w) => w.y1)),
      },
    })
  })
  return { words, lines }
}
