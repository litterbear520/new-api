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
import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * The project page renders into its own element inside the console's
 * content card. `ready` turns true once the element is in the document, so
 * children mount into a measurable box.
 */
export function useProjectHost(slot: RefObject<HTMLElement | null>): {
  host: HTMLDivElement
  ready: boolean
} {
  const [host] = useState(() => {
    const el = document.createElement('div')
    el.className = 'bd-proj-host'
    return el
  })
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const target = slot.current
    if (!target) return
    target.append(host)
    setReady(true)
    return () => host.remove()
  }, [host, slot])

  return { host, ready }
}

/** Width of an element, kept up to date (0 until measured). */
export function useElementWidth(el: HTMLElement): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return width
}
