import { visuallyHidden } from '../styles/ui.css'
import * as s from './Footer.css'

const KOFI_URL = 'https://ko-fi.com/cosmosbeast'

export function Footer() {
  return (
    <footer className={s.footer}>
      <p className={s.text}>Knitting Chart Buddy is free. If it helps you, you can buy me a coffee.</p>
      <a className={s.kofi} href={KOFI_URL} target="_blank" rel="noopener noreferrer">
        <svg className={s.icon} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4 7h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Zm12 2h1.5a2.5 2.5 0 0 1 0 5H16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M10 15.5s-3-1.8-3-3.6c0-1 .8-1.6 1.6-1.6.6 0 1.1.3 1.4.8.3-.5.8-.8 1.4-.8.8 0 1.6.6 1.6 1.6 0 1.8-3 3.6-3 3.6Z" fill="currentColor" />
        </svg>
        Support me on Ko-fi
        <span className={visuallyHidden}> (opens in a new tab)</span>
      </a>
    </footer>
  )
}
