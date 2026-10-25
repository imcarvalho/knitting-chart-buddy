import { createGlobalTheme, createThemeContract, globalStyle } from '@vanilla-extract/css'
import { DEFAULT_THEME, themeNames, themes, type ThemeColors } from './themes'

const colorKeys: Record<keyof ThemeColors, null> = {
  bg: null,
  surface: null,
  text: null,
  muted: null,
  border: null,
  accent: null,
  accentText: null,
  cellBg: null,
  cellLine: null,
  cellNone: null,
  ink: null,
  highlightBg: null,
  highlightOutline: null,
  front: null,
  back: null,
  focus: null,
}

/** CSS custom properties for the semantic tokens. Styles use these, never palette colours. */
export const vars = createThemeContract({
  color: colorKeys,
  font: { baseSize: null },
})

// The active theme is chosen with <html data-theme="...">. The default theme also applies when the
// attribute is missing, so the first paint is never unstyled.
for (const name of themeNames) {
  const theme = themes[name]
  const selector = name === DEFAULT_THEME ? `:root, :root[data-theme='${name}']` : `:root[data-theme='${name}']`
  createGlobalTheme(selector, vars.color, theme.colors)
  globalStyle(selector, { colorScheme: theme.colorScheme })
}

createGlobalTheme(':root', vars.font, { baseSize: '17px' })
createGlobalTheme(':root.large-text', vars.font, { baseSize: '22px' })
