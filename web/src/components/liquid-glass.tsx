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
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from 'react'

import {
  convexRim,
  dockRim,
  refractionMap,
  type RefractionMap,
} from '@/lib/liquid-glass'
import { cn } from '@/lib/utils'

/**
 * dock: thin, clear glass like the macOS Dock (.dock-glass in
 * styles/site-bar.css), for a bar of a few words over the page.
 * frost: milky in the middle, for a panel full of text.
 */
export type GlassMaterial = 'dock' | 'frost'

/** The frost's rim, in px: width and glass thickness. */
const FROST_RIM = convexRim(14, 22)

// Clear at the rim, where the refraction shows, and milky in the middle so
// the text stays readable over a busy page: the ::after core is a blurred
// tint under the content. A hairline and a soft shadow make the pane read on
// a plain page. The ::before ring is the specular edge: brightest at the top
// left, where the light comes from, and again at the bottom right.
const FROST = cn(
  'relative bg-white/12 backdrop-blur-[12px] backdrop-saturate-180',
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.85),0_0_0_0.5px_rgb(0_0_0/0.09),0_6px_20px_-6px_rgb(0_0_0/0.2),0_2px_5px_-2px_rgb(0_0_0/0.08)]',
  'dark:bg-white/4 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_0_0_0.5px_rgb(0_0_0/0.6),0_8px_26px_-6px_rgb(0_0_0/0.65)]',
  'after:pointer-events-none after:absolute after:inset-1.5 after:-z-10 after:rounded-[inherit] after:bg-white/68 after:blur-[6px] dark:after:bg-neutral-950/45',
  'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:p-px before:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]',
  'before:bg-[linear-gradient(135deg,rgb(255_255_255/0.95),rgb(255_255_255/0.35)_28%,rgb(255_255_255/0.08)_50%,rgb(255_255_255/0.35)_72%,rgb(255_255_255/0.8))]',
  'dark:before:bg-[linear-gradient(135deg,rgb(255_255_255/0.45),rgb(255_255_255/0.12)_28%,rgb(255_255_255/0.03)_50%,rgb(255_255_255/0.12)_72%,rgb(255_255_255/0.32))]',
  '[@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none [@media(prefers-reduced-transparency:reduce)]:after:hidden'
)

/** The Dock's look: a little blur, and colours as rich as it shows them. */
const DOCK_BACKDROP = 'blur(1px) saturate(1.35)'
const FROST_BACKDROP = 'blur(3px) saturate(1.7)'

/** Only Chromium filters the backdrop through SVG; other browsers frost. */
function refracts() {
  return (
    /Chrome\/\d/.test(navigator.userAgent) &&
    !window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  )
}

/**
 * A long pane (a pill) bends the same way all along its middle: only the
 * ends differ. Such a pane gets one map of its two ends, plus one column of
 * the middle stretched between them, so it can change width every frame (the
 * site bar coming together) without redrawing anything. Other panes get one
 * map of their whole size, redrawn when it changes.
 */
type Lens =
  | {
      kind: 'whole'
      width: number
      height: number
      href: string
      scale: number
    }
  | {
      kind: 'stretch'
      /** The width when drawn; later widths only move the parts. */
      width: number
      height: number
      /** Width of each end, in px; the map is two ends and one column. */
      end: number
      ends: string
      middle: string
      scale: number
    }

function paneMap(pane: HTMLElement, width: number, material: GlassMaterial) {
  const height = pane.offsetHeight
  return refractionMap({
    width,
    height,
    radius: Number.parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0,
    rim: material === 'dock' ? dockRim(height) : FROST_RIM,
  })
}

function dataUrl(map: RefractionMap, column?: number) {
  const canvas = document.createElement('canvas')
  canvas.width = column === undefined ? map.width : 1
  canvas.height = map.height
  canvas
    .getContext('2d')
    ?.putImageData(
      new ImageData(map.pixels, map.width, map.height),
      column === undefined ? 0 : -column,
      0
    )
  return canvas.toDataURL()
}

/** Past half the height in from either end, every column bends alike. */
function endWidth(height: number) {
  return Math.ceil(height / 2) + 1
}

function grind(pane: HTMLElement, material: GlassMaterial): Lens {
  const height = pane.offsetHeight
  const end = endWidth(height)
  if (pane.offsetWidth >= 2 * end + 2) {
    const map = paneMap(pane, 2 * end + 1, material)
    return {
      kind: 'stretch',
      width: pane.offsetWidth,
      height,
      end,
      ends: dataUrl(map),
      middle: dataUrl(map, end),
      scale: map.scale,
    }
  }
  const map = paneMap(pane, pane.offsetWidth, material)
  return {
    kind: 'whole',
    width: pane.offsetWidth,
    height,
    href: dataUrl(map),
    scale: map.scale,
  }
}

/** What a new map depends on: a stretching pane only redraws for its height. */
function lensKey(pane: HTMLElement) {
  const { offsetWidth: width, offsetHeight: height } = pane
  const radius = getComputedStyle(pane).borderTopLeftRadius
  return width >= 2 * endWidth(height) + 2
    ? `stretch ${height} ${radius}`
    : `whole ${width}x${height} ${radius}`
}

