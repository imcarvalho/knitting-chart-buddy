import { style, styleVariants } from '@vanilla-extract/css'
import { vars } from '../styles/tokens.css'

export const card = style({
  margin: '14px 0 10px',
  padding: '16px 20px',
  border: `3px solid ${vars.color.highlightOutline}`,
  borderRadius: 14,
  background: vars.color.surface,
  minHeight: '7em',
})

export const position = style({ margin: 0, color: vars.color.muted, fontSize: '0.85em' })

export const text = style({
  margin: '6px 0 0',
  fontSize: '2.2em',
  fontWeight: 700,
  lineHeight: 1.2,
  '@media': { 'screen and (max-width: 640px)': { fontSize: '1.7em' } },
})

/** The full sentence under a cable's facts: smaller, the facts above carry the weight. */
export const cableText = style([text, { fontSize: '1.15em', fontWeight: 600, '@media': { 'screen and (max-width: 640px)': { fontSize: '1.15em' } } }])

export const cableName = style({ margin: '4px 0', fontWeight: 600 })

export const cableMain = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '16px 28px',
})

export const cableFact = style({ margin: 0, fontSize: '1.4em' })

export const cableCount = style({ fontSize: '1.8em', fontWeight: 800 })

const holdWordBase = style({ fontSize: '1.5em', letterSpacing: '0.04em' })

export const holdWord = styleVariants({
  front: [holdWordBase, { color: vars.color.front }],
  back: [holdWordBase, { color: vars.color.back }],
})

export const steps = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 22px',
  margin: '10px 0 0',
  paddingLeft: 0,
  listStylePosition: 'inside',
  fontSize: '1.2em',
  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
})
