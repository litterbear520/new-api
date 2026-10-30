/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { STORAGE_KEYS } from '../constants'
import type { DrawAlertPrefs } from '../types'

/*
 * Telling people a picture is ready while they are in another tab: the tab
 * title and icon change, an optional soft chime, and an optional system
 * notification (permission is asked only when they switch it on).
 */

export function readAlertPrefs(): DrawAlertPrefs {
  const prefs: DrawAlertPrefs = { notify: false, sound: true }
  try {
    Object.assign(
      prefs,
      JSON.parse(localStorage.getItem(STORAGE_KEYS.alert) || '{}')
    )
  } catch {
    // Keep the defaults.
  }
  if (prefs.notify && !notificationsGranted()) prefs.notify = false
  return prefs
}

export function saveAlertPrefs(prefs: DrawAlertPrefs) {
  try {
    localStorage.setItem(STORAGE_KEYS.alert, JSON.stringify(prefs))
  } catch {
    // Private mode: the choice lasts for this visit.
  }
}

/**
 * Mobile browsers have the Notification API but show notifications only from
 * a service worker (Android Chrome throws on `new Notification`).
 */
export function notificationsSupported(): boolean {
  if (!('Notification' in window)) return false
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  if (nav.userAgentData?.mobile) return false
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function notificationsGranted(): boolean {
  return notificationsSupported() && Notification.permission === 'granted'
}

/*
 * The chime is a short WAV played by an <audio> element. Safari suspends Web
 * Audio while the tab is in the background, which is exactly when the chime
 * plays, and often never resumes it; audio elements keep working there.
 */
const CHIME_RATE = 22050
const CHIME_PEAK = 0.09
/** Silence first, so speakers that wake up from idle don't clip the start. */
const CHIME_LEAD = 0.03

/** A soft two-note "ding" as 16-bit mono WAV; lower when something failed. */
export function chimeWav(ok: boolean): ArrayBuffer {
  const notes: Array<[number, number]> = ok
    ? [
        [1046.5, 0],
        [1568, 0.11],
      ]
    : [
        [659.3, 0],
        [523.3, 0.14],
      ]
  const noteLen = Math.round(0.9 * CHIME_RATE)
  const lastStart = Math.round((CHIME_LEAD + notes[1][1]) * CHIME_RATE)
  const frames = lastStart + noteLen
  const mix = new Float32Array(frames)
  for (const [freq, delay] of notes) {
    const from = Math.round((CHIME_LEAD + delay) * CHIME_RATE)
    for (let i = 0; i < noteLen; i++) {
      const sec = i / CHIME_RATE
      // 15 ms rise, then an exponential fade to -60 dB over 0.835 s
      const env =
        sec < 0.015
          ? (CHIME_PEAK * sec) / 0.015
          : CHIME_PEAK *
            (0.0001 / CHIME_PEAK) ** Math.min(1, (sec - 0.015) / 0.835)
      mix[from + i] += env * Math.sin(2 * Math.PI * freq * sec)
    }
  }
  return pcmWav(mix)
}

/** Encodes samples in -1…1 as 16-bit mono PCM WAV at CHIME_RATE. */
function pcmWav(mix: Float32Array): ArrayBuffer {
  const frames = mix.length
  const buf = new ArrayBuffer(44 + frames * 2)
  const view = new DataView(buf)
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(at + i, value.codePointAt(i) ?? 0)
    }
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, CHIME_RATE, true)
  view.setUint32(28, CHIME_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) {
    const v = Math.max(-1, Math.min(1, mix[i]))
    view.setInt16(44 + i * 2, Math.round(v * 32767), true)
  }
  return buf
}

const players = new Map<boolean, HTMLAudioElement>()
let unlocked = false
let silenceUrl: string | null = null

function player(ok: boolean): HTMLAudioElement | null {
  let el = players.get(ok)
  if (el) return el
  if (typeof Audio === 'undefined') return null
  try {
    const url = URL.createObjectURL(
      new Blob([chimeWav(ok)], { type: 'audio/wav' })
    )
    el = new Audio(url)
    el.preload = 'auto'
    players.set(ok, el)
    return el
  } catch {
    return null
  }
}

/**
 * Browsers only allow sound after a click, so this runs on user actions.
 * Playing a moment of silence during the click lets each element play the
 * chime later, also from a background tab (Safari grants this per element,
 * and the grant survives a src change). The chime itself must not be used
 * here: Safari played the "muted" chime out loud, so the first click after
 * every reload rang.
 */
export function ensureAudio() {
  if (unlocked) return
  unlocked = true
  try {
    silenceUrl ??= URL.createObjectURL(
      new Blob([pcmWav(new Float32Array(Math.round(0.05 * CHIME_RATE)))], {
        type: 'audio/wav',
      })
    )
  } catch {
    unlocked = false
    return
  }
  for (const ok of [true, false]) {
    const el = player(ok)
    if (!el) continue
    const chimeSrc = el.src
    el.src = silenceUrl
    el.play()
      .then(() => {
        el.src = chimeSrc
      })
      .catch(() => {
        el.src = chimeSrc
        unlocked = false
      })
  }
}

/** A soft two-note "ding"; lower when something failed. */
export function chime(ok: boolean) {
  const el = player(ok)
  if (!el) return
  el.muted = false
  el.currentTime = 0
  el.play().catch(() => {
    // Not allowed before the first click on the page: stay quiet.
  })
}

export type TabBadge = '' | 'busy' | 'done' | 'err'

/**
 * Draws the site icon with a small ring (drawing) or dot (finished) in the
 * corner. `restore` puts the original icon back.
 */
export function createTabIcon() {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  const original = link?.href ?? ''
  const logo = new Image()
  let state: TabBadge | null = null
  let ready = false
  logo.addEventListener('load', () => {
    ready = true
    const s = state
    state = null
    if (s) set(s)
  })
  if (original) logo.src = original

  function set(next: TabBadge) {
    if (next === state) return
    state = next
    const el = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!el) return
    if (!next) {
      el.href = original
      return
    }
    if (!ready) return
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const x = c.getContext('2d')
      if (!x) return
      x.imageSmoothingEnabled = false
      x.drawImage(logo, 4, 4, 56, 56)
      x.beginPath()
      x.arc(49, 49, 14, 0, Math.PI * 2)
      x.fillStyle = '#fff'
      x.fill()
      x.beginPath()
      x.arc(49, 49, 9.5, 0, Math.PI * 2)
      if (next === 'busy') {
        x.lineWidth = 4.5
        x.strokeStyle = '#3B8FE0'
        x.stroke()
      } else {
        x.fillStyle = next === 'err' ? '#E5484D' : '#3B8FE0'
        x.fill()
      }
      el.href = c.toDataURL()
    } catch {
      // A cross-origin logo can't be redrawn; keep the plain icon.
    }
  }

  return {
    set,
    restore() {
      const el = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
      if (el && original) el.href = original
      state = null
    },
  }
}

export function showNotification(
  title: string,
  body: string,
  tag: string,
  onClick: () => void
) {
  if (!notificationsGranted()) return
  try {
    const icon =
      document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href
    const n = new Notification(title, { body, tag, icon })
    n.addEventListener('click', () => {
      window.focus()
      n.close()
      onClick()
    })
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
