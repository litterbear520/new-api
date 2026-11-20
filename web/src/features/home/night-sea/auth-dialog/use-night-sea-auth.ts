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
  useRef,
  useState,
  type MouseEvent,
} from 'react'

export type NightSeaAuthView = 'sign-in' | 'sign-up'

type Point = { x: number; y: number }

export type DialogState = {
  open: boolean
  view: NightSeaAuthView
  /** Centre of the button that opened the dialog; the card grows out of it. */
  origin: Point | null
  /** Opened by a tap: no field takes focus, so no keyboard comes up. */
  byTouch: boolean
}

/** How long a closed dialog waits for its opener to take focus again. */
const RETURN_FOCUS_WAIT_MS = 1000

/**
 * Give focus back to the control that opened the dialog, once it can take
 * it: the site bar stays inert for a moment after the dialog has gone. If
 * the reader has already put focus somewhere else, leave it there.
 */
function returnFocusWhenReady(opener: HTMLElement) {
  const since = performance.now()
  const attempt = () => {
    if (!opener.isConnected) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    if (!opener.closest('[inert]')) {
      opener.focus({ preventScroll: true })
      if (document.activeElement === opener) return
    }
    if (performance.now() - since < RETURN_FOCUS_WAIT_MS) {
      requestAnimationFrame(attempt)
    }
  }
  // after the dialog has left the page, as Base UI's own return does
  queueMicrotask(attempt)
}

/**
 * Sign-in on the home page itself: the links keep their real targets, and a
 * plain click opens the dialog over the running sky instead. `opened` starts
 * with the dialog open, for the /sign-in and /sign-up pages.
 */
export function useNightSeaAuth(opened?: NightSeaAuthView) {
  const [state, setState] = useState<DialogState>({
    open: opened !== undefined,
    view: opened ?? 'sign-in',
    origin: null,
    byTouch: false,
  })

  // A click doesn't say what made it, so keep the last press's pointer.
  const pointer = useRef('')
  useEffect(() => {
    const press = (e: PointerEvent) => {
      pointer.current = e.pointerType
    }
    window.addEventListener('pointerdown', press, { capture: true })
    return () =>
      window.removeEventListener('pointerdown', press, { capture: true })
  }, [])

  // The control that opened the dialog: focus goes back to it on close.
  // Base UI would only find the page's body, as the site bar's 登录 is inert
  // by the time the dialog has loaded and mounted.
  const opener = useRef<HTMLElement | null>(null)
  const openRef = useRef(state.open)
  useLayoutEffect(() => {
    openRef.current = state.open
  })

  const trigger = useCallback(
    (view: NightSeaAuthView) => (e: MouseEvent<HTMLElement>) => {
      // Modified clicks still open the full page, e.g. in a new tab.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      e.preventDefault()
      opener.current = e.currentTarget
      const box = e.currentTarget.getBoundingClientRect()
      setState({
        open: true,
        view,
        origin: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
        // detail 0: the keyboard's Enter, whatever was pressed before it
        byTouch: e.detail !== 0 && pointer.current === 'touch',
      })
    },
    []
  )

  const onOpenChange = useCallback((open: boolean) => {
    setState((s) => ({ ...s, open }))
  }, [])
  const onViewChange = useCallback((view: NightSeaAuthView) => {
    setState((s) => ({ ...s, view }))
  }, [])

  // Base UI's finalFocus, asked as the dialog goes: false tells it to leave
  // focus alone, true (no opener, as on the /sign-in page) to do its default.
  const finalFocus = useCallback(() => {
    const el = opener.current
    if (!el) return true
    if (openRef.current) return false
    opener.current = null
    returnFocusWhenReady(el)
    return false
  }, [])

  return {
    open: state.open,
    trigger,
    dialogProps: { ...state, onOpenChange, onViewChange, finalFocus },
  }
}
