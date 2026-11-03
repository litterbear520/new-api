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
import { useRouter, useRouterState } from '@tanstack/react-router'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  isSiteLinkActive,
  siteLinkTarget,
} from '@/components/layout/lib/site-nav'
import type { TopNavLink } from '@/components/layout/types'
import { cn } from '@/lib/utils'

import { LENS_NOTE_MS, leaveLens, takeLens, type LensNote } from './handoff'
import { LensMotion, lensAt, nearestLink, type Span } from './lens'
import { SiteLink } from './site-link'

/** How far, in px, a press moves sideways before it drags the lens. */
const DRAG_SLOP = 6

type SiteNavLinksProps = {
  links: TopNavLink[]
  /** Every console page lights 控制台. */
  inConsole?: boolean
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>, link: TopNavLink) => void
  className?: string
}

/** A plain click that loads another site (the docs) in this tab. */
function leavesForPage(event: MouseEvent<HTMLAnchorElement>, link: TopNavLink) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    siteLinkTarget(link) === 'page'
  )
}

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function linkElements(nav: HTMLElement) {
  return [...nav.querySelectorAll<HTMLElement>('[data-site-link]')]
}

function linkSpans(nav: HTMLElement): Span[] {
  return linkElements(nav).map((link) => ({
    left: link.offsetLeft,
    right: link.offsetLeft + link.offsetWidth,
  }))
}

/**
 * The site-wide links (主页 / 控制台 / 模型广场 …) in the bar. A lens of
 * brighter glass sits under the current one and slides to the next, like
 * a tab bar. It can also be held and dragged, like the App Store's: it
 * swells under the finger, magnifying the words it passes, and letting go
 * opens the link it is over. A link to the docs (a page load) lights at the
 * click, so the lens moves while the docs load; their bar carries the
 * slide on.
 */
export function SiteNavLinks(props: SiteNavLinksProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navRef = useRef<HTMLElement>(null)
  const lensRef = useRef<HTMLSpanElement>(null)
  const magnifierRef = useRef<HTMLSpanElement>(null)
  const motionRef = useRef<LensMotion | null>(null)
  // the link clicked to leave this page, while still on it
  const [leaving, setLeaving] = useState<{
    index: number
    pathname: string
  } | null>(null)
  // while the lens is dragged, the link under it, and the pages readied
  const [aimed, setAimed] = useState<number | null>(null)
  const readied = useRef(new Set<number>())
  const here = props.links.findIndex((link) =>
    isSiteLinkActive(link.href, pathname, props.inConsole ?? false)
  )
  // lit: the lens and the brighter words, ahead of the page while leaving
  const lit = leaving?.pathname === pathname ? leaving.index : here
  const litRef = useRef(lit)
  useLayoutEffect(() => {
    litRef.current = lit
  })
  useLens(navRef, lensRef, magnifierRef, motionRef, lit)
  const drag = useLensDrag({
    navRef,
    motionRef,
    litRef,
    onAim: (index) => {
      setAimed(index)
      if (index === null) {
        readied.current.clear()
        return
      }
      // ready by the time the finger lets go, once per drag
      const link = props.links[index]
      if (
        link &&
        !readied.current.has(index) &&
        siteLinkTarget(link) === 'route'
      ) {
        readied.current.add(index)
        router.preloadRoute({ to: link.href }).catch(() => undefined)
      }
    },
  })
  const shown = aimed ?? lit

  // Back from the docs out of the back/forward cache: light this page again.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(null)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label={t('Site links')}
      // sideways it drags the lens; up and down it still scrolls the page
      className={cn(
        'relative flex touch-pan-y items-center gap-0.5 select-none [-webkit-touch-callout:none]',
        drag.dragging && 'cursor-grabbing',
        props.className
      )}
      {...drag.handlers}
    >
      <span
        ref={lensRef}
        aria-hidden='true'
        data-site-lens=''
        className='pointer-events-none absolute inset-y-0 left-0 w-0 overflow-hidden rounded-[8px] bg-[color-mix(in_srgb,currentColor_13%,transparent)] opacity-0 transition-[opacity,background-color,box-shadow] duration-300 data-swollen:z-10 data-swollen:bg-white/92 data-swollen:shadow-[inset_0_1px_0_rgb(255_255_255),0_0_0_0.5px_rgb(0_0_0/0.08),0_8px_20px_-8px_rgb(0_0_0/0.35)] data-swollen:backdrop-blur-[3px] dark:data-swollen:bg-[rgb(64_64_70/0.92)] dark:data-swollen:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_0_0_0.5px_rgb(0_0_0/0.5),0_8px_20px_-8px_rgb(0_0_0/0.7)]'
      >
        {/* the words again, enlarged by the lens's swell (see lens.ts) */}
        <span
          ref={magnifierRef}
          className='absolute inset-y-0 left-0 flex items-center gap-0.5 opacity-0'
        >
          {props.links.map((link) => (
            <span
              key={`${link.title}:${link.href}`}
              className='text-foreground inline-flex h-9 items-center px-3 text-sm font-medium whitespace-nowrap'
            >
              {link.title}
            </span>
          ))}
        </span>
      </span>
      {props.links.map((link, index) => (
        <SiteLink
          key={`${link.title}:${link.href}`}
          link={link}
          active={index === here}
          data-site-link=''
          draggable={false}
          // its name in a page-to-page view transition (styles/site-bar.css)
          style={{ '--site-vt': `site-link-${index}` } as CSSProperties}
          onClick={(event) => {
            props.onLinkClick?.(event, link)
            if (index !== lit && leavesForPage(event, link)) {
              setLeaving({ index, pathname })
            }
          }}
          // one weight for every link, so lighting one doesn't shift the rest
          className={cn(
            'focus-visible:ring-ring relative inline-flex h-9 items-center rounded-[8px] px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-300 focus-visible:ring-2',
            index === shown
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
            link.disabled && 'pointer-events-none opacity-50'
          )}
        />
      ))}
    </nav>
  )
}

