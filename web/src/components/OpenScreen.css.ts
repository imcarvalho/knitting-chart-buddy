import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const dropZone = style({
  border: `3px dashed ${vars.color.border}`,
  borderRadius: 14,
  padding: '32px 16px',
  textAlign: 'center',
  background: vars.color.surface,
})

export const dragging = style({ borderColor: vars.color.accent })

export const busy = style({ fontWeight: 600, color: vars.color.accent })

/** Status and error lines are always in the page (for screen readers) but take no space empty. */
export const live = style({ selectors: { '&:empty': { margin: 0 } } })

export const recentList = style({
  listStyle: 'none',
  padding: 0,
  display: 'grid',
  gap: 8,
})
