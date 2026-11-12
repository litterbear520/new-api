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
import { Dialog } from '@base-ui/react/dialog'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useTranslation } from 'react-i18next'

import { TermsFooter } from '@/features/auth/components/terms-footer'
import { UserAuthForm } from '@/features/auth/sign-in/components/user-auth-form'
import { SignUpForm } from '@/features/auth/sign-up/components/sign-up-form'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { startLiquidGlass } from './liquid-glass'
import type { DialogState, NightSeaAuthView } from './use-night-sea-auth'

import './auth-dialog.css'

type NightSeaAuthDialogProps = DialogState & {
  /** The home page's sky, which the glass refracts. */
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** A WebGL sky's frames, to copy it while it can be read (see startLiquidGlass) */
  skyFrames?: (fn: () => void) => () => void
  /** Where to go after signing in, e.g. the console page that sent the user here. */
  redirectTo?: string
  onOpenChange: (open: boolean) => void
  onViewChange: (view: NightSeaAuthView) => void
}

const PHONE = '(max-width: 640px)'

export function NightSeaAuthDialog(props: NightSeaAuthDialogProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const canRegister =
    !status?.self_use_mode_enabled && status?.register_enabled !== false
  const view = canRegister ? props.view : 'sign-in'
  const {
    onOpenChange,
    onViewChange,
    canvasRef,
    skyFrames,
    open,
    origin,
    byTouch,
  } = props

  // Elements as state, so effects run once the portal has mounted them.
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  const [glass, setGlass] = useState<HTMLCanvasElement | null>(null)
  const [pane, setPane] = useState<HTMLElement | null>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [frosted, setFrosted] = useState(false)

  // Liquid glass while the dialog is open; frosted glass if WebGL is missing or lost.
  useEffect(() => {
    if (!open || !card || !glass) return
    const sky = canvasRef.current
    const stop = sky
      ? startLiquidGlass({
          card,
          glass,
          sky,
          skyFrames,
          onLost: () => setFrosted(true),
        })
      : null
    if (!stop) {
      setFrosted(true)
      return
    }
    // the sky may have come back (a phone's still picture, then a wider window)
    setFrosted(false)
    return stop
  }, [open, card, glass, canvasRef, skyFrames])

  // The card follows its content's height. On desktop it sits centred in the
  // sky above the horizon while it fits; on phones it is a sheet over the sea.
  // The top goes through --ns-auth-top, which the CSS max-height also reads,
  // so a card taller than the screen stops 16px above its bottom and scrolls.
  useLayoutEffect(() => {
    const sizer = sizerRef.current
    if (!card || !pane || !sizer) return
    const phone = window.matchMedia(PHONE)
    const fit = () => {
      const h = pane.offsetHeight
      sizer.style.height = `${h}px`
      if (phone.matches) {
        card.style.removeProperty('--ns-auth-top')
        return
      }
      const shown = Math.min(h, window.innerHeight - 32)
      let top = Math.max(76, (window.innerHeight * 0.74 - shown) / 2)
      if (top + shown > window.innerHeight - 16) {
        top = Math.max(16, (window.innerHeight - shown) / 2)
      }
      card.style.setProperty('--ns-auth-top', `${Math.round(top)}px`)
    }
    fit()
    // Animate later height changes (next step, switching views), not the first fit.
    const settle = requestAnimationFrame(() =>
      card.setAttribute('data-settled', '')
    )
    const observer = new ResizeObserver(fit)
    observer.observe(pane)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(settle)
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [card, pane])

  // Grow out of the button that was pressed.
  useLayoutEffect(() => {
    if (!card) return
    if (!origin || window.matchMedia(PHONE).matches) {
      card.style.transformOrigin = ''
      return
    }
    const left = (window.innerWidth - card.offsetWidth) / 2
    const top =
      Number.parseFloat(card.style.getPropertyValue('--ns-auth-top')) || 0
    card.style.transformOrigin = `${origin.x - left}px ${origin.y - top}px`
  }, [card, origin])

  // Where the form runs past the card, that edge fades to show it scrolls on.
  useEffect(() => {
    const body = bodyRef.current
    const sizer = sizerRef.current
    if (!card || !body || !sizer) return
    const edges = () => {
      const below = body.scrollHeight - body.clientHeight - body.scrollTop
      body.toggleAttribute('data-more-above', body.scrollTop > 1)
      body.toggleAttribute('data-more-below', below > 1)
    }
    edges()
    const observer = new ResizeObserver(edges)
    observer.observe(body)
    observer.observe(sizer)
    body.addEventListener('scroll', edges, { passive: true })
    return () => {
      observer.disconnect()
      body.removeEventListener('scroll', edges)
    }
  }, [card])

  // On phones the keyboard shrinks the visual viewport; keep the sheet above it.
  useEffect(() => {
    const vv = window.visualViewport
    if (!card || !vv) return
    const phone = window.matchMedia(PHONE)
    const lift = () => {
      const covered = phone.matches
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0
      card.style.marginBottom = covered ? `${covered}px` : ''
      card.style.maxHeight = covered ? `${vv.height - 24}px` : ''
    }
    vv.addEventListener('resize', lift)
    vv.addEventListener('scroll', lift)
    return () => {
      vv.removeEventListener('resize', lift)
      vv.removeEventListener('scroll', lift)
    }
  }, [card])

  // A tap opens without the keyboard; otherwise the first field takes focus.
  // Base UI's own open type only comes from its Trigger, which isn't used here.
  const initialFocus = useCallback(() => {
    if (byTouch) return card
    return (
      card?.querySelector<HTMLElement>(
        'input:not([type=hidden]):not([tabindex="-1"])'
      ) ?? true
    )
  }, [card, byTouch])

  const signIn = view === 'sign-in'

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className='ns-auth-veil' />
        <Dialog.Popup
          ref={setCard}
          initialFocus={initialFocus}
          className={cn(
            'ns-auth auth-cosmos dark',
            frosted && 'ns-auth-frosted'
          )}
        >
          <canvas ref={setGlass} className='ns-auth-glass' aria-hidden='true' />
          {/* Outside the scrolling body, so it stays in reach */}
          <Dialog.Close className='ns-auth-close' aria-label={t('Close')}>
            <svg viewBox='0 0 16 16' aria-hidden='true'>
              <path
                d='M3.5 3.5l9 9M12.5 3.5l-9 9'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
            </svg>
          </Dialog.Close>
          <div ref={bodyRef} className='ns-auth-body'>
            <div ref={sizerRef} className='ns-auth-sizer'>
              <section key={view} ref={setPane} className='ns-auth-pane'>
                <header className='ns-auth-head'>
                  <svg
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                    className='ns-auth-mark'
                  >
                    <path
                      d='M0 11.95H3V4.5H4.5V3H7.5V4.5H9V6H15V4.5H16.5V3H19.5V4.5H21V11.95H24V15.05H21V18.08H19.5V21H16.5V18.08H7.5V21H4.5V18.08H3V15.05H0Z'
                      fill='#D97757'
                    />
                    <path
                      d='M4.5 4.5H7.5V6H4.5ZM16.5 4.5H19.5V6H16.5Z'
                      fill='#EFA585'
                    />
                    <path d='M9.75 11.95H14.25V15.05H9.75Z' fill='#FBE9DA' />
                    <path
                      d='M6 9.1H7.488V11.95H6ZM10.875 11.95H13.125V13.3H10.875ZM16.51 9.1H18V11.95H16.51Z'
                      fill='#1F1A17'
                    />
                  </svg>
                  <Dialog.Title className='ns-auth-title'>
                    {signIn ? t('Sign in') : t('Create an account')}
                  </Dialog.Title>
                </header>

                {signIn ? (
                  <UserAuthForm
                    className='w-full'
                    redirectTo={props.redirectTo}
                  />
                ) : (
                  <SignUpForm
                    className='w-full'
                    onRegistered={() => onViewChange('sign-in')}
                  />
                )}

                <TermsFooter
                  variant={view}
                  status={status}
                  className='ns-auth-terms'
                />

                {signIn && canRegister && (
                  <p className='ns-auth-swap'>
                    {t("Don't have an account?")}
                    <button
                      type='button'
                      onClick={() => onViewChange('sign-up')}
                    >
                      {t('Sign up')}
                    </button>
                  </p>
                )}
                {!signIn && (
                  <p className='ns-auth-swap'>
                    {t('Already have an account?')}
                    <button
                      type='button'
                      onClick={() => onViewChange('sign-in')}
                    >
                      {t('Sign in')}
                    </button>
                  </p>
                )}
              </section>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
