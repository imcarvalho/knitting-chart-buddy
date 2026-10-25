import { globalStyle, type GlobalStyleRule } from '@vanilla-extract/css'
import { vars } from './tokens.css'

/** The look of a button, shared by <button> and by labels styled as buttons (ui.css.ts). */
export const buttonBase: GlobalStyleRule = {
  display: 'inline-block',
  minHeight: 44,
  padding: '0.4em 1em',
  border: `2px solid ${vars.color.border}`,
  borderRadius: 10,
  background: vars.color.surface,
  color: vars.color.text,
  cursor: 'pointer',
}

globalStyle('*', { boxSizing: 'border-box' })

globalStyle('html, body', {
  margin: 0,
  background: vars.color.bg,
  color: vars.color.text,
  font: `400 ${vars.font.baseSize} / 1.45 system-ui, -apple-system, 'Segoe UI', sans-serif`,
})

globalStyle('button, input, select', { font: 'inherit' })

globalStyle('button', buttonBase)

globalStyle('button:disabled', { opacity: 0.45, cursor: 'default' })

globalStyle(':focus-visible', {
  outline: `3px solid ${vars.color.focus}`,
  outlineOffset: 2,
})

globalStyle('*', {
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      scrollBehavior: 'auto',
      transition: 'none !important',
      animation: 'none !important',
    },
  },
})
