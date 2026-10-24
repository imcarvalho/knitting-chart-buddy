import type { Chart, Group, PatternDoc, Repeat, Row } from '../types'

/** Where the knitter is: a row number and the index of the current group in that row. */
export interface Position {
  row: number
  group: number
}

/** Rows the knitter works, in order: the size range if the chart has one, else every row. */
export function workedRows(chart: Chart): Row[] {
  const rows = [...chart.rows].sort((a, b) => a.number - b.number)
  if (!chart.size) return rows
  const { startRow, endRow } = chart.size
  return rows.filter((r) => r.number >= startRow && r.number <= endRow)
}

export function rowByNumber(chart: Chart, n: number): Row | undefined {
  return chart.rows.find((r) => r.number === n)
}

export function firstPosition(chart: Chart): Position {
  const rows = workedRows(chart)
  return { row: rows[0]?.number ?? 1, group: 0 }
}

/** Clamp a stored or typed position to something that exists in the chart. */
export function clampPosition(chart: Chart, pos: Position): Position {
  const rows = workedRows(chart)
  if (rows.length === 0) return { row: pos.row, group: 0 }
  const row = rows.find((r) => r.number === pos.row)
  if (!row) {
    const nearest = rows.find((r) => r.number > pos.row) ?? rows[rows.length - 1]
    return { row: nearest.number, group: 0 }
  }
  const last = Math.max(0, row.groups.length - 1)
  return { row: row.number, group: Math.min(Math.max(0, pos.group), last) }
}

function rowIndex(rows: Row[], n: number): number {
  return rows.findIndex((r) => r.number === n)
}

/** Next group; at the end of a row, the first group of the next row. Stays put at the very end. */
export function nextGroup(chart: Chart, pos: Position): Position {
  const rows = workedRows(chart)
  const i = rowIndex(rows, pos.row)
  if (i < 0) return clampPosition(chart, pos)
  if (pos.group < rows[i].groups.length - 1) return { row: pos.row, group: pos.group + 1 }
  if (i < rows.length - 1) return { row: rows[i + 1].number, group: 0 }
  return pos
}

/** Previous group; at the start of a row, the last group of the previous row. */
export function prevGroup(chart: Chart, pos: Position): Position {
  const rows = workedRows(chart)
  const i = rowIndex(rows, pos.row)
  if (i < 0) return clampPosition(chart, pos)
  if (pos.group > 0) return { row: pos.row, group: pos.group - 1 }
  if (i > 0) return { row: rows[i - 1].number, group: Math.max(0, rows[i - 1].groups.length - 1) }
  return pos
}

export function nextRow(chart: Chart, pos: Position): Position {
  const rows = workedRows(chart)
  const i = rowIndex(rows, pos.row)
  if (i >= 0 && i < rows.length - 1) return { row: rows[i + 1].number, group: 0 }
  return { row: pos.row, group: 0 }
}

export function prevRow(chart: Chart, pos: Position): Position {
  const rows = workedRows(chart)
  const i = rowIndex(rows, pos.row)
  if (i > 0) return { row: rows[i - 1].number, group: 0 }
  return { row: pos.row, group: 0 }
}

export function jumpToRow(chart: Chart, n: number): Position {
  return clampPosition(chart, { row: n, group: 0 })
}

export function isLastPosition(chart: Chart, pos: Position): boolean {
  const next = nextGroup(chart, pos)
  return next.row === pos.row && next.group === pos.group
}

export function currentGroup(chart: Chart, pos: Position): Group | undefined {
  return rowByNumber(chart, pos.row)?.groups[pos.group]
}

/** The group after the current one (possibly on the next row), for the preview. */
export function upcoming(chart: Chart, pos: Position): { group: Group; newRow: number | null } | undefined {
  const next = nextGroup(chart, pos)
  if (next.row === pos.row && next.group === pos.group) return undefined
  const group = currentGroup(chart, next)
  if (!group) return undefined
  return { group, newRow: next.row !== pos.row ? next.row : null }
}

export function repeatFor(chart: Chart, group: Group): Repeat | undefined {
  return chart.repeats.find((r) => {
    const lo = Math.min(r.fromCol, r.toCol)
    const hi = Math.max(r.fromCol, r.toCol)
    return group.cols.some((c) => c >= lo && c <= hi)
  })
}

/** Identifies a pattern document: the hash of its source PDF. */
export function patternHash(doc: PatternDoc): string {
  return doc.source.sha256
}
