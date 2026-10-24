import { useState, type DragEvent } from 'react'
import { loadProgress, loadRecent, type RecentEntry } from '../state/storage'
import type { PatternDoc } from '../types'

export const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/back-yoke.json`

interface Props {
  onOpen: (doc: PatternDoc) => void
  onOpenRecent: (entry: RecentEntry) => void
}

/** Checks the shape of an extracted chart file enough to show a clear error instead of a crash. */
export function parseDoc(text: string): PatternDoc {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const d = data as Partial<PatternDoc>
  if (!d || typeof d !== 'object' || !Array.isArray(d.charts) || d.charts.length === 0) {
    throw new Error('This is not an extracted chart file (no "charts").')
  }
  if (!d.source?.sha256 || !d.symbols) throw new Error('This chart file is missing its source or symbols.')
  for (const c of d.charts) {
    if (!Array.isArray(c.rows) || c.rows.some((r) => !Array.isArray(r.groups) || !Array.isArray(r.cells))) {
      throw new Error(`Chart "${c.id}" has malformed rows.`)
    }
  }
  return d as PatternDoc
}

export function OpenScreen({ onOpen, onOpenRecent }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const recent = loadRecent()

  const readFile = async (file: File | undefined) => {
    if (!file) return
    try {
      onOpen(parseDoc(await file.text()))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const openSample = async () => {
    try {
      const res = await fetch(SAMPLE_URL)
      if (!res.ok) throw new Error('The sample chart is not bundled in this build. Run `pnpm sample` first.')
      onOpen(parseDoc(await res.text()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void readFile(e.dataTransfer.files[0])
  }

  return (
    <div className="open-screen">
      <h2>Open a chart</h2>
      <div
        className={`drop-zone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="drop-zone"
      >
        <p>Drop an extracted chart file (.json) here, or</p>
        <label className="button primary">
          Choose a file
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(e) => void readFile(e.target.files?.[0])}
            data-testid="file-input"
          />
        </label>
      </div>
      <p>
        <button type="button" onClick={() => void openSample()}>
          Open the sample: Shanon Sweater, back yoke
        </button>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {recent.length > 0 && (
        <section className="recent">
          <h3>Recent charts</h3>
          <ul>
            {recent.map((r) => {
              const p = loadProgress(r.patternHash, r.chartId)
              return (
                <li key={`${r.patternHash}:${r.chartId}`}>
                  <button type="button" onClick={() => onOpenRecent(r)}>
                    {r.pattern}: {r.title}
                    {p && (
                      <span className="recent-pos">
                        {' '}
                        (row {p.row}, group {p.groupIndex + 1})
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
