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
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from 'react'

import {
  useDarkSiteBar,
  useQuietSiteBar,
  useSiteBarSignIn,
} from '@/components/site-bar/store'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { preloadSky } from '../black-hole/assets'
import {
  PHONE_QUERY,
  afterFirstPaint,
  canDrawBlackHole,
  layoutNow,
  subscribeLayout,
} from '../black-hole/support'
import posterDesktopAvif from '../black-hole/tex/hole-desktop.avif'
import posterDesktop from '../black-hole/tex/hole-desktop.webp'
import posterPhoneAvif from '../black-hole/tex/hole-phone.avif'
import posterPhone from '../black-hole/tex/hole-phone.webp'
import {
  useNightSeaAuth,
  type NightSeaAuthView,
} from './auth-dialog/use-night-sea-auth'
import { whenBelowFoldWanted } from './below-fold'
import {
  HERO,
  HERO_SHELL_ID,
  PHONE_POSTER_QUERY,
  POSTER_FADE_MS,
  WORDS_FADE_MS,
} from './hero-copy'
import { dropHeroShell } from './hero-shell'

import './night-sea.css'
import '../black-hole/black-hole.css'

// Comes while the visitor reads the first screen: if the line fails it then, the
// first screen stays as it is instead of giving way to an error page
const nothing = () => <div hidden />
const loadBelow = (): Promise<typeof import('./home-below')> =>
  import('./home-below').catch(() => ({
    BelowSections: nothing,
    HomeEnd: nothing,
  }))
const BelowSections = lazy(() =>
  loadBelow().then((m) => ({ default: m.BelowSections }))
)
const HomeEnd = lazy(() => loadBelow().then((m) => ({ default: m.HomeEnd })))

// The sign-in dialog's code comes with what lies below, or on the first click
const loadAuthDialog = () => import('./auth-dialog/night-sea-auth-dialog')
const NightSeaAuthDialog = lazy(() =>
  loadAuthDialog().then((m) => ({ default: m.NightSeaAuthDialog }))
)

/** Calls back after each frame of the sky, while its picture can be read */
type FrameHub = {
  emit: () => void
  subscribe: (fn: () => void) => () => void
}
function frameHub(): FrameHub {
  const fns = new Set<() => void>()
  return {
    emit: () => {
      for (const fn of fns) fn()
    },
    subscribe: (fn) => {
      fns.add(fn)
      return () => fns.delete(fn)
    },
  }
}

function BelowWait() {
  return <div className='ns-sections ns-below-wait' id='ns-more' />
}

type NightSeaHomeProps = {
  isAuthenticated: boolean
  /** Arrive with this dialog open: the /sign-in and /sign-up pages. */
  authView?: NightSeaAuthView
  /** Where signing in from that dialog leads. */
  redirectTo?: string
}

/**
 * The default home page: a first screen over the black hole and a small night
 * Earth (../black-hole), the gateway under it, the night carrying on below.
 * Always dark, whatever the console theme. The first screen's poster comes
 * with the page's HTML (hero-shell.ts); the hole is drawn live over it where
 * the browser can (a computer's screen, motion welcome), only while the first
 * screen shows; otherwise, or if the GPU gives out, the poster stays.
 */
