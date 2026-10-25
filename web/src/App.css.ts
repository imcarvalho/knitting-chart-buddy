import { style } from '@vanilla-extract/css'
import { vars } from './styles/tokens.css'

export const app = style({
  maxWidth: 1100,
  margin: '0 auto',
  padding: '0 16px 32px',
})

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 0',
})

export const title = style({
  fontSize: '1.1em',
  margin: 0,
  color: vars.color.accent,
})

export const actions = style({ display: 'flex', gap: 8 })
