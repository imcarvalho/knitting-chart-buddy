import { useEffect, useRef } from 'react'
import type { Cell, Chart, Group, PatternDoc, Row } from '../types'
import { rowByNumber } from '../model/navigation'

const CW = 26 // cell width
const CH_MAIN = 30
const CH_CONTEXT = 16
const NUM_H = 16

interface Props {
  doc: PatternDoc
  chart: Chart
  row: Row
  group: Group | undefined
  reducedMotion: boolean
}

/** The current row as a strip of cells, with the rows above and below dimmed, redrawn from the JSON. */
export function ChartStrip({ doc, chart, row, group, reducedMotion }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const above = rowByNumber(chart, row.number + 1)
  const below = rowByNumber(chart, row.number - 1)
  const cols = row.cells.map((c) => c.col)
  const width = cols.length * CW
  const yAbove = 0
  const yMain = CH_CONTEXT + 4
  const yBelow = yMain + CH_MAIN + 4
  const yNums = yBelow + CH_CONTEXT + 2
  const height = yNums + NUM_H

  const hl = group ? highlightBox(cols, group.cols) : null

  useEffect(() => {
    const el = scroller.current
    if (!el || !hl) return
    const centre = (hl.x0 + hl.x1) / 2
    const target = Math.max(0, centre - el.clientWidth / 2)
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: target, behavior: reducedMotion ? 'auto' : 'smooth' })
    } else {
      el.scrollLeft = target
    }
  }, [hl?.x0, hl?.x1, reducedMotion])

  const label = `Row ${row.number}${group ? `, current group on column${group.cols.length > 1 ? 's' : ''} ${group.cols.join(', ')}` : ''}`

  return (
    <div className="strip-scroller" ref={scroller}>
      <svg
        className="strip"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {above && <RowCells doc={doc} row={above} y={yAbove} h={CH_CONTEXT} context />}
        {hl && (
          <rect
            className="hl-bg"
            x={hl.x0}
            y={yMain}
            width={hl.x1 - hl.x0}
            height={CH_MAIN}
            data-testid="highlight"
          />
        )}
        <RowCells doc={doc} row={row} y={yMain} h={CH_MAIN} />
        {hl && (
          <rect
            className="hl-outline"
            x={hl.x0 - 2}
            y={yMain - 2}
            width={hl.x1 - hl.x0 + 4}
            height={CH_MAIN + 4}
            rx={3}
          />
        )}
        {below && <RowCells doc={doc} row={below} y={yBelow} h={CH_CONTEXT} context />}
        {cols.map((c, i) => (
          <text key={c} className="col-num" x={i * CW + CW / 2} y={yNums + NUM_H - 4} textAnchor="middle">
            {c}
          </text>
        ))}
        {chart.repeats.map((r, k) => {
          const box = highlightBox(cols, [r.fromCol, r.toCol])
          if (!box) return null
          return (
            <g key={k} className="repeat">
              <path d={`M${box.x0 + 2} ${yBelow + 2} v-3 H${box.x1 - 2} v3`} />
              <text x={(box.x0 + box.x1) / 2} y={yBelow + 12} textAnchor="middle">
                ×{r.times}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function highlightBox(cols: number[], groupCols: number[]): { x0: number; x1: number } | null {
  const idx = groupCols.map((c) => cols.indexOf(c)).filter((i) => i >= 0)
  if (idx.length === 0) return null
  return { x0: Math.min(...idx) * CW, x1: (Math.max(...idx) + 1) * CW }
}

function RowCells({ doc, row, y, h, context }: { doc: PatternDoc; row: Row; y: number; h: number; context?: boolean }) {
  const drawnGlyphs = new Set<string>()
  return (
    <g className={context ? 'row context' : 'row main'} data-row={row.number}>
      {row.cells.map((cell, i) => (
        <CellShape key={cell.col} cell={cell} x={i * CW} y={y} h={h} />
      ))}
      {row.cells.map((cell, i) => {
        // Glyph symbols (cables, increases) are drawn once, across all their cells.
        const sym = doc.symbols[cell.symbol === 'cable' ? glyphSymbol(row, cell) ?? '' : cell.symbol]
        if (!sym?.strokes) return null
        const key = cell.cableId ?? `${row.number}-${cell.col}`
        if (drawnGlyphs.has(key)) return null
        drawnGlyphs.add(key)
        return <GlyphStrokes key={key} strokes={sym.strokes} marks={sym.marks ?? []} x={i * CW} y={y} w={CW} h={h} />
      })}
    </g>
  )
}

function glyphSymbol(row: Row, cell: Cell): string | undefined {
  return row.groups.find((g) => g.cableId === cell.cableId)?.symbol
}

function CellShape({ cell, x, y, h }: { cell: Cell; x: number; y: number; h: number }) {
  return (
    <g>
      <rect className={cell.symbol === 'none' ? 'cell none' : 'cell'} x={x} y={y} width={CW} height={h} />
      {cell.symbol === 'purl' && (
        <rect className="purl" x={x + CW * 0.3} y={y + h * 0.42} width={CW * 0.4} height={Math.max(2, h * 0.16)} />
      )}
      {cell.symbol === 'ds' && (
        <text className="ds" x={x + CW / 2} y={y + h * 0.68} textAnchor="middle" fontSize={h * 0.45}>
          DS
        </text>
      )}
      {cell.arrow && (
        <text className="arrow" x={x + CW / 2} y={y + h * 0.72} textAnchor="middle" fontSize={h * 0.6}>
          {cell.arrow === 'left' ? '←' : '→'}
        </text>
      )}
    </g>
  )
}

export function GlyphStrokes({
  strokes,
  marks,
  x,
  y,
  w,
  h,
}: {
  strokes: [number, number, number, number][]
  marks: number[]
  x: number
  y: number
  w: number
  h: number
}) {
  return (
    <g className="glyph">
      {strokes.map(([x0, y0, x1, y1], k) => (
        <line key={k} x1={x + x0 * w} y1={y + y0 * h} x2={x + x1 * w} y2={y + y1 * h} />
      ))}
      {marks.map((m) => (
        <line key={`m${m}`} className="mark" x1={x + (m + 0.3) * w} y1={y + 0.86 * h} x2={x + (m + 0.7) * w} y2={y + 0.86 * h} />
      ))}
    </g>
  )
}

/** A cable glyph drawn large, on its own grid. */
export function GlyphCard({ doc, symbolId }: { doc: PatternDoc; symbolId: string }) {
  const sym = doc.symbols[symbolId]
  if (!sym?.strokes) return null
  const w = 48
  const h = 48
  return (
    <svg
      className="glyph-large"
      width={sym.width * w + 4}
      height={h + 4}
      viewBox={`-2 -2 ${sym.width * w + 4} ${h + 4}`}
      aria-hidden="true"
    >
      {Array.from({ length: sym.width }, (_, i) => (
        <rect key={i} className="cell" x={i * w} y={0} width={w} height={h} />
      ))}
      <GlyphStrokes strokes={sym.strokes} marks={sym.marks ?? []} x={0} y={0} w={w} h={h} />
    </svg>
  )
}
