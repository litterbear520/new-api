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
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import { create } from 'zustand'

type ClickHandler = (event: MouseEvent<HTMLElement>) => void

type SiteBarState = {
  /** Pages that want the dark glass whatever the theme (the night sea). */
  darkPages: number
  /** Pages that hold something over everything (the night sea's sign-in). */
  quietPages: number
  /** Work areas that keep the bar split whatever scrolls (chat, the canvas). */
  splitPages: number
  /** A page's own sign-in, e.g. the night sea's dialog over the sky. */
  signIn: ClickHandler | null
  /** The console's drawer, opened by the phone menu button. */
  openMenu: (() => void) | null
}

export const useSiteBarStore = create<SiteBarState>(() => ({
  darkPages: 0,
  quietPages: 0,
  splitPages: 0,
  signIn: null,
  openMenu: null,
}))

/** The bar wears dark glass while this page is up (pages on the night sky). */
export function useDarkSiteBar() {
  useEffect(() => {
    useSiteBarStore.setState((s) => ({ darkPages: s.darkPages + 1 }))
    return () =>
      useSiteBarStore.setState((s) => ({ darkPages: s.darkPages - 1 }))
  }, [])
}

/** The bar steps back while `quiet` holds, e.g. a dialog over the page. */
export function useQuietSiteBar(quiet: boolean) {
  useEffect(() => {
    if (!quiet) return
    useSiteBarStore.setState((s) => ({ quietPages: s.quietPages + 1 }))
    return () =>
      useSiteBarStore.setState((s) => ({ quietPages: s.quietPages - 1 }))
  }, [quiet])
}

/**
 * The bar stays split while this page is up: a full-screen work area (chat,
 * the drawing canvas) whose own scrolling must not move it.
 */
export function useSplitSiteBar() {
  useEffect(() => {
    useSiteBarStore.setState((s) => ({ splitPages: s.splitPages + 1 }))
    return () =>
      useSiteBarStore.setState((s) => ({ splitPages: s.splitPages - 1 }))
  }, [])
}

/**
 * While this page is up, the bar's 登录 (and, signed out, 控制台) call
 * `handler` first; it may preventDefault to keep the reader on the page.
 * Pass undefined to leave the links alone.
 */
export function useSiteBarSignIn(handler: ClickHandler | undefined) {
  const latest = useRef(handler)
  useLayoutEffect(() => {
    latest.current = handler
  })
  const active = handler !== undefined
  useEffect(() => {
    if (!active) return
    const signIn: ClickHandler = (event) => latest.current?.(event)
    useSiteBarStore.setState({ signIn })
    return () =>
      useSiteBarStore.setState((s) => (s.signIn === signIn ? { signIn: null } : s))
  }, [active])
}

/** The phone menu button opens this instead of the site menu (the console's drawer). */
export function useSiteBarMenu(open: () => void) {
  const latest = useRef(open)
  useLayoutEffect(() => {
    latest.current = open
  })
  useEffect(() => {
    const openMenu = () => latest.current()
    useSiteBarStore.setState({ openMenu })
    return () =>
      useSiteBarStore.setState((s) =>
        s.openMenu === openMenu ? { openMenu: null } : s
      )
  }, [])
}
