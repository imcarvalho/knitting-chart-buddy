import { useEffect, useRef, useState } from 'react'
import { Footer } from './components/Footer'
import { HowTo } from './components/HowTo'
import { OpenScreen } from './components/OpenScreen'
import { RowView } from './components/RowView'
import { SettingsPanel } from './components/SettingsPanel'
import { patternHash } from './model/navigation'
import { lastOpened, loadDoc, loadSettings, rememberDoc, saveSettings, type RecentEntry, type Settings } from './state/storage'
import { useWakeLock, wakeLockSupported } from './state/wakeLock'
import type { PatternDoc } from './types'
import * as s from './App.css'

interface Open {
  doc: PatternDoc
  chartId: string
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const get = () => typeof matchMedia === 'function' && matchMedia(query).matches
  const [reduced, setReduced] = useState(get)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(query)
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

export default function App() {
  const [open, setOpen] = useState<Open | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // Set once the user moves between views, so focus follows them (but not on the first load).
  const navigated = useRef(false)
  const reducedMotion = usePrefersReducedMotion()
  const wakeLockActive = useWakeLock(open !== null && settings.wakeLock)

  // Reopen the last chart, at its saved position.
  useEffect(() => {
    const last = lastOpened()
    if (!last) {
      setRestoring(false)
      return
    }
    loadDoc(last.patternHash)
      .then((doc) => {
        if (doc) setOpen({ doc, chartId: last.chartId })
      })
      .finally(() => setRestoring(false))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.theme)
    root.classList.toggle('large-text', settings.largeText)
    saveSettings(settings)
  }, [settings])

  const closeChart = () => {
    navigated.current = true
    setOpen(null)
  }

  const openDoc = (doc: PatternDoc, chartId?: string) => {
    const id = chartId ?? doc.charts[0].id
    setOpen({ doc, chartId: id })
    void rememberDoc(doc, id)
  }

  const openRecent = async (entry: RecentEntry) => {
    const doc = await loadDoc(entry.patternHash)
    if (doc) openDoc(doc, entry.chartId)
  }

  const chart = open ? (open.doc.charts.find((c) => c.id === open.chartId) ?? open.doc.charts[0]) : null

  return (
    <div className={s.app}>
      <header className={s.header}>
        <h1 className={s.title}>
          <span aria-hidden="true">🧶</span> Knitting Chart Buddy <span className={s.badge}>Beta</span>
        </h1>
        <div className={s.actions}>
          {open && (
            <button type="button" onClick={closeChart}>
              Charts
            </button>
          )}
          {open && (
            <button
              type="button"
              aria-expanded={showHelp}
              aria-controls={showHelp ? 'help-panel' : undefined}
              onClick={() => setShowHelp((h) => !h)}
            >
              Help
            </button>
          )}
          <button
            type="button"
            aria-expanded={showSettings}
            aria-controls={showSettings ? 'settings-panel' : undefined}
            onClick={() => setShowSettings((s) => !s)}
          >
            Settings
          </button>
        </div>
      </header>
      {showSettings && (
        <section id="settings-panel" aria-label="Settings">
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            wakeLockSupported={wakeLockSupported()}
            wakeLockActive={wakeLockActive}
          />
        </section>
      )}
      {open && showHelp && <HowTo id="help-panel" />}
      <main className={s.main}>
        {open && chart ? (
          <RowView
            key={`${patternHash(open.doc)}:${chart.id}`}
            doc={open.doc}
            chart={chart}
            patternHash={patternHash(open.doc)}
            reducedMotion={reducedMotion}
          />
        ) : restoring ? null : (
          <OpenScreen
            onOpen={(d) => openDoc(d)}
            onOpenRecent={(e) => void openRecent(e)}
            focusHeading={navigated.current}
          />
        )}
      </main>
      <Footer />
    </div>
  )
}
