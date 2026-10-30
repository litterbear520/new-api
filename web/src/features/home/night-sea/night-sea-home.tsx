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
import { Gateway } from '../black-hole/gateway'
import {
  PHONE_QUERY,
  afterFirstPaint,
  canDrawBlackHole,
  layoutNow,
  subscribeLayout,
} from '../black-hole/support'
import posterDesktop from '../black-hole/tex/hole-desktop.webp'
import posterPhone from '../black-hole/tex/hole-phone.webp'
import { NightSeaAuthDialog } from './auth-dialog/night-sea-auth-dialog'
import {
  useNightSeaAuth,
  type NightSeaAuthView,
} from './auth-dialog/use-night-sea-auth'
import { HERO, HERO_SHELL_ID, POSTER_FADE_MS, WORDS_FADE_MS } from './hero-copy'
import { dropHeroShell } from './hero-shell'
import { HomeEnd, HomeSections } from './sections'
import { heroOffer } from './sections-content'
import { useCopyLabel } from './use-copy-label'
import { useHomeOffers } from './use-home-offers'

import './night-sea.css'
import '../black-hole/black-hole.css'

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

type NightSeaHomeProps = {
  isAuthenticated: boolean
  /** Arrive with this dialog open: the /sign-in and /sign-up pages. */
  authView?: NightSeaAuthView
  /** Where signing in from that dialog leads. */
  redirectTo?: string
}

/**
 * The default home page: a first screen over the black hole and the night
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const posterRef = useRef<HTMLImageElement>(null)
  const firstRef = useRef<HTMLElement>(null)
  const { systemName } = useSystemConfig()
  const navigate = useNavigate()
  const auth = useNightSeaAuth(props.authView)
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
  const offer = heroOffer(useHomeOffers())
  // Every line (domain) shows its own address.
  const baseUrl = `${window.location.origin}/v1`
  const copyBaseUrl = useCopyLabel(baseUrl)

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
            <source media={PHONE_QUERY} srcSet={posterPhone} />
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
            {/* the offer's place is kept until it comes (black-hole.css) */}
            <div className='ns-offer-slot'>
              {offer && (
                <Link to='/activity' className='ns-offer-pill'>
                  <span className='ns-offer-tag'>活动</span>
                  {offer}
                  <span aria-hidden='true'>›</span>
                </Link>
              )}
            </div>
            <h1>
              <span className='ns-phrase'>{HERO.title[0]}</span>{' '}
              <span className='ns-phrase'>{HERO.title[1]}</span>
            </h1>
            <p className='ns-poem'>
              <span className='ns-phrase'>{HERO.poem[0]}</span>{' '}
              <span className='ns-phrase'>{HERO.poem[1]}</span>
            </p>
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
            <div className='ns-endpoint'>
              <code translate='no'>{baseUrl}</code>
              <button
                type='button'
                onClick={copyBaseUrl.copy}
                aria-live='polite'
              >
                {copyBaseUrl.label}
              </button>
            </div>
          </div>

          <div className='ns-shore'>
            <p className='ns-prayer'>{HERO.prayer}</p>
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

        <HomeSections
          name={name}
          isAuthenticated={props.isAuthenticated}
          authClick={authClick}
          gateway={<Gateway />}
        />
      </main>

      <HomeEnd
        name={name}
        isAuthenticated={props.isAuthenticated}
        authClick={authClick}
        skyCredit
      />

      <NightSeaAuthDialog
        canvasRef={canvasRef}
        skyFrames={live ? frames.subscribe : undefined}
        redirectTo={props.redirectTo}
        {...auth.dialogProps}
        onOpenChange={onOpenChange}
      />
    </div>
  )
}
