import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { PreparedChart } from '../extractor'
import { loadProgress, loadRecent, type RecentEntry } from '../state/storage'
import type { PatternDoc } from '../types'
import { ChartSetup } from './ChartSetup'
import { HowTo } from './HowTo'
import { buttonLike, errorText, muted, primary, visuallyHidden } from '../styles/ui.css'
import * as s from './OpenScreen.css'

interface Props {
  onOpen: (doc: PatternDoc) => void
  onOpenRecent: (entry: RecentEntry) => void
  /** Move focus to the heading: true when the user came back here, not on first load. */
  focusHeading?: boolean
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

export function OpenScreen({ onOpen, onOpenRecent, focusHeading = false }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<PreparedChart | null>(null)
  const recent = loadRecent()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusHeading && !prepared) headingRef.current?.focus()
  }, [focusHeading, prepared])

  const readFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    try {
      if (isPdf) {
        setBusy(`Reading ${file.name}...`)
        const { prepareChartFromFile } = await import('../extractor/browser')
        setPrepared(await prepareChartFromFile(file))
      } else {
        onOpen(parseDoc(await file.text()))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (prepared) {
    return <ChartSetup prepared={prepared} onStart={onOpen} onCancel={() => setPrepared(null)} />
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void readFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        Open a chart
      </h2>
      <div
        className={dragging ? `${s.dropZone} ${s.dragging}` : s.dropZone}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="drop-zone"
      >
        <p>Drop a one-page chart PDF (or an extracted .json chart) here, or</p>
        <label className={`${buttonLike} ${primary}`}>
          Choose a file
          <input
            type="file"
            accept="application/pdf,.pdf,application/json,.json"
            className={visuallyHidden}
            onChange={(e) => void readFile(e.target.files?.[0])}
            data-testid="file-input"
          />
        </label>
      </div>
      {/* Always rendered, so screen readers announce the text when it appears. */}
      <p className={`${s.busy} ${s.live}`} role="status">
        {busy}
      </p>
      <p className={`${errorText} ${s.live}`} role="alert">
        {error}
      </p>
      {recent.length > 0 && (
        <section>
          <h3>Recent charts</h3>
          <ul className={s.recentList}>
            {recent.map((r) => {
              const p = loadProgress(r.patternHash, r.chartId)
              return (
                <li key={`${r.patternHash}:${r.chartId}`}>
                  <button type="button" onClick={() => onOpenRecent(r)}>
                    {r.pattern}: {r.title}
                    {p && (
                      <span className={muted}>
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
      <HowTo />
    </div>
  )
}
