import { describe, expect, it } from 'vitest'
import {
  clampPosition,
  currentGroup,
  describeColumns,
  firstPosition,
  isLastPosition,
  jumpToRow,
  nextGroup,
  nextRow,
  prevGroup,
  prevRow,
  upcoming,
  workedRows,
} from '../../src/model/navigation'
import { backYoke as chart } from './sample'

const row = (n: number) => chart.rows.find((r) => r.number === n)!

describe('navigation', () => {
  it('starts at row 1, first group', () => {
    expect(firstPosition(chart)).toEqual({ row: 1, group: 0 })
    expect(currentGroup(chart, { row: 1, group: 0 })?.text).toBe('Purl 2')
  })

  it('works only the size range (rows 1 to 77 for size 3)', () => {
    const rows = workedRows(chart)
    expect(rows[0].number).toBe(1)
    expect(rows[rows.length - 1].number).toBe(77)
  })

  it('advances group by group and wraps to the next row', () => {
    const last = row(1).groups.length - 1
    expect(nextGroup(chart, { row: 1, group: 0 })).toEqual({ row: 1, group: 1 })
    expect(nextGroup(chart, { row: 1, group: last })).toEqual({ row: 2, group: 0 })
  })

  it('goes back across a row boundary to the last group', () => {
    expect(prevGroup(chart, { row: 2, group: 0 })).toEqual({ row: 1, group: row(1).groups.length - 1 })
    expect(prevGroup(chart, { row: 1, group: 0 })).toEqual({ row: 1, group: 0 })
  })

  it('stops at the end row', () => {
    const end = { row: 77, group: row(77).groups.length - 1 }
    expect(nextGroup(chart, end)).toEqual(end)
    expect(isLastPosition(chart, end)).toBe(true)
    expect(upcoming(chart, end)).toBeUndefined()
  })

  it('moves by rows', () => {
    expect(nextRow(chart, { row: 5, group: 3 })).toEqual({ row: 6, group: 0 })
    expect(prevRow(chart, { row: 5, group: 3 })).toEqual({ row: 4, group: 0 })
    expect(prevRow(chart, { row: 1, group: 2 })).toEqual({ row: 1, group: 0 })
  })

  it('jumps and clamps', () => {
    expect(jumpToRow(chart, 40)).toEqual({ row: 40, group: 0 })
    expect(jumpToRow(chart, 79)).toEqual({ row: 77, group: 0 }) // past the size 3 end
    expect(jumpToRow(chart, -3)).toEqual({ row: 1, group: 0 })
    expect(clampPosition(chart, { row: 2, group: 999 })).toEqual({ row: 2, group: row(2).groups.length - 1 })
  })

  it('previews the next group, flagging a new row', () => {
    expect(upcoming(chart, { row: 1, group: 0 })).toEqual({ group: row(1).groups[1], newRow: null })
    const last = row(1).groups.length - 1
    expect(upcoming(chart, { row: 1, group: last })?.newRow).toBe(2)
  })
})

describe('describeColumns', () => {
  it('names numbered columns by their number', () => {
    expect(describeColumns([9, 10, 11])).toBe('columns 9 to 11')
    expect(describeColumns([4])).toBe('column 4')
  })
  it('names columns right of column 1 by their distance from it', () => {
    expect(describeColumns([0])).toBe('1 column right of column 1')
    expect(describeColumns([-9, -14, -10])).toBe('10 to 15 columns right of column 1')
  })
  it('handles a group that crosses column 1', () => {
    expect(describeColumns([1, 0])).toBe('column 1 and 1 column to its right')
  })
})
