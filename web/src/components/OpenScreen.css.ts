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

export const recentList = style({
  listStyle: 'none',
  padding: 0,
  display: 'grid',
  gap: 8,
})