/**
 * Puts the lens under link `current`: in place the first time and when the
 * links change size (another language), on springs when the page changes.
 * Opened from a page that was sliding it (the docs), it carries on from
 * where that page left it, at the speed it had. While a drag holds the lens
 * it is left alone; letting go slides it to whatever is lit then.
 */
function useLens(
  navRef: React.RefObject<HTMLElement | null>,
  lensRef: React.RefObject<HTMLSpanElement | null>,
  magnifierRef: React.RefObject<HTMLSpanElement | null>,
  motionRef: React.RefObject<LensMotion | null>,
  current: number
) {
  // undefined until the first layout takes it, then used once, soon (the
  // links may come a moment later, with the site's status)
  const arrival = useRef<{ note: LensNote; at: number } | null | undefined>(
    undefined
  )

  useLayoutEffect(() => {
    const nav = navRef.current
    const lens = lensRef.current
    if (!nav || !lens) return
    if (!motionRef.current) {
      motionRef.current = new LensMotion(lens, magnifierRef.current)
    }
    const motion = motionRef.current
    if (arrival.current === undefined) {
      const note = takeLens()
      arrival.current = note && { note, at: performance.now() }
    }
    const target = (): Span | null => linkSpans(nav)[current] ?? null

    if (!motion.held) {
      const to = target()
      let from = motion.edges
      if (to && !from && arrival.current) {
        // a page reached long after is not the arrival
        if (performance.now() - arrival.current.at < LENS_NOTE_MS) {
          from = arrival.current.note
        }
        arrival.current = null
      }
      if (to && from && !reducedMotion() && nav.offsetWidth > 0) {
        motion.slide(to, from)
      } else if (to) {
        motion.place(to)
      } else {
        motion.forget()
      }
    }

    // Another language or font: put it straight under the link again.
    const observer = new ResizeObserver(() => {
      const next = target()
      if (!next || motion.moving || motion.held) return
      motion.place(next)
    })
    observer.observe(nav)
    return () => {
      observer.disconnect()
      if (!motion.held) motion.halt()
    }
  }, [navRef, lensRef, magnifierRef, motionRef, current])

  useEffect(() => () => motionRef.current?.dispose(), [motionRef])

  // Leaving for a whole new page: note where the lens is for that page's bar.
  useEffect(() => {
    const onLeave = () => {
      const lens = motionRef.current?.edges
      if (lens && (navRef.current?.offsetWidth ?? 0) > 0) leaveLens({ ...lens })
    }
    window.addEventListener('pageswap', onLeave)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('pageswap', onLeave)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [navRef, motionRef])
}

type Press = {
  pointerId: number
  x: number
  y: number
  dragging: boolean
  /** The link under the lens, once dragging. */
  aimed: number
  /** Measured once the drag starts: the links stay put while it lasts. */
  spans: Span[]
  navLeft: number
}

/**
 * Press, drag sideways, let go: the lens follows the finger (or mouse),
 * swollen, and letting go opens the link under it, through that link's own
 * click, so it opens exactly as a click would (a sign-in prompt, the docs
 * in this tab). A press that does not move is a plain click. Escape, or the
 * browser taking the gesture over (a scroll), puts the lens back.
 */
function useLensDrag(options: {
  navRef: React.RefObject<HTMLElement | null>
  motionRef: React.RefObject<LensMotion | null>
  litRef: React.RefObject<number>
  onAim: (index: number | null) => void
}) {
  const { navRef, motionRef, litRef } = options
  const press = useRef<Press | null>(null)
  // the browser's own click after a drag is not a click on a link
  const swallowClick = useRef(false)
  const [dragging, setDragging] = useState(false)
  const onAim = useRef(options.onAim)
  useLayoutEffect(() => {
    onAim.current = options.onAim
  })

  /** Back under the lit link (or out of sight, when none is lit). */
  const settle = () => {
    const nav = navRef.current
    const motion = motionRef.current
    if (!nav || !motion || motion.held) return
    const to = linkSpans(nav)[litRef.current]
    if (!to) motion.forget()
    else if (reducedMotion()) motion.place(to)
    else motion.slide(to)
  }

  const finish = (pick: boolean) => {
    const p = press.current
    const nav = navRef.current
    const motion = motionRef.current
    press.current = null
    if (!p?.dragging || !nav || !motion) return
    swallowClick.current = true
    setTimeout(() => {
      swallowClick.current = false
    }, 0)
    if (nav.hasPointerCapture?.(p.pointerId)) {
      nav.releasePointerCapture(p.pointerId)
    }
    motion.held = false
    motion.swellTo(false, reducedMotion())
    setDragging(false)
    onAim.current(null)
    if (pick && p.aimed !== litRef.current) {
      linkElements(nav)[p.aimed]?.click()
      // nowhere to go (a sign-in prompt, say): come back
      requestAnimationFrame(() => {
        if (litRef.current !== p.aimed) settle()
      })
    } else {
      settle()
    }
  }

  // Escape lets go without opening anything.
  useEffect(() => {
    if (!dragging) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!event.isPrimary) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      press.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
        aimed: litRef.current,
        spans: [],
        navLeft: 0,
      }
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const p = press.current
      const nav = navRef.current
      const motion = motionRef.current
      if (!p || event.pointerId !== p.pointerId || !nav || !motion) return
      // a mouse let go outside the links, where its release went unseen
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
        finish(false)
        return
      }
      if (!p.dragging) {
        if (Math.abs(event.clientX - p.x) < DRAG_SLOP) {
          // mostly up or down: not ours
          if (Math.abs(event.clientY - p.y) > DRAG_SLOP * 2) {
            press.current = null
          }
          return
        }
        p.dragging = true
        p.spans = linkSpans(nav)
        p.navLeft = nav.getBoundingClientRect().left
        nav.setPointerCapture?.(event.pointerId)
        motion.held = true
        motion.swellTo(true, reducedMotion())
        setDragging(true)
        p.aimed = -1
      }
      if (!p.spans.length) return
      const x = event.clientX - p.navLeft
      const to = lensAt(p.spans, x)
      if (reducedMotion()) motion.place(to)
      else motion.follow(to)
      const index = nearestLink(p.spans, x)
      if (index !== p.aimed) {
        p.aimed = index
        onAim.current(index)
      }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerId === press.current?.pointerId) finish(true)
    },
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerId === press.current?.pointerId) finish(false)
    },
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (swallowClick.current && event.nativeEvent.isTrusted) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
  }

  return { dragging, handlers }
}

/** The hairline between the links and the icons in the dock. */
export function DockDivider(props: { className?: string }) {
  return (
    <span
      aria-hidden='true'
      data-bar-word='line'
      className={cn('mx-1 h-4 w-px shrink-0 bg-current/28', props.className)}
    />
  )
}
