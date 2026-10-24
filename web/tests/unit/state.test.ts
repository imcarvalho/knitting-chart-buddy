import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialPosition, navReducer, UNDO_LIMIT, type NavState } from '../../src/state/navigator'
import { loadDoc, loadProgress, loadRecent, rememberDoc, saveProgress } from '../../src/state/storage'
import { backYoke as chart, sample } from './sample'

const start: NavState = { pos: { row: 1, group: 0 }, history: [] }
const reduce = navReducer(chart)

describe('navigator reducer', () => {
  it('records history and undoes', () => {
    let s = reduce(start, { type: 'next' })
    s = reduce(s, { type: 'next' })
    expect(s.pos).toEqual({ row: 1, group: 2 })
    s = reduce(s, { type: 'undo' })
    expect(s.pos).toEqual({ row: 1, group: 1 })
    s = reduce(s, { type: 'undo' })
    expect(s.pos).toEqual({ row: 1, group: 0 })
    expect(reduce(s, { type: 'undo' })).toBe(s)
  })

  it('undoes a jump', () => {
    const s = reduce(reduce(start, { type: 'jump', row: 50 }), { type: 'undo' })
    expect(s.pos).toEqual(start.pos)
  })

  it('keeps a short history', () => {
    let s = start
    for (let i = 0; i < UNDO_LIMIT + 10; i++) s = reduce(s, { type: 'next' })
    expect(s.history).toHaveLength(UNDO_LIMIT)
  })

  it('does not record moves that go nowhere', () => {
    expect(reduce(start, { type: 'prev' })).toBe(start)
  })
})

describe('persistence', () => {
  afterEach(() => vi.restoreAllMocks())

  it('saves and restores the position', () => {
    saveProgress({ patternHash: 'abc', chartId: chart.id, row: 12, groupIndex: 3 })
    expect(loadProgress('abc', chart.id)).toMatchObject({ row: 12, groupIndex: 3 })
    expect(initialPosition(chart, 'abc')).toEqual({ row: 12, group: 3 })
    expect(initialPosition(chart, 'other')).toEqual({ row: 1, group: 0 })
  })

  it('survives a broken localStorage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => saveProgress({ patternHash: 'x', chartId: 'y', row: 1, groupIndex: 0 })).not.toThrow()
    expect(loadProgress('x', 'y')).toBeUndefined()
  })

  it('remembers opened charts', async () => {
    await rememberDoc(sample, chart.id)
    expect(loadRecent()[0]).toMatchObject({ patternHash: sample.source.sha256, chartId: 'back-yoke', title: 'Back yoke' })
    expect((await loadDoc(sample.source.sha256))?.charts[0].rows).toHaveLength(79)
  })
})
