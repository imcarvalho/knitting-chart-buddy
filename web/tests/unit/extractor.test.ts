// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import legend from '../../../legend/chart-symbols.json'
import { ExtractionError, prepareChart } from '../../src/extractor'
import type { PdfJs } from '../../src/extractor/page'
import type { LegendRaw } from '../../src/extractor/symbols'
import type { PatternDoc } from '../../src/types'

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const FIXTURE = path('../../../fixtures/Shanon_Sweater_tamanho3-back.pdf')
const PYTHON_OUTPUT = path('../fixtures/back-yoke.json')
const PDFJS = path('../../node_modules/pdfjs-dist/')
const options = { cMapUrl: `${PDFJS}cmaps/`, standardFontDataUrl: `${PDFJS}standard_fonts/` }

const prepare = (bytes: Uint8Array, name = 'Shanon_Sweater_tamanho3-back.pdf') =>
  prepareChart(pdfjs as unknown as PdfJs, bytes, name, legend as LegendRaw, options)

// The pattern PDF is not in the repository: these tests run only where a copy is in fixtures/.
describe.skipIf(!existsSync(FIXTURE))('TypeScript extractor on the back yoke fixture', () => {
  it('gives exactly the same JSON as the Python extractor', async () => {
    const prepared = await prepare(new Uint8Array(readFileSync(FIXTURE)))
    const doc = prepared.build({ chartId: 'back-yoke', title: 'Back yoke', size: 3 })
    const python: PatternDoc = JSON.parse(readFileSync(PYTHON_OUTPUT, 'utf8'))
    // Compare piece by piece first, for a readable failure.
    const [ts, py] = [doc.charts[0], python.charts[0]]
    expect(ts.rows.length).toBe(py.rows.length)
    for (let i = 0; i < py.rows.length; i++) expect(ts.rows[i], `row ${py.rows[i].number}`).toEqual(py.rows[i])
    expect(ts.warnings).toEqual(py.warnings)
    expect(doc).toEqual(python)
  }, 30_000)

  it('suggests a title, id and the only size marked on the chart', async () => {
    const prepared = await prepare(new Uint8Array(readFileSync(FIXTURE)))
    expect(prepared.sizes).toEqual([3])
    expect(prepared.defaults).toEqual({ title: 'Back yoke', chartId: 'back-yoke', size: 3 })
  }, 30_000)
})

describe('TypeScript extractor errors', () => {
  it('rejects a two-page PDF', async () => {
    await expect(prepare(twoPagePdf(), 'two.pdf')).rejects.toThrow(/single-page/)
  })

  it('rejects something that is not a PDF', async () => {
    await expect(prepare(new TextEncoder().encode('hello'), 'x.pdf')).rejects.toBeInstanceOf(ExtractionError)
  })
})

/** A minimal, valid two-page PDF. */
function twoPagePdf(): Uint8Array {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}
