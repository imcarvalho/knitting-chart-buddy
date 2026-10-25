import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const scroller = style({
  overflowX: 'auto',
  border: `2px solid ${vars.color.border}`,
  borderRadius: 10,
  background: vars.color.surface,
  padding: 6,
})

export const strip = style({ display: 'block' })

/** The rows above and below, for context. */
export const contextRow = style({ opacity: 0.4 })

export const cell = style({
  fill: vars.color.cellBg,
  stroke: vars.color.cellLine,
  strokeWidth: 0.6,
})

/** Cells of the current row: transparent, so the highlight drawn behind them shows through. */
export const cellMain = style([cell, { fill: 'transparent' }])

/** No stitch (outside a short row): filled, in every row. */
export const cellNone = style([cell, { fill: vars.color.cellNone }])

export const purl = style({ fill: vars.color.ink })

export const cellText = style({ fill: vars.color.ink, fontWeight: 700 })

export const glyphLine = style({
  stroke: vars.color.ink,
  strokeWidth: 1.6,
  strokeLinecap: 'round',
})

export const glyphLineLarge = style([glyphLine, { strokeWidth: 3 }])

export const colNum = style({ fill: vars.color.muted, fontSize: 10, fontWeight: 400 })

export const highlightBg = style({ fill: vars.color.highlightBg })

export const highlightOutline = style({
  fill: 'none',
  stroke: vars.color.highlightOutline,
  strokeWidth: 3,
})

export const repeatPath = style({ fill: 'none', stroke: vars.color.accent })

export const repeatText = style({ fill: vars.color.accent, fontSize: 10 })

export const glyphLargeCell = style({ fill: vars.color.cellBg, stroke: vars.color.cellLine })
