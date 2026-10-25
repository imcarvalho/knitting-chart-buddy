import { style } from '@vanilla-extract/css'
import { buttonBase } from './global.css'
import { vars } from './tokens.css'

/** For elements that are not buttons but should look like one (a file input's label). */
export const buttonLike = style(buttonBase)

/** The main action: filled with the accent colour. Use on a <button> or with buttonLike. */
export const primary = style({
  background: vars.color.accent,
  borderColor: vars.color.accent,
  color: vars.color.accentText,
})

/** Text inputs and selects. */
export const field = style({
  minHeight: 44,
  border: `2px solid ${vars.color.border}`,
  borderRadius: 8,
  background: vars.color.surface,
  color: vars.color.text,
  padding: '0 0.5em',
  fontWeight: 400,
})

export const visuallyHidden = style({
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
})

export const muted = style({ color: vars.color.muted })

export const errorText = style({ color: vars.color.front, fontWeight: 600 })
