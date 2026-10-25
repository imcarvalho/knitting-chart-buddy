import type { Settings } from '../state/storage'
import { themeNames, themes } from '../styles/themes'
import { field } from '../styles/ui.css'
import * as s from './SettingsPanel.css'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  wakeLockSupported: boolean
  wakeLockActive: boolean
}

export function SettingsPanel({ settings, onChange, wakeLockSupported, wakeLockActive }: Props) {
  return (
    <fieldset className={s.settings}>
      <legend>Display</legend>
      <label>
        Theme{' '}
        <select
          className={field}
          value={settings.theme}
          onChange={(e) => onChange({ ...settings, theme: e.target.value as Settings['theme'] })}
        >
          {themeNames.map((name) => (
            <option key={name} value={name}>
              {themes[name].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.largeText}
          onChange={(e) => onChange({ ...settings, largeText: e.target.checked })}
        />{' '}
        Large text
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.wakeLock}
          disabled={!wakeLockSupported}
          onChange={(e) => onChange({ ...settings, wakeLock: e.target.checked })}
        />{' '}
        Keep the screen on
        {!wakeLockSupported ? ' (not supported here)' : settings.wakeLock && wakeLockActive ? ' (on)' : ''}
      </label>
    </fieldset>
  )
}
