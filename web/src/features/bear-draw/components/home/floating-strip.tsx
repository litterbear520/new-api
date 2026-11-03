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
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'

import { LiquidGlass } from '@/components/liquid-glass'
import { BarInk } from '@/components/site-bar/bar-ink'
import { cn } from '@/lib/utils'

import { pageScroller } from './use-home'

/** Half the site bar's rate: it reads along with this one over the same wall. */
const READ_GAP_MS = 200

/**
 * True while the slot is held at its sticky line, seen through a mark at the
 * place it would otherwise stand. A slot that doesn't stick (the categories on
 * a phone) is never stuck.
 */
function useStuck(
  slot: RefObject<HTMLElement | null>,
  mark: RefObject<HTMLElement | null>
): boolean {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = slot.current
    const target = mark.current
    if (!el || !target || typeof IntersectionObserver === 'undefined') return
    let io: IntersectionObserver | null = null
    let line: number | undefined
    const watch = (): void => {
      const style = getComputedStyle(el)
      const next =
        style.position === 'sticky' ? Number.parseFloat(style.top) : Number.NaN
      if (Object.is(next, line)) return
      line = next
      io?.disconnect()
      io = null
      if (Number.isNaN(next)) {
        setStuck(false)
        return
      }
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries.at(-1)
          if (!entry) return
          setStuck(
            !entry.isIntersecting &&
              entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)
          )
        },
        {
          root: pageScroller(el),
          rootMargin: `${-next}px 0px 0px 0px`,
          threshold: 0,
        }
      )
      io.observe(target)
    }
    watch()
    window.addEventListener('resize', watch)
    return () => {
      window.removeEventListener('resize', watch)
      io?.disconnect()
    }
  }, [slot, mark])
  return stuck
}

/**
 * The bar's colour reading, for one strip: it runs only while the strip is
 * stuck over the page, and a strip that asks for less transparency has opaque
 * glass and nothing to read.
 */
function useStripInk(
  strip: RefObject<HTMLElement | null>,
  glass: RefObject<HTMLDivElement | null>,
  stuck: boolean
): void {
  useEffect(() => {
    const bar = strip.current
    const pane = glass.current
    if (!stuck || !bar || !pane) return
    const solid = window.matchMedia?.('(prefers-reduced-transparency: reduce)')
    if (solid?.matches) return
    const ink = new BarInk({
      bar,
      glass: pane,
      atWords: true,
      readGapMs: READ_GAP_MS,
    })
    const box = pageScroller(bar)
    const ask = (): void => ink.ask()
    // a new category changes the wall under the strip without any scrolling
    const newWall = (): void => ink.newPage()
    ink.newPage()
    box?.addEventListener('scroll', ask, { passive: true })
    bar.addEventListener('click', newWall)
    return () => {
      box?.removeEventListener('scroll', ask)
      bar.removeEventListener('click', newWall)
      ink.hold(true)
      ink.dispose()
    }
  }, [strip, glass, stuck])
}

/** A row that sticks under the site bar and, stuck, floats as a capsule of glass. */
export function FloatingStrip(props: {
  className?: string
  children: ReactNode
}): ReactElement {
  const mark = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const stuck = useStuck(slot, mark)
  useStripInk(strip, glass, stuck)

  return (
    <>
      <div ref={mark} aria-hidden='true' className='bd-strip-mark' />
      <div
        ref={slot}
        className={cn('bd-strip-slot', stuck && 'is-stuck', props.className)}
      >
        <div ref={strip} className='bd-strip'>
          <LiquidGlass
            ref={glass}
            aria-hidden='true'
            material='dock'
            className='bd-strip-glass rounded-full'
          />
          {props.children}
        </div>
      </div>
    </>
  )
}