export function NightSeaHome(props: NightSeaHomeProps) {
  const [failed, setFailed] = useState(false)
  const [frames] = useState(frameHub)
  // phones get the still picture; turned or resized past that, the page chooses again
  useSyncExternalStore(subscribeLayout, layoutNow, () => '')
  const live =
    !failed &&
    !window.matchMedia(PHONE_QUERY).matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    canDrawBlackHole()
  // the browser's own colours (its bar on a phone) go with the night: see
  // use-theme-color-meta.ts, which reads the body's colour on this class change
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('ns-night-page')
    return () => root.classList.remove('ns-night-page')
  }, [])
  const [below, setBelow] = useState(false)
  useEffect(() => whenBelowFoldWanted(() => setBelow(true)), [])
  useEffect(() => {
    if (below) void loadAuthDialog().catch(() => undefined)
  }, [below])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const posterRef = useRef<HTMLImageElement>(null)
  const firstRef = useRef<HTMLElement>(null)
  const { systemName } = useSystemConfig()
  const navigate = useNavigate()
  const auth = useNightSeaAuth(props.authView)
  const [dialogWanted, setDialogWanted] = useState(auth.open)
  useEffect(() => {
    if (auth.open) setDialogWanted(true)
  }, [auth.open])
  // On /sign-in and /sign-up, closing the dialog leaves for the home page.
  const onOpenChange = (open: boolean) => {
    auth.dialogProps.onOpenChange(open)
    if (!open && props.authView) void navigate({ to: '/', replace: true })
  }
  // Signed out, these open sign-in over the sky; the links stay as fallbacks.
  const authClick = (view: NightSeaAuthView) =>
    props.isAuthenticated ? undefined : auth.trigger(view)
  // The site bar over the sky: dark glass, and its 登录 opens the dialog too.
  useDarkSiteBar()
  useSiteBarSignIn(authClick('sign-in'))
  useQuietSiteBar(auth.open)
  const name = systemName || '小熊API'

  // The page's HTML showed this first screen already (hero-shell.ts), over
  // this one, its words on their way in: these pick up where those are. It
  // goes once this poster can show and the HTML's words and poster are all
  // the way up, if they were still coming up: unseen.
  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(`#${HERO_SHELL_ID}`)
    const first = firstRef.current
    const at = Number(shell?.dataset.at)
    if (at && first && typeof first.getAnimations === 'function') {
      const elapsed = performance.now() - at
      for (const a of first.getAnimations({ subtree: true })) {
        // the words' way in (not the fade that follows the page's scroll)
        if (a.timeline === document.timeline) a.currentTime = elapsed
      }
    }
    const poster = posterRef.current
    if (!shell || !poster?.decode) return dropHeroShell()
    // from now on clicks, keys and screen readers reach this page's own
    // buttons, right under the HTML's
    shell.inert = true
    shell.style.pointerEvents = 'none'
    const shellPoster =
      shell.querySelector<HTMLImageElement>('.ns-sky-poster img')
    const since = performance.now()
    let handed = false
    const handOver = () => {
      if (handed) return
      // its words still waiting for their font, its poster for its picture:
      // wait with them (not for long)
      const waiting =
        shell.classList.contains('ns-shell-wait') ||
        (shellPoster !== null && !shellPoster.dataset.in)
      if (waiting && performance.now() - since < 2000) {
        window.setTimeout(handOver, 100)
        return
      }
      handed = true
      const now = performance.now()
      const words = Number(shell.dataset.words ?? -1e9)
      const lit = Number(shellPoster?.dataset.in ?? -1e9)
      window.setTimeout(
        dropHeroShell,
        Math.max(0, WORDS_FADE_MS - (now - words), POSTER_FADE_MS - (now - lit))
      )
    }
    poster.decode().then(handOver).catch(handOver)
    // a picture that never says it is ready (on a slow line it may take long)
    window.setTimeout(handOver, 20_000)
  }, [])
  // the sign-in dialog dims this page's words: the HTML's go at once
  useEffect(() => {
    if (auth.open) dropHeroShell()
  }, [auth.open])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!live || !canvas) return
    // The black hole's engine is its own chunk. It and its pictures load once
    // the page's words have been painted: the words come first.
    const run = new AbortController()
    const fallBack = () => {
      if (!run.signal.aborted) setFailed(true)
    }
    const start = () => {
      preloadSky()
      import(/* webpackChunkName: "black-hole" */ '../black-hole/engine')
        .then(({ startBlackHole }) =>
          startBlackHole(canvas, {
            signal: run.signal,
            onFrame: frames.emit,
            onFail: fallBack,
          })
        )
        .catch(fallBack)
    }
    const cancel = afterFirstPaint(start)
    return () => {
      cancel()
      run.abort()
    }
  }, [live, frames])

  // The page goes down to the first section without changing the address
  const showMore = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .querySelector('#ns-more')
      ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })
  }

  return (
    <div className={cn('night-sea ns-hole', auth.open && 'ns-auth-open')}>
      <main>
        <section ref={firstRef} className='ns-first' aria-label={name}>
          {/* the poster, and the live sky over it where it can be drawn */}
          <picture className='ns-sky ns-sky-poster'>
            <source
              media={PHONE_POSTER_QUERY}
              type='image/avif'
              srcSet={posterPhoneAvif}
            />
            <source media={PHONE_POSTER_QUERY} srcSet={posterPhone} />
            <source type='image/avif' srcSet={posterDesktopAvif} />
            <img ref={posterRef} src={posterDesktop} alt='' />
          </picture>
          {live && (
            <canvas
              ref={canvasRef}
              className='ns-sky ns-sky-hole'
              aria-hidden='true'
            />
          )}
          <div className='ns-sky-fade' aria-hidden='true' />
          <div className='ns-hero'>
            <h1>
              <span className='ns-phrase'>{HERO.title[0]}</span>{' '}
              <span className='ns-phrase'>{HERO.title[1]}</span>
            </h1>
            <p className='ns-what'>
              <span className='ns-phrase'>{HERO.what[0]}</span>{' '}
              <span className='ns-phrase'>{HERO.what[1]}</span>
            </p>
            <div className='ns-actions'>
              <Link
                to={props.isAuthenticated ? '/dashboard' : '/sign-up'}
                onClick={authClick('sign-up')}
                className='ns-pill ns-pill-solid'
              >
                {HERO.start}
              </Link>
              <a href='/docs/' className='ns-pill ns-pill-quiet'>
                {HERO.docs}
              </a>
            </div>
          </div>

          <div className='ns-shore'>
            <a
              href='#ns-more'
              onClick={showMore}
              className='ns-more'
              aria-label={HERO.more}
            >
              <svg viewBox='0 0 20 20' aria-hidden='true'>
                <path d='M5 8l5 5 5-5' />
              </svg>
            </a>
          </div>
        </section>

        {/* the room to scroll into, and where the arrow goes, until it is in */}
        <Suspense fallback={<BelowWait />}>
          {below ? (
            <BelowSections
              name={name}
              isAuthenticated={props.isAuthenticated}
              authClick={authClick}
            />
          ) : (
            <BelowWait />
          )}
        </Suspense>
      </main>

      {below && (
        <Suspense fallback={null}>
          <HomeEnd
            name={name}
            isAuthenticated={props.isAuthenticated}
            authClick={authClick}
            skyCredit
          />
        </Suspense>
      )}

      {(dialogWanted || auth.open) && (
        <Suspense
          fallback={
            auth.open ? (
              <div
                className='ns-auth-wait'
                role='status'
                aria-label='正在打开'
              />
            ) : null
          }
        >
          <NightSeaAuthDialog
            canvasRef={canvasRef}
            skyFrames={live ? frames.subscribe : undefined}
            redirectTo={props.redirectTo}
            {...auth.dialogProps}
            onOpenChange={onOpenChange}
          />
        </Suspense>
      )}
    </div>
  )
}
