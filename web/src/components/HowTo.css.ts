import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const howTo = style({
  border: `2px solid ${vars.color.border}`,
  borderRadius: 10,
  background: vars.color.surface,
  padding: '4px 20px 12px',
  margin: '16px 0',
  maxWidth: '70ch',
})

export const steps = style({ paddingLeft: '1.4em', display: 'grid', gap: 10 })

export const keys = style({ color: vars.color.muted })
