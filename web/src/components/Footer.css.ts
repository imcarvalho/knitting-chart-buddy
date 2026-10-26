import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const footer = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 32,
  paddingTop: 16,
  borderTop: `2px solid ${vars.color.border}`,
  color: vars.color.muted,
  fontSize: '0.9em',
})

export const text = style({ margin: 0 })

export const kofi = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  padding: '0.4em 1em',
  borderRadius: 10,
  border: `2px solid ${vars.color.accent}`,
  background: vars.color.accent,
  color: vars.color.accentText,
  fontWeight: 700,
  textDecoration: 'none',
  selectors: { '&:hover': { textDecoration: 'underline' } },
})

export const icon = style({ flex: 'none' })
