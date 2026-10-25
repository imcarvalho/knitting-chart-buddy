import { style } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const settings = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'center',
  border: `2px solid ${vars.color.border}`,
  borderRadius: 10,
  margin: '0 0 16px',
})
