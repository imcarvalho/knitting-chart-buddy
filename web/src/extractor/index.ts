// Chart extraction from a one-page vector PDF, in the browser. TypeScript port of the Python
// extractor in ../../../extractor; a parity test checks both give the same JSON for the fixture.

import type { PatternDoc } from '../types'
import { buildDocument } from './chart'
import { detectGrid } from './grid'
import { loadPage, type LoadOptions, type PdfJs } from './page'
import { loadLegend, recognise, type LegendRaw } from './symbols'

export { ExtractionError } from './errors'

export interface ChartChoices {
  title: string
  chartId: string
  size: number | null
}

/** A recognised chart, waiting for the knitter's choices (title, size) to become a document. */
export interface PreparedChart {
  fileName: string
  sizes: number[] // sizes with a marker on the chart
  defaults: ChartChoices
  build: (choices: ChartChoices) => PatternDoc
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'chart'
  )
}

/** "뒤판 경사뜨기 (back yoke)" -> "Back yoke"; otherwise the file name. */
function guessTitle(notes: string[], fileName: string): string {
  for (const n of notes.slice(0, 2)) {
    const m = /\(([A-Za-z][^)]*)\)\s*$/.exec(n)
    if (m) return m[1][0].toUpperCase() + m[1].slice(1)
  }
  return fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ')
}

export async function prepareChart(
  pdfjs: PdfJs,
  bytes: Uint8Array,
  fileName: string,
  legendRaw: LegendRaw,
  options: LoadOptions = {},
): Promise<PreparedChart> {
  const sha256 = await sha256Hex(bytes) // before pdf.js, which may take over the buffer
  const data = await loadPage(pdfjs, bytes.slice(), options)
  const grid = detectGrid(data)
  const legend = loadLegend(legendRaw)
  const rec = recognise(data, grid, legend)
  const source = { file: fileName, sha256 }

  const probe = buildDocument(data, grid, rec, legend, { chartId: 'chart', title: '' }, source).charts[0]
  const sizes = [...new Set(probe.sizeMarkers.map((m) => m.size))].sort((a, b) => a - b)
  const title = guessTitle(probe.notes ?? [], fileName)
  return {
    fileName,
    sizes,
    defaults: { title, chartId: slug(title), size: sizes.length === 1 ? sizes[0] : null },
    build: (c) => buildDocument(data, grid, rec, legend, { chartId: c.chartId, title: c.title, size: c.size }, source),
  }
}
