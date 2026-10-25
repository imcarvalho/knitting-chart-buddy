import { fairyfloss as ff, highContrast as hc } from './palettes'

/** Semantic colour tokens. Every theme gives a value for each one (see tokens.css.ts). */
export interface ThemeColors {
  bg: string
  surface: string
  text: string
  muted: string
  border: string
  accent: string
  accentText: string
  cellBg: string
  cellLine: string
  cellNone: string
  ink: string
  highlightBg: string
  highlightOutline: string
  front: string
  back: string
  focus: string
}

export interface Theme {
  /** Shown in the settings menu. */
  label: string
  colorScheme: 'light' | 'dark'
  colors: ThemeColors
}

export const themes = {
  fairyfloss: {
    label: 'Fairyfloss',
    colorScheme: 'dark',
    colors: {
      bg: ff.lavender,
      surface: ff.plum,
      text: ff.cream,
      muted: ff.mist,
      border: ff.haze,
      accent: ff.candyPink,
      accentText: ff.plumInk,
      cellBg: ff.plum,
      cellLine: ff.dusk,
      cellNone: ff.heather,
      ink: ff.cream,
      highlightBg: ff.wisteria,
      highlightOutline: ff.lemon,
      front: ff.candyPink,
      back: ff.mint,
      focus: ff.mint,
    },
  },
  contrast: {
    label: 'High contrast',
    colorScheme: 'dark',
    colors: {
      bg: hc.black,
      surface: hc.black,
      text: hc.white,
      muted: hc.white,
      border: hc.white,
      accent: hc.yellow,
      accentText: hc.black,
      cellBg: hc.black,
      cellLine: hc.white,
      cellNone: hc.grey,
      ink: hc.white,
      highlightBg: hc.navy,
      highlightOutline: hc.yellow,
      front: hc.yellow,
      back: hc.cyan,
      focus: hc.yellow,
    },
  },
} satisfies Record<string, Theme>

export type ThemeName = keyof typeof themes

export const DEFAULT_THEME: ThemeName = 'fairyfloss'

export const themeNames = Object.keys(themes) as ThemeName[]

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && Object.hasOwn(themes, value)
}
