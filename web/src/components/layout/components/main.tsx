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
import { cn } from '@/lib/utils'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  fluid?: boolean
  /**
   * The page scrolls as a whole, under the top bar's glass: the console
   * scroller grows around it (see console-scroller). Otherwise the page fits
   * the height and scrolls inside itself.
   */
  pageScroll?: boolean
}

export function Main({
  className,
  fluid = true,
  pageScroll,
  ...props
}: MainProps) {
  return (
    <main
      data-page-scroll={pageScroll || undefined}
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        pageScroll && 'overflow-visible',
        !fluid &&
          '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...props}
    />
  )
}
