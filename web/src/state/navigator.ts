import { useCallback, useEffect, useReducer } from 'react'
import {
  clampPosition,
  firstPosition,
  jumpToRow,
  nextGroup,
  nextRow,
  prevGroup,
  prevRow,
  type Position,
} from '../model/navigation'
import type { Chart } from '../types'
import { loadProgress, saveProgress } from './storage'

export const UNDO_LIMIT = 20

export type NavAction =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'nextRow' }
  | { type: 'prevRow' }
  | { type: 'jump'; row: number }
  | { type: 'undo' }

export interface NavState {
  pos: Position
  history: Position[] // positions before each move, most recent last
}

export function navReducer(chart: Chart) {
  return (state: NavState, action: NavAction): NavState => {
    if (action.type === 'undo') {
      if (state.history.length === 0) return state
      return { pos: state.history[state.history.length - 1], history: state.history.slice(0, -1) }
    }
    const move = {
      next: () => nextGroup(chart, state.pos),
      prev: () => prevGroup(chart, state.pos),
      nextRow: () => nextRow(chart, state.pos),
      prevRow: () => prevRow(chart, state.pos),
      jump: () => jumpToRow(chart, (action as { row: number }).row),
    }[action.type]
    const pos = move()
    if (pos.row === state.pos.row && pos.group === state.pos.group) return state
    return { pos, history: [...state.history, state.pos].slice(-UNDO_LIMIT) }
  }
}

export function initialPosition(chart: Chart, patternHash: string): Position {
  const saved = loadProgress(patternHash, chart.id)
  if (!saved) return firstPosition(chart)
  return clampPosition(chart, { row: saved.row, group: saved.groupIndex })
}

/** Position in a chart, with undo, saved after every step. */
export function useNavigator(chart: Chart, patternHash: string) {
  const [state, dispatch] = useReducer(navReducer(chart), undefined, () => ({
    pos: initialPosition(chart, patternHash),
    history: [],
  }))

  useEffect(() => {
    saveProgress({ patternHash, chartId: chart.id, row: state.pos.row, groupIndex: state.pos.group })
  }, [patternHash, chart.id, state.pos])

  const act = useCallback((a: NavAction) => dispatch(a), [])
  return { pos: state.pos, canUndo: state.history.length > 0, dispatch: act }
}