type LensParts = {
  filter: SVGFilterElement | null
  middle: SVGFEImageElement | null
  right: SVGFEImageElement | null
}

/** Fits the filter, and a stretching map's middle and end, to `width`. */
function stretch(parts: LensParts, width: number) {
  parts.filter?.setAttribute('width', String(width))
  if (!parts.middle || !parts.right) return
  const end = Number(parts.right.getAttribute('width'))
  parts.middle.setAttribute('width', String(width - 2 * end))
  parts.right.setAttribute('x', String(width - end))
}

/**
 * The pane's displacement map, redrawn when its shape changes; a stretching
 * pane only moves its parts when it changes width.
 */
function useLens(
  ref: RefObject<HTMLDivElement | null>,
  material: GlassMaterial
) {
  const [lens, setLens] = useState<Lens | null>(null)
  const parts = useRef<LensParts>({ filter: null, middle: null, right: null })

  useLayoutEffect(() => {
    const pane = ref.current
    if (!pane || !refracts()) return
    let key = ''
    const observer = new ResizeObserver(() => {
      // Hidden panes (the phone-only one on a desktop) have nothing to bend.
      if (!pane.offsetWidth) return
      const next = lensKey(pane)
      if (next !== key) {
        key = next
        setLens(grind(pane, material))
        return
      }
      stretch(parts.current, pane.offsetWidth)
    })
    observer.observe(pane)
    return () => observer.disconnect()
  }, [ref, material])

  // The pane may have changed width again while the new map was rendering.
  useLayoutEffect(() => {
    const pane = ref.current
    if (lens && pane?.offsetWidth) stretch(parts.current, pane.offsetWidth)
  }, [ref, lens])

  return { lens, parts }
}

/**
 * A pane of liquid glass, like the macOS Dock: it bends the page at its
 * rim, blurs it a little and catches the light on its edge. Give it a
 * border radius; the refraction follows it.
 */
export function LiquidGlass({
  className,
  style,
  children,
  material = 'frost',
  ref: outerRef,
  ...props
}: ComponentProps<'div'> & { material?: GlassMaterial }) {
  const ref = useRef<HTMLDivElement>(null)
  const filterId = `liquid-glass${useId().replaceAll(/[^\w-]/g, '')}`
  const { lens, parts } = useLens(ref, material)
  const look = material === 'dock' ? DOCK_BACKDROP : FROST_BACKDROP
  const backdrop = lens ? `url(#${filterId}) ${look}` : undefined

  return (
    <div
      ref={(pane) => {
        ref.current = pane
        if (typeof outerRef === 'function') return outerRef(pane)
        if (outerRef) outerRef.current = pane
      }}
      data-slot='liquid-glass'
      data-refracts={lens ? '' : undefined}
      className={cn(
        material === 'dock' ? 'dock-glass relative' : FROST,
        className
      )}
      style={
        backdrop
          ? {
              ...style,
              backdropFilter: backdrop,
              WebkitBackdropFilter: backdrop,
            }
          : style
      }
      {...props}
    >
      {lens && (
        <svg aria-hidden='true' className='pointer-events-none absolute size-0'>
          <filter
            ref={(filter) => {
              parts.current.filter = filter
            }}
            id={filterId}
            x='0'
            y='0'
            width={lens.width}
            height={lens.height}
            filterUnits='userSpaceOnUse'
            colorInterpolationFilters='sRGB'
          >
            {lens.kind === 'whole' ? (
              <feImage
                href={lens.href}
                x='0'
                y='0'
                width={lens.width}
                height={lens.height}
                preserveAspectRatio='none'
                result='lens'
              />
            ) : (
              <>
                <feImage
                  href={lens.ends}
                  x='0'
                  y='0'
                  width={lens.end}
                  height={lens.height}
                  preserveAspectRatio='xMinYMid slice'
                  result='start'
                />
                <feImage
                  ref={(middle) => {
                    parts.current.middle = middle
                  }}
                  href={lens.middle}
                  x={lens.end}
                  y='0'
                  width={lens.width - 2 * lens.end}
                  height={lens.height}
                  preserveAspectRatio='none'
                  result='middle'
                />
                <feImage
                  ref={(right) => {
                    parts.current.right = right
                  }}
                  href={lens.ends}
                  x={lens.width - lens.end}
                  y='0'
                  width={lens.end}
                  height={lens.height}
                  preserveAspectRatio='xMaxYMid slice'
                  result='end'
                />
                <feMerge result='lens'>
                  <feMergeNode in='start' />
                  <feMergeNode in='middle' />
                  <feMergeNode in='end' />
                </feMerge>
              </>
            )}
            <feDisplacementMap
              in='SourceGraphic'
              in2='lens'
              scale={lens.scale}
              xChannelSelector='R'
              yChannelSelector='G'
            />
          </filter>
        </svg>
      )}
      {children}
    </div>
  )
}
