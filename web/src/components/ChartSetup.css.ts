import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const form = style({ display: 'grid', gap: 14, maxWidth: 640 })

export const label = style({ display: 'grid', gap: 4, fontWeight: 600 })

export const actions = style({ display: 'flex', gap: 8 })

export const warnings = style({
  border: `2px solid ${vars.color.front}`,
  borderRadius: 10,
  padding: '4px 14px',
})
