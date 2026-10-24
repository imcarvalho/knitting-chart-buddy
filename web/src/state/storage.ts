import { createStore, del, get, set, type UseStore } from 'idb-keyval'
import type { PatternDoc } from '../types'

/** Saved after every step. */
export interface Progress {
  patternHash: string
  chartId: string
  row: number
  groupIndex: number
  updatedAt: number
}

export interface RecentEntry {
  patternHash: string
  chartId: string
  pattern: string
  title: string
  openedAt: number
}

export interface Settings {
  theme: 'auto' | 'light' | 'dark' | 'contrast'
  largeText: boolean
  wakeLock: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'auto', largeText: false, wakeLock: true }

const PREFIX = 'kcb:'
const MAX_RECENT = 8

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode, quota): progress is kept in memory only.
  }
}

const progressKey = (hash: string, chartId: string) => `progress:${hash}:${chartId}`

export function loadProgress(hash: string, chartId: string): Progress | undefined {
  return readJson<Progress>(progressKey(hash, chartId))
}

export function saveProgress(p: Omit<Progress, 'updatedAt'>): void {
  writeJson(progressKey(p.patternHash, p.chartId), { ...p, updatedAt: Date.now() })
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>('settings') }
}

export function saveSettings(s: Settings): void {
  writeJson('settings', s)
}

export function loadRecent(): RecentEntry[] {
  return readJson<RecentEntry[]>('recent') ?? []
}

// Chart documents can be large, so they live in IndexedDB. If it is unavailable, fall back to memory.
let store: UseStore | null | undefined
const memory = new Map<string, PatternDoc>()

function docStore(): UseStore | null {
  if (store === undefined) {
    try {
      store = typeof indexedDB === 'undefined' ? null : createStore('knitting-chart-buddy', 'docs')
    } catch {
      store = null
    }
  }
  return store
}

export async function rememberDoc(doc: PatternDoc, chartId: string): Promise<void> {
  const hash = doc.source.sha256
  memory.set(hash, doc)
  const s = docStore()
  if (s) {
    try {
      await set(hash, doc, s)
    } catch {
      // keep the in-memory copy
    }
  }
  const chart = doc.charts.find((c) => c.id === chartId) ?? doc.charts[0]
  const entry: RecentEntry = { patternHash: hash, chartId: chart.id, pattern: doc.pattern, title: chart.title, openedAt: Date.now() }
  const others = loadRecent().filter((r) => !(r.patternHash === hash && r.chartId === chart.id))
  const kept = [entry, ...others].slice(0, MAX_RECENT)
  writeJson('recent', kept)
  for (const dropped of [entry, ...others].slice(MAX_RECENT)) {
    if (!kept.some((k) => k.patternHash === dropped.patternHash) && s) {
      del(dropped.patternHash, s).catch(() => undefined)
    }
  }
}

export async function loadDoc(hash: string): Promise<PatternDoc | undefined> {
  if (memory.has(hash)) return memory.get(hash)
  const s = docStore()
  if (!s) return undefined
  try {
    return (await get<PatternDoc>(hash, s)) ?? undefined
  } catch {
    return undefined
  }
}

export function lastOpened(): RecentEntry | undefined {
  return loadRecent()[0]
}
