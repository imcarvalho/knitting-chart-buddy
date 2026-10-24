// Mirrors schema/chart.schema.json.

export type Side = 'RS' | 'WS'
export type Direction = 'rtl' | 'ltr'
export type GroupKind = 'knit' | 'purl' | 'ds' | 'increase' | 'cable'

export interface SymbolDef {
  id: string
  name: string
  abbr: string
  kind: 'stitch' | 'none' | 'ds' | 'increase' | 'cable'
  width: number
  strokes?: [number, number, number, number][]
  marks?: number[]
}

export interface Cell {
  col: number
  symbol: string
  cableId?: string
  arrow?: 'left' | 'right'
}

export interface Group {
  cols: number[]
  kind: GroupKind
  count?: number
  text: string
  short: string
  symbol?: string
  cableId?: string
  legend?: string
  abbr?: string
  cn?: { count: number; hold: 'front' | 'back' }
  steps?: string[]
  verified?: boolean
}

export interface Row {
  number: number
  side: Side
  direction: Direction
  cells: Cell[]
  groups: Group[]
  shortRow?: { start: 'left' | 'right'; startCol: number; turnAfterCol: number }
}

export interface Repeat {
  fromCol: number
  toCol: number
  times: number
  side: 'left' | 'right'
}

export interface Chart {
  id: string
  title: string
  construction: 'flat' | 'round'
  columns: number
  repeats: Repeat[]
  sizeMarkers: { size: number; row: number; kind: 'start' | 'end'; text?: string }[]
  size?: { size: number; startRow: number; endRow: number }
  notes?: string[]
  edgeNote?: string
  rows: Row[]
  warnings: { check: string; severity: 'info' | 'warning'; row: number; message: string }[]
}

export interface PatternDoc {
  pattern: string
  source: { file: string; sha256: string }
  symbols: Record<string, SymbolDef>
  charts: Chart[]
}
