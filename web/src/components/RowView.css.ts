import { globalStyle, style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

const narrow = 'screen and (max-width: 640px)'

/** The row view's sections, spaced by the gap alone: they set no outer margins of their own. */
export const view = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  '@media': { [narrow]: { gap: 12 } },
})

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
})

export const title = style({ margin: 0, fontSize: '1.5em' })

export const meta = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px 14px',
  margin: '4px 0 0',
  color: vars.color.muted,
})

export const side = style({
  fontWeight: 700,
  padding: '0 0.5em',
  borderRadius: 6,
  border: '2px solid currentColor',
})

export const direction = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: vars.color.accent,
  lineHeight: 1,
})

export const directionArrow = style({ fontSize: '3.4em', fontWeight: 700 })

export const directionLabel = style({ color: vars.color.muted, fontSize: '0.75em' })

export const tapArea = style({ touchAction: 'pan-x', userSelect: 'none' })

export const nextPreview = style({ fontSize: '1.1em', margin: '0 0 6px' })

export const note = style({ margin: '4px 0 0', color: vars.color.muted, fontSize: '0.85em' })

export const controls = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
})

/** Every button and input in the bar shares the height of Back and Next. */
const controlHeight = 56

globalStyle(`${controls} button, ${controls} input`, { minHeight: controlHeight })

/** Back and Next: the two buttons used all the time. On a phone they go first, side by side. */
export const bigButton = style({
  minWidth: '7em',
  fontSize: '1.15em',
  fontWeight: 700,
  '@media': { [narrow]: { flex: '1 1 40%', order: -1 } },
})

export const jump = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginLeft: 'auto',
  '@media': { [narrow]: { marginLeft: 0 } },
})

export const jumpInput = style({ width: '5em' })

export const hint = style({ margin: 0, color: vars.color.muted, fontSize: '0.8em' })
