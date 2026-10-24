import type { Settings } from '../state/storage'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  wakeLockSupported: boolean
  wakeLockActive: boolean
}

export function SettingsPanel({ settings, onChange, wakeLockSupported, wakeLockActive }: Props) {
  return (
    <fieldset className="settings">
      <legend>Display</legend>
      <label>
        Theme{' '}
        <select
          value={settings.theme}
          onChange={(e) => onChange({ ...settings, theme: e.target.value as Settings['theme'] })}
        >
          <option value="auto">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="contrast">High contrast</option>
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
