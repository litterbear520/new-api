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
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { AccountMenu } from '@/components/layout/components/account-menu'
import type { TopNavLink } from '@/components/layout/types'
import { LiquidGlass } from '@/components/liquid-glass'
import { NotificationPopover } from '@/components/notification-popover'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { SystemUpdateAction } from '@/features/system-update/system-update-action'
import { useBrand } from '@/hooks/use-brand'
import { useNotifications } from '@/hooks/use-notifications'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { useUserDisplay } from '@/hooks/use-user-display'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { describeAccount, writeAccountNote } from './account-note'
import { leaveHandoff, takeHandoff } from './handoff'
import { BarMorph } from './morph'
import { useSignInPrompt } from './sign-in-prompt'
import { MenuButton, SiteMenu } from './site-menu'
import { DockDivider, SiteNavLinks } from './site-nav-links'
import { useSiteBarStore } from './store'

/** The brand's inset inside the assembled pill, in px. */
const BRAND_INSET = 14
/** Room for the hairline between the brand and the dock: 4 + 1 + 4 px. */
const SEAM = 9

/** The page's own scroller: the console's, or else the window. */
function pageScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="console-scroller"]')
}

function pageTop() {
  return pageScroller()?.scrollTop ?? window.scrollY
}

type Geometry = {
  /** How far the brand and the dock travel to their assembled places. */
  brandTravel: number
  dockTravel: number
  brandRight: number
  /** The glass: around the dock when split, the whole pill when assembled. */
  splitLeft: number
  splitRight: number
  pillLeft: number
  pillRight: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The one bar over every page. At the top of a page it is split: the brand
 * on the left and a pane of liquid glass on the right, holding the site
 * links, language, theme, messages and the account. Scrolling down slides
 * the brand in and stretches the glass over it into one pill in the middle
 * of the screen, following the scroll; scrolling back to the top splits it
 * again. It lives above the routes, so changing pages never rebuilds it:
 * only the lens under the current link moves.
 */
export function SiteBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // the first-run setup is not part of the site yet
  if (pathname.startsWith('/setup')) return null
  return <Bar pathname={pathname} />
}

