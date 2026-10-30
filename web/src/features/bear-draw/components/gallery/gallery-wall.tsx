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
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'

import type { GalleryItem } from '../../data/gallery'
import { GalleryCard } from './gallery-card'
import { assignColumns, columnCount, WALL } from './masonry'

/** Columns that fit the element's width, kept up to date while it resizes. */
function useColumns() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(() => ({ cols: columnCount(0), width: 0 }))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setSize({ cols: columnCount(el.clientWidth), width: el.clientWidth })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}

/** Rows rendered at first, and added each time the wall's end nears the screen. */
const STEP_ROWS = 2
/** How far below the screen the next rows render: close while the top row loads, then well ahead. */
const AHEAD_FIRST = 200
const AHEAD = 1200
/** Stop holding back for the top row after this long (slow network). */
const TOP_ROW_WAIT_MS = 4000

/**
 * How many cards to render. The wall grows a few rows at a time, so the top
 * row's pictures load first with nothing else in the way; once they are in,
 * the next rows render well before they scroll into view.
 */
function useShownCount(
  end: RefObject<HTMLDivElement | null>,
  total: number,
  cols: number,
  topRowDone: boolean
): number {
  const [rows, setRows] = useState(() =>
    typeof IntersectionObserver === 'undefined' ? Infinity : STEP_ROWS
  )
  const [late, setLate] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setLate(true), TOP_ROW_WAIT_MS)
    return () => window.clearTimeout(id)
  }, [])
  const ahead = topRowDone || late ? AHEAD : AHEAD_FIRST
  const more = rows * cols < total
  useEffect(() => {
    const el = end.current
    if (!more || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRows((n) => n + STEP_ROWS)
        }
      },
      { rootMargin: `0px 0px ${ahead}px 0px` }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [end, more, rows, ahead])
  return Math.min(total, rows * cols)
}

type GalleryWallProps = {
  items: readonly GalleryItem[]
  onOpen: (item: GalleryItem) => void
  onUse: (item: GalleryItem) => void
}

export function GalleryWall(props: GalleryWallProps) {
  const { ref, cols, width } = useColumns()
  const end = useRef<HTMLDivElement>(null)
  const [topLoaded, setTopLoaded] = useState(0)
  const count = useShownCount(
    end,
    props.items.length,
    cols,
    topLoaded >= Math.min(cols, props.items.length)
  )
  const columns = useMemo(
    () => assignColumns(props.items.slice(0, count), cols),
    [props.items, count, cols]
  )
  const onTopLoaded = useCallback(() => setTopLoaded((n) => n + 1), [])
  // one card's width on screen, so the browser picks the right picture size
  const sizes = width
    ? `${Math.ceil((width - (cols - 1) * WALL.gap) / cols)}px`
    : '(max-width: 760px) 50vw, 240px'
  return (
    <>
      <div ref={ref} className='bd-wall'>
        {columns.map((col) => (
          <div key={col.id} className='bd-wall-col'>
            {col.items.map((it, i) => (
              <GalleryCard
                key={it.id}
                item={it}
                sizes={sizes}
                top={i === 0}
                onTopLoaded={i === 0 ? onTopLoaded : undefined}
                onOpen={props.onOpen}
                onUse={props.onUse}
              />
            ))}
          </div>
        ))}
      </div>
      {count < props.items.length && (
        <div ref={end} className='bd-wall-end' aria-hidden='true' />
      )}
    </>
  )
}

const GHOSTS = [
  { id: 'g1', ratio: '3 / 4' },
  { id: 'g2', ratio: '9 / 16' },
  { id: 'g3', ratio: '1 / 1' },
  { id: 'g4', ratio: '2 / 3' },
  { id: 'g5', ratio: '3 / 4' },
]

/** Grey cards in the wall's place while the 玩法 chunk loads. */
export function WallPlaceholder() {
  return (
    <div className='bd-wall bd-wall-ghost' aria-hidden='true'>
      {GHOSTS.map((g) => (
        <div key={g.id} className='bd-wall-col'>
          <i style={{ aspectRatio: g.ratio }} />
        </div>
      ))}
    </div>
  )
}
