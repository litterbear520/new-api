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
import { useCallback, useState, type MouseEvent } from 'react'

export type NightSeaAuthView = 'sign-in' | 'sign-up'

type Point = { x: number; y: number }

export type DialogState = {
  open: boolean
  view: NightSeaAuthView
  /** Centre of the button that opened the dialog; the card grows out of it. */
  origin: Point | null
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
  })

  const trigger = useCallback(
    (view: NightSeaAuthView) => (e: MouseEvent<HTMLElement>) => {
      // Modified clicks still open the full page, e.g. in a new tab.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      e.preventDefault()
      const box = e.currentTarget.getBoundingClientRect()
      setState({
        open: true,
        view,
        origin: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
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

  return {
    open: state.open,
    trigger,
    dialogProps: { ...state, onOpenChange, onViewChange },
  }
}
