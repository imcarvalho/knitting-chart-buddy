import { useMemo, useState, type FormEvent } from 'react'
import { slug, type PreparedChart } from '../extractor'
import type { PatternDoc } from '../types'
import { field, primary } from '../styles/ui.css'
import * as s from './ChartSetup.css'

interface Props {
  prepared: PreparedChart
  onStart: (doc: PatternDoc) => void
  onCancel: () => void
}

/** After a PDF is read: confirm the chart's name and the size to knit, then start. */
export function ChartSetup({ prepared, onStart, onCancel }: Props) {
  const [title, setTitle] = useState(prepared.defaults.title)
  const [size, setSize] = useState<string>(prepared.defaults.size === null ? '' : String(prepared.defaults.size))
  const preview = useMemo(() => prepared.build({ ...prepared.defaults, size: null }), [prepared])
  const chart = preview.charts[0]
  const warnings = chart.warnings.filter((w) => w.severity === 'warning')
  const cableTypes = Object.values(preview.symbols).filter((s) => s.kind === 'cable').length

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = title.trim() || prepared.defaults.title
    onStart(prepared.build({ title: name, chartId: slug(name), size: size === '' ? null : Number(size) }))
  }

  return (
    <form className={s.form} onSubmit={submit} aria-labelledby="setup-title">
      <h2 id="setup-title">Chart read</h2>
      <p>
        <strong>{prepared.fileName}</strong>: {chart.rows.length} rows, {chart.construction === 'flat' ? 'worked flat' : 'worked in the round'}
        , {cableTypes} cable type{cableTypes === 1 ? '' : 's'} recognised.
      </p>
      {warnings.length > 0 && (
        <div className={s.warnings} role="status">
          <p>
            <strong>Check these {warnings.length} place(s) against the PDF:</strong>
          </p>
          <ul>
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <label className={s.label}>
        Chart name
        <input className={field} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={s.label}>
        Size
        <select className={field} value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="">All rows</option>
          {prepared.sizes.map((s) => {
            const end = chart.sizeMarkers.find((m) => m.size === s && m.kind === 'end')
            return (
              <option key={s} value={s}>
                Size {s}
                {end ? ` (ends at row ${end.row})` : ''}
              </option>
            )
          })}
        </select>
      </label>
      <div className={s.actions}>
        <button type="submit" className={primary}>
          Start knitting
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
