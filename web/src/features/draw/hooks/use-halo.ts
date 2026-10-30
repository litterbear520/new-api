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
import { useEffect, useRef, useState } from 'react'

/**
 * Shows the composer light while a picture draws (fading in and out), and a
 * one-off flash when drawing stops because a picture just arrived.
 */
export function useHalo(busy: boolean, justFinished: () => boolean) {
  const [mounted, setMounted] = useState(busy)
  const [on, setOn] = useState(false)
  const [flash, setFlash] = useState(0)
  const was = useRef(busy)
  const finished = useRef(justFinished)
  finished.current = justFinished

  useEffect(() => {
    if (busy) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setOn(true))
      was.current = true
      return () => cancelAnimationFrame(raf)
    }
    setOn(false)
    if (was.current && finished.current()) setFlash(Date.now())
    was.current = false
    const id = setTimeout(() => setMounted(false), 750)
    return () => clearTimeout(id)
  }, [busy])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(0), 1200)
    return () => clearTimeout(id)
  }, [flash])

  return { mounted, on, flash }
}
