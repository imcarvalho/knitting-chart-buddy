import legend from '../../../legend/chart-symbols.json'
import { prepareChart, type PreparedChart } from './index'
import type { LegendRaw } from './symbols'
import type { PdfJs } from './page'

const base = import.meta.env.BASE_URL

/** Reads a chart PDF on this device. pdf.js parses the file in its own worker thread. */
export async function prepareChartFromFile(file: File): Promise<PreparedChart> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const bytes = new Uint8Array(await file.arrayBuffer())
  return prepareChart(pdfjs as unknown as PdfJs, bytes, file.name, legend as LegendRaw, {
    cMapUrl: `${base}pdfjs/cmaps/`,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
  })
}
