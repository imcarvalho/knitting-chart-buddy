/**
 * Colour primitives: the raw colours of each palette, named for what they are, not for where they
 * are used. Themes (themes.ts) map these onto the app's semantic tokens.
 *
 * To add a theme: add its palette here, then add an entry to `themes` in themes.ts.
 */

/** fairyfloss by sailorhg, https://github.com/sailorhg/fairyfloss (fairyfloss.tmTheme). */
export const fairyfloss = {
  // From the original theme.
  lavender: '#5a5475', // background
  heather: '#716799', // line highlight
  wisteria: '#8077a8', // selection
  cream: '#f8f8f2', // foreground
  candyPink: '#ffb8d1', // keyword
  lilac: '#c5a3ff', // number
  mint: '#c2ffdf', // storage type
  lemon: '#fff352', // function name
  peach: '#ff857f', // function argument
  // Derived shades, to reach WCAG contrast: text 4.5:1 or more, lines and controls 3:1 or more.
  plum: '#4a4463', // darker than lavender: cards and chart cells
  plumInk: '#3b3550', // text on candyPink
  mist: '#e0daf2', // secondary text
  haze: '#b8afdd', // borders of controls
  dusk: '#a99fd0', // chart grid lines
  iris: '#6a5f96', // highlight behind the current group: chart text on it at 5.3:1
} as const

/** Pure black and white with saturated accents, for the high contrast theme. */
export const highContrast = {
  black: '#000000',
  white: '#ffffff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  navy: '#003a8c',
  grey: '#555555',
} as const
