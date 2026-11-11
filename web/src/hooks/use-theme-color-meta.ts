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
import { useEffect } from 'react'

let probe: CanvasRenderingContext2D | null | undefined
const resolved = new Map<string, string>()

/**
 * willReadFrequently keeps the canvas in memory. Reading one on the GPU makes
 * the page wait for everything queued there, and right after a theme change
 * that is the repaint of the whole page.
 */
function makeProbe() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  return canvas.getContext('2d', { willReadFrequently: true })
}

/** The colour as #rrggbb, which every browser accepts in meta theme-color. */
function toHex(color: string): string {
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')}`
  }
  const known = resolved.get(color)
  if (known) return known
  // lab(), oklch() and other notations: let a canvas resolve them to sRGB.
  probe ??= makeProbe()
  if (!probe) return color
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [red, green, blue] = probe.getImageData(0, 0, 1, 1).data
  const hex = toHex(`rgb(${red}, ${green}, ${blue})`)
  resolved.set(color, hex)
  return hex
}

/**
 * Keeps the browser UI colour (meta theme-color) on the page background.
 * The colour is read from the page itself, so it follows a theme switch and
 * a colour preset alike.
 */
export function useThemeColorMeta() {
  useEffect(() => {
    const meta = document.querySelector("meta[name='theme-color']")
    if (!meta) return

    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      // Read on the next frame, once the new root classes are styled.
      frame = requestAnimationFrame(() => {
        meta.setAttribute(
          'content',
          toHex(getComputedStyle(document.body).backgroundColor)
        )
      })
    }

    sync()
    // A canvas's first read is slow: have it done before the first theme change.
    const warm = window.requestIdleCallback?.(() => toHex('#000'), {
      timeout: 2000,
    })
    // The theme switches the root class; presets set an attribute or variables.
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme-preset'],
    })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      if (warm !== undefined) window.cancelIdleCallback(warm)
    }
  }, [])
}
