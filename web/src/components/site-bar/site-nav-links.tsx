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
import { useRouterState } from '@tanstack/react-router'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  isSiteLinkActive,
  siteLinkTarget,
} from '@/components/layout/lib/site-nav'
import type { TopNavLink } from '@/components/layout/types'
import { cn } from '@/lib/utils'

import { LENS_NOTE_MS, leaveLens, takeLens, type LensNote } from './handoff'
import { springTo } from './morph'
import { SiteLink } from './site-link'

// The lens's two edges move on their own springs, the leading one quicker:
// it stretches on the way and lands with a small bounce.
const LEAD = { stiffness: 600, damping: 32 }
const TRAIL = { stiffness: 170, damping: 22 }

/** Stretched past the wider of its two links, the lens thins like a drop. */
const SQUASH = 0.3
const MAX_SQUASH = 0.14

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

/**
 * The site-wide links (主页 / 控制台 / 模型广场 …) in the bar. A lens of
 * brighter glass sits under the current one and slides to the next, like
 * a tab bar. A link to the docs (a page load) lights at the click, so the
 * lens moves while the docs load; their bar carries the slide on.
 */
export function SiteNavLinks(props: SiteNavLinksProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navRef = useRef<HTMLElement>(null)
  const lensRef = useRef<HTMLSpanElement>(null)
  // the link clicked to leave this page, while still on it
  const [leaving, setLeaving] = useState<{
    index: number
    pathname: string
  } | null>(null)
  const here = props.links.findIndex((link) =>
    isSiteLinkActive(link.href, pathname, props.inConsole ?? false)
  )
  // lit: the lens and the brighter words, ahead of the page while leaving
  const lit = leaving?.pathname === pathname ? leaving.index : here
  useLens(navRef, lensRef, lit)

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
      className={cn('relative flex items-center gap-0.5', props.className)}
    >
      <span
        ref={lensRef}
        aria-hidden='true'
        data-site-lens=''
        className='pointer-events-none absolute inset-y-0 left-0 w-0 rounded-full bg-white/70 opacity-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),0_0_0_0.5px_rgb(0_0_0/0.06),0_1px_4px_-1px_rgb(0_0_0/0.16)] transition-[opacity,background-color,box-shadow] duration-300 dark:bg-white/13 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_0_0_0.5px_rgb(0_0_0/0.4),0_2px_6px_-2px_rgb(0_0_0/0.5)]'
      />
      {props.links.map((link, index) => (
        <SiteLink
          key={`${link.title}:${link.href}`}
          link={link}
          active={index === here}
          data-site-link=''
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
            'focus-visible:ring-ring relative inline-flex h-9 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-300 focus-visible:ring-2',
            index === lit
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
            link.disabled && 'pointer-events-none opacity-50'
          )}
        />
      ))}
    </nav>
  )
}

type Edges = LensNote

/**
 * Puts the lens under link `current`: in place the first time and when the
 * links change size (another language), on springs when the page changes.
 * Opened from a page that was sliding it (the docs), it carries on from
 * where that page left it, at the speed it had.
 */
function useLens(
  navRef: React.RefObject<HTMLElement | null>,
  lensRef: React.RefObject<HTMLSpanElement | null>,
  current: number
) {
  const edges = useRef<Edges | null>(null)
  const stops = useRef<Array<() => void>>([])
  // undefined until the first layout takes it, then used once, soon (the
  // links may come a moment later, with the site's status)
  const arrival = useRef<{ note: LensNote; at: number } | null | undefined>(
    undefined
  )

  useLayoutEffect(() => {
    const nav = navRef.current
    const lens = lensRef.current
    if (!nav || !lens) return
    if (arrival.current === undefined) {
      const note = takeLens()
      arrival.current = note && { note, at: performance.now() }
    }
    let rest = 0
    const draw = (left: number, right: number) => {
      const width = Math.max(0, right - left)
      const stretch = rest > 0 ? Math.max(0, width / rest - 1) : 0
      const squash = Math.min(MAX_SQUASH, stretch * SQUASH)
      lens.style.transform = `translate3d(${left}px,0,0) scaleY(${1 - squash})`
      lens.style.width = `${width}px`
    }
    const target = () => {
      const link =
        nav.querySelectorAll<HTMLElement>('[data-site-link]')[current]
      return link
        ? { left: link.offsetLeft, right: link.offsetLeft + link.offsetWidth }
        : null
    }
    const halt = () => {
      for (const stop of stops.current) stop()
      stops.current = []
    }

    const to = target()
    lens.style.opacity = to ? '1' : '0'
    let from = edges.current
    if (to && !from && arrival.current) {
      // a page reached long after is not the arrival
      if (performance.now() - arrival.current.at < LENS_NOTE_MS) {
        from = arrival.current.note
      }
      arrival.current = null
    }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    halt()
    if (to && from && !still && nav.offsetWidth > 0) {
      // the lens's live position, so a quick second click starts from it
      const now = { ...from }
      edges.current = now
      rest = Math.max(from.right - from.left, to.right - to.left)
      // drawn now: the springs' first step is a frame away
      draw(from.left, from.right)
      const rightward = to.left > from.left
      const [leftSpring, rightSpring] = rightward
        ? [TRAIL, LEAD]
        : [LEAD, TRAIL]
      let moving = 2
      const land = () => {
        moving -= 1
        if (moving === 0) stops.current = []
      }
      stops.current = [
        springTo(
          from.left,
          to.left,
          leftSpring,
          (x, v) => {
            now.left = x
            now.vLeft = v
            draw(now.left, now.right)
            if (x === to.left) land()
          },
          from.vLeft
        ),
        springTo(
          from.right,
          to.right,
          rightSpring,
          (x, v) => {
            now.right = x
            now.vRight = v
            draw(now.left, now.right)
            if (x === to.right) land()
          },
          from.vRight
        ),
      ]
    } else if (to) {
      edges.current = { ...to, vLeft: 0, vRight: 0 }
      draw(to.left, to.right)
    } else {
      // nothing lit: the next lit link gets the lens in place, not slid in
      edges.current = null
    }

    // Another language or font: put it straight under the link again.
    const observer = new ResizeObserver(() => {
      const next = target()
      if (!next || stops.current.length) return
      edges.current = { ...next, vLeft: 0, vRight: 0 }
      draw(next.left, next.right)
    })
    observer.observe(nav)
    return () => {
      observer.disconnect()
      halt()
    }
  }, [navRef, lensRef, current])

  // Leaving for a whole new page: note where the lens is for that page's bar.
  useEffect(() => {
    const onLeave = () => {
      const lens = edges.current
      if (lens && (navRef.current?.offsetWidth ?? 0) > 0) leaveLens({ ...lens })
    }
    window.addEventListener('pageswap', onLeave)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('pageswap', onLeave)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [navRef])
}

/** The hairline between the links and the icons in the dock. */
export function DockDivider(props: { className?: string }) {
  return (
    <span
      aria-hidden='true'
      className={cn('bg-foreground/12 mx-1 h-4 w-px shrink-0', props.className)}
    />
  )
}
