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
import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * The console's one scroller. It starts under the site bar, which floats
 * over it, and the page slides under the bar's glass. A page marked data-page-scroll (Main's
 * pageScroll) grows with its content; the others fit the height and scroll
 * inside themselves. Every page opens at the top, and in-page jumps stop
 * below the bar.
 */
export function ConsoleScroller(props: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0
  }, [pathname])

  return (
    <div
      ref={ref}
      data-slot='console-scroller'
      className='flex min-h-0 flex-1 scroll-pt-(--app-header-height) flex-col overflow-x-hidden overflow-y-auto'
    >
      <div aria-hidden='true' className='h-(--app-header-height) shrink-0' />
      <div className='flex min-h-0 flex-1 flex-col has-[[data-page-scroll]]:flex-[1_0_auto]'>
        {props.children}
      </div>
    </div>
  )
}
