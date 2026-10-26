import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { currentGroup, isLastPosition, repeatFor, rowByNumber, upcoming, workedRows } from '../model/navigation'
import { useNavigator, type NavAction } from '../state/navigator'
import type { Chart, PatternDoc } from '../types'
import { ChartStrip } from './ChartStrip'
import { InstructionCard } from './InstructionCard'
import { field, primary, visuallyHidden } from '../styles/ui.css'
import * as s from './RowView.css'

interface Props {
  doc: PatternDoc
  chart: Chart
  patternHash: string
  reducedMotion: boolean
}

const SWIPE_MIN = 60
const APP_TITLE = 'Knitting Chart Buddy'

const sideName = (side: string) => (side === 'RS' ? 'right side' : side === 'WS' ? 'wrong side' : side)

/** Space activates a focused control natively: the shortcut must not take it over. */
function isInteractive(t: EventTarget | null): boolean {
  return t instanceof Element && t.closest('button, a[href], summary, [role="button"], [role="link"]') !== null
}

export function RowView({ doc, chart, patternHash, reducedMotion }: Props) {
  const { pos, canUndo, dispatch } = useNavigator(chart, patternHash)
  const row = rowByNumber(chart, pos.row)
  const group = currentGroup(chart, pos)
  const next = upcoming(chart, pos)
  const repeat = group ? repeatFor(chart, group) : undefined
  const rows = workedRows(chart)
  const atEnd = isLastPosition(chart, pos)

  const jumpInput = useRef<HTMLInputElement>(null)
  const [jumpValue, setJumpValue] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Opening a chart moves focus to its heading, so screen readers start from the chart.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // What a screen reader hears after each step: the group, plus the row, side and direction when
  // the row changes. The group position makes two identical groups in a row ("Purl 2") distinct.
  const lastRow = useRef<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (!row) return
    const rowChanged = lastRow.current !== row.number
    lastRow.current = row.number
    const what = group ? `${group.text}. Group ${pos.group + 1} of ${row.groups.length}.` : 'Nothing to work on this row.'
    const dir = row.direction === 'rtl' ? 'right to left' : 'left to right'
    setAnnouncement(rowChanged ? `Row ${row.number}, ${sideName(row.side)}, ${dir}. ${what}` : what)
  }, [row, group, pos.group])

  useEffect(() => {
    document.title = `${chart.title}, row ${pos.row} - ${APP_TITLE}`
    return () => {
      document.title = APP_TITLE
    }
  }, [chart.title, pos.row])

  useEffect(() => {
    const keys: Record<string, NavAction> = {
      ' ': { type: 'next' },
      ArrowRight: { type: 'next' },
      PageDown: { type: 'next' },
      Backspace: { type: 'prev' },
      ArrowLeft: { type: 'prev' },
      PageUp: { type: 'prev' },
      ArrowDown: { type: 'nextRow' },
      ArrowUp: { type: 'prevRow' },
      u: { type: 'undo' },
    }
    const typing = (t: EventTarget | null) =>
      (t instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'button', 'submit'].includes(t.type)) ||
      t instanceof HTMLSelectElement ||
      t instanceof HTMLTextAreaElement
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
      if (e.key === ' ' && isInteractive(e.target)) return
      if (e.key === 'g') {
        e.preventDefault()
        jumpInput.current?.focus()
        jumpInput.current?.select()
        return
      }
      const action = keys[e.key]
      if (!action) return
      e.preventDefault() // no page scroll, no button activation from Space
      dispatch(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  // Touch: tap the left/right half of the card area; swipe up/down for rows.
  const start = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    start.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dy) >= SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
      dispatch({ type: dy < 0 ? 'nextRow' : 'prevRow' })
      return
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const box = e.currentTarget.getBoundingClientRect()
      dispatch({ type: e.clientX - box.left < box.width / 2 ? 'prev' : 'next' })
    }
  }

  const onJump = (e: FormEvent) => {
    e.preventDefault()
    const n = Number.parseInt(jumpValue, 10)
    if (Number.isFinite(n)) dispatch({ type: 'jump', row: n })
    setJumpValue('')
    jumpInput.current?.blur()
  }

  if (!row) return <p>Row {pos.row} is not in this chart.</p>

  const arrow = row.direction === 'rtl' ? '←' : '→'
  const dirText = row.direction === 'rtl' ? 'right to left' : 'left to right'

  return (
    <div className={s.view}>
      <header className={s.header}>
        <div>
          <h2 className={s.title} ref={headingRef} tabIndex={-1}>
            {chart.title}: row {row.number}
          </h2>
          <p className={s.meta}>
            <span className={s.side} aria-hidden="true">
              {row.side}
            </span>
            <span className={visuallyHidden}>{sideName(row.side)}.</span>
            {row.shortRow && (
              <span>
                Short row: turn after column {row.shortRow.turnAfterCol}
                <span className={visuallyHidden}>.</span>
              </span>
            )}
            {chart.size && (
              <span>
                Size {chart.size.size}: rows {chart.size.startRow} to {chart.size.endRow}
                <span className={visuallyHidden}>.</span>
              </span>
            )}
          </p>
        </div>
        <div className={s.direction} aria-label={`Work ${dirText}`} role="img">
          <span className={s.directionArrow} aria-hidden="true">
            {arrow}
          </span>
          <small className={s.directionLabel}>{dirText}</small>
        </div>
      </header>

      <p className={visuallyHidden} aria-live="polite" aria-atomic="true" data-testid="announcer">
        {announcement}
      </p>

      <ChartStrip doc={doc} chart={chart} row={row} group={group} reducedMotion={reducedMotion} />

      <div className={s.tapArea} onPointerDown={onPointerDown} onPointerUp={onPointerUp} data-testid="tap-area">
        <InstructionCard
          doc={doc}
          group={group}
          rowNumber={row.number}
          groupIndex={pos.group}
          groupCount={row.groups.length}
        />
      </div>

      <div>
        <p className={s.nextPreview} data-testid="next-preview">
          {next ? (
            <>
              Next: {next.newRow !== null && <strong>{turnText(row.shortRow)}row {next.newRow}: </strong>}
              {next.group.text}
            </>
          ) : atEnd ? (
            <strong>End of the chart{chart.size ? ` for size ${chart.size.size}` : ''}.</strong>
          ) : null}
        </p>
        {chart.edgeNote && (
          <p className={s.note}>
            <strong>Plus edge stitches, not charted.</strong> {chart.edgeNote}
          </p>
        )}
        {repeat && (
          <p className={s.note}>
            Inside the repeat bracket: work these columns {repeat.times} times in total.
          </p>
        )}
      </div>

      <nav className={s.controls} aria-label="Chart navigation">
        <button type="button" onClick={() => dispatch({ type: 'prevRow' })} disabled={row.number === rows[0]?.number}>
          Prev row
        </button>
        <button type="button" className={s.bigButton} aria-label="Back one group" onClick={() => dispatch({ type: 'prev' })}>
          Back
        </button>
        <button
          type="button"
          className={`${s.bigButton} ${primary}`}
          aria-label="Next group"
          onClick={() => dispatch({ type: 'next' })}
          disabled={atEnd}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'nextRow' })}
          disabled={row.number === rows[rows.length - 1]?.number}
        >
          Next row
        </button>
        <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo}>
          Undo
        </button>
        <form className={s.jump} onSubmit={onJump}>
          <label htmlFor="jump-row">Row</label>
          <input
            id="jump-row"
            className={`${field} ${s.jumpInput}`}
            ref={jumpInput}
            type="number"
            inputMode="numeric"
            min={rows[0]?.number}
            max={rows[rows.length - 1]?.number}
            value={jumpValue}
            placeholder={String(row.number)}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setJumpValue('')
                e.currentTarget.blur()
              }
            }}
          />
          <button type="submit">Go</button>
        </form>
      </nav>
      <p className={s.hint}>
        Space, → or Page Down: next. Backspace, ← or Page Up: back. ↑ ↓: rows. g: go to row. u: undo.
      </p>
    </div>
  )
}

function turnText(shortRow: { turnAfterCol: number } | undefined): string {
  return shortRow ? 'turn, then ' : ''
}