function Bar(props: { pathname: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  // The console's frame on screen: its controls (the drawer's menu button)
  // go with the page that is up.
  const inConsole = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === '/_authenticated'),
  })
  // The lens goes with the address instead: it changes at the click, the
  // page only once it has loaded, and the lens must not wait for it.
  const headingToConsole = useMemo(
    () =>
      router
        .matchRoutes(props.pathname)
        .some((m) => m.routeId === '/_authenticated'),
    [router, props.pathname]
  )
  const dark = useSiteBarStore((s) => s.darkPages > 0)
  const quiet = useSiteBarStore((s) => s.quietPages > 0)
  const held = useSiteBarStore((s) => s.splitPages > 0)
  const signIn = useSiteBarStore((s) => s.signIn)
  const openMenu = useSiteBarStore((s) => s.openMenu)
  const user = useAuthStore((s) => s.auth.user)
  const bootstrapState = useAuthStore((s) => s.auth.bootstrapState)
  const signedIn = !!user
  const { displayName, roleLabel } = useUserDisplay(user)
  const { name, logo } = useBrand()
  const links = useTopNavLinks()
  const notifications = useNotifications()
  const prompt = useSignInPrompt()

  const barRef = useRef<HTMLElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const seamRef = useRef<HTMLSpanElement>(null)
  const morphRef = useRef<BarMorph | null>(null)
  const tracked = useRef<WeakMap<EventTarget, number> | null>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    const glass = glassRef.current
    const brand = brandRef.current
    const dock = dockRef.current
    const seam = seamRef.current
    if (!bar || !glass || !brand || !dock || !seam) return
    let geometry: Geometry | null = null

    const measure = () => {
      const width = bar.clientWidth
      const pillWidth =
        BRAND_INSET + brand.offsetWidth + SEAM + dock.offsetWidth
      const pillLeft = Math.round((width - pillWidth) / 2)
      geometry = {
        brandTravel: pillLeft + BRAND_INSET - brand.offsetLeft,
        dockTravel:
          pillLeft + BRAND_INSET + brand.offsetWidth + SEAM - dock.offsetLeft,
        brandRight: brand.offsetLeft + brand.offsetWidth,
        splitLeft: dock.offsetLeft,
        splitRight: dock.offsetLeft + dock.offsetWidth,
        pillLeft,
        pillRight: pillLeft + pillWidth,
      }
    }
    const paint = (q: number) => {
      let state = 'moving'
      if (q <= 0) state = 'split'
      if (q >= 1) state = 'assembled'
      bar.dataset.state = state
      if (!geometry) return
      const g = geometry
      const brandX = g.brandTravel * q
      brand.style.transform = `translate3d(${brandX}px,0,0)`
      dock.style.transform = `translate3d(${g.dockTravel * q}px,0,0)`
      const left = lerp(g.splitLeft, g.pillLeft, q)
      const right = lerp(g.splitRight, g.pillRight, q)
      glass.style.transform = `translate3d(${left}px,0,0)`
      glass.style.width = `${right - left}px`
      seam.style.transform = `translate3d(${g.brandRight + brandX + SEAM / 2}px,0,0)`
      seam.style.opacity = String(Math.min(1, Math.max(0, (q - 0.6) / 0.4)))
    }

    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const morph = new BarMorph({
      held,
      top: pageTop(),
      // opened from a page whose bar was together: start where it was
      start: takeHandoff(),
      onChange: paint,
      reducedMotion: () => still.matches,
    })
    morphRef.current = morph
    measure()
    paint(morph.value)

    // Where each followed scroller stood at its last event. Only the page's
    // own scroller moves the bar: content passes under the bar only there,
    // never in a table or a thread scrolling inside its page.
    const tops = new WeakMap<EventTarget, number>([[document, window.scrollY]])
    const readTop = (target: EventTarget): number | null => {
      if (target === document) return window.scrollY
      return target === pageScroller() ? pageTop() : null
    }
    const onScroll = (event: Event) => {
      const target = event.target ?? document
      const top = readTop(target)
      if (top === null) return
      const from = tops.get(target)
      tops.set(target, top)
      // first seen part-way down: where it came from is unknown
      if (from === undefined) morph.meet(top)
      else morph.scroll(from, top)
    }
    tracked.current = tops
    const onLeave = () => leaveHandoff(morph.value)
    // pageswap too: a page drawn ahead (the docs) may read the note first
    window.addEventListener('pageswap', onLeave)
    window.addEventListener('pagehide', onLeave)
    document.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    })
    // a new language, the account loading in, a phone turned sideways
    const observer = new ResizeObserver(() => {
      measure()
      paint(morph.value)
    })
    observer.observe(bar)
    observer.observe(brand)
    observer.observe(dock)
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('pageswap', onLeave)
      window.removeEventListener('pagehide', onLeave)
      observer.disconnect()
      morph.dispose()
      morphRef.current = null
      tracked.current = null
    }
    // the morph is built once; a new page goes through follow() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new page: its scroller (the window, or a new console scroller) may
  // stand anywhere, and the one that moved the bar may be gone. The address
  // changes at the click, while the old page stays until the new one has
  // loaded, so look once it has, on the frame after it is laid out.
  const loaded = useRouterState({
    select: (s) => s.resolvedLocation?.pathname,
  })
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      tracked.current?.set(pageScroller() ?? document, pageTop())
      morphRef.current?.follow(held, pageTop())
    })
    return () => cancelAnimationFrame(frame)
  }, [loaded, held])

  // The docs' copy of this bar shows the same avatar (see account-note.ts).
  // Forget it only once the session check has found nobody: while it runs
  // (or if it is rate limited) the reader may well still be signed in.
  useEffect(() => {
    if (user) {
      writeAccountNote(describeAccount(user, { displayName, roleLabel }))
    } else if (bootstrapState === 'complete') {
      writeAccountNote(null)
    }
  }, [user, bootstrapState, displayName, roleLabel])

  const onLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    link: TopNavLink
  ) => {
    if (link.disabled) {
      event.preventDefault()
      return
    }
    if (!signedIn && signIn && link.href === '/dashboard') {
      signIn(event)
      return
    }
    if (link.requiresAuth) {
      event.preventDefault()
      prompt.ask({ title: link.title, href: link.href })
    }
  }

  return (
    <>
      <header
        ref={barRef}
        data-site-bar=''
        data-state='split'
        inert={quiet}
        className={cn(
          'site-bar text-foreground pointer-events-none fixed inset-x-0 top-0 z-40 flex h-(--app-header-height) items-center justify-between gap-3 px-3 transition-opacity duration-450 md:px-4',
          dark && 'dark',
          quiet && 'opacity-0'
        )}
      >
        <LiquidGlass
          ref={glassRef}
          aria-hidden='true'
          material='dock'
          data-solid={dark ? '' : undefined}
          className='pointer-events-auto absolute top-1/2 left-0 h-10 -translate-y-1/2 rounded-full'
        />
        <span
          ref={seamRef}
          aria-hidden='true'
          className='absolute top-1/2 left-0 h-4 w-px -translate-y-1/2 bg-current/28 opacity-0'
        />
        <div
          ref={brandRef}
          className='pointer-events-auto relative flex h-10 min-w-0 shrink items-center gap-1 will-change-transform'
        >
          <Link
            to='/'
            className='focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-full py-1 outline-none focus-visible:ring-2'
          >
            <img
              src={logo}
              alt=''
              className='size-6 shrink-0 rounded-md object-cover'
            />
            <span className='max-w-40 truncate text-[15px] font-semibold tracking-tight transition-colors duration-500'>
              {name}
            </span>
          </Link>
          <SystemUpdateAction presentation='version' />
        </div>
        <div
          ref={dockRef}
          className='pointer-events-auto relative flex h-10 shrink-0 items-center gap-0.5 p-0.5 will-change-transform [&_.lucide]:stroke-[1.6] [&_button]:rounded-full'
        >
          {links.length > 0 && (
            <>
              <SiteNavLinks
                links={links}
                inConsole={headingToConsole}
                onLinkClick={onLinkClick}
                className='hidden lg:flex'
              />
              <DockDivider className='hidden lg:block' />
            </>
          )}
          <LanguageSwitcher />
          <ThemeToggle className='size-9' />
          {signedIn ? (
            <>
              <NotificationPopover
                open={notifications.popoverOpen}
                onOpenChange={notifications.setPopoverOpen}
                unreadCount={notifications.unreadCount}
                activeTab={notifications.activeTab}
                onTabChange={notifications.setActiveTab}
                notice={notifications.notice}
                announcements={notifications.announcements}
                loading={notifications.loading}
              />
              <AccountMenu />
            </>
          ) : (
            <Button
              size='sm'
              data-bar-skip=''
              className='mx-0.5 h-8 rounded-full px-3.5 text-xs font-medium'
              render={<Link to='/sign-in' />}
              onClick={(event) => signIn?.(event)}
            >
              {t('Sign in')}
            </Button>
          )}
          {inConsole && openMenu ? (
            <MenuButton className='md:hidden' onClick={openMenu} />
          ) : (
            <SiteMenu
              links={links}
              inConsole={inConsole}
              onLinkClick={onLinkClick}
              className='lg:hidden'
            />
          )}
        </div>
      </header>
      {prompt.dialog}
    </>
  )
}
