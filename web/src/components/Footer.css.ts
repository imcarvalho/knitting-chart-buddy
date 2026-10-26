import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

const narrow = 'screen and (max-width: 640px)'

/**
 * Stays at the bottom of the viewport and the page scrolls under it. On a phone that costs
 * too much screen, so there it scrolls with the content (still at the bottom of short pages).
 */
export const footer = style({
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 32,
  padding: '16px 0 calc(16px + env(safe-area-inset-bottom))',
  background: vars.color.bg,
  borderTop: `2px solid ${vars.color.border}`,
  color: vars.color.muted,
  fontSize: '0.9em',
  '@media': { [narrow]: { position: 'static' } },
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
