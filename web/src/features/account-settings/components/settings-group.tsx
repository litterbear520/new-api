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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * One block of the 账户设置 page: a card with the title and one line at the
 * top and the rows under it, the same frame as the login-session and
 * access-token cards it sits next to.
 */
export function SettingsGroup(props: {
  id?: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  const headingId = props.id ? `${props.id}-title` : undefined
  return (
    <section
      id={props.id}
      aria-labelledby={headingId}
      className='bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1'
    >
      <div className='min-w-0 border-b p-4'>
        <h2 id={headingId} className='text-base leading-snug font-medium'>
          {props.title}
        </h2>
        {props.description && (
          <p className='text-muted-foreground mt-1 text-sm'>
            {props.description}
          </p>
        )}
      </div>
      <div className='divide-y'>{props.children}</div>
    </section>
  )
}

/** Name and one line on the left, the value, then an action on the right */
export function SettingsRow(props: {
  label: ReactNode
  description?: ReactNode
  value?: ReactNode
  children?: ReactNode
  /** Red label, for 删除账号 */
  danger?: boolean
}) {
  return (
    <div className='flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4'>
      <div className='min-w-0 sm:w-2/5 sm:shrink-0'>
        <div
          className={cn(
            'text-sm font-medium',
            props.danger && 'text-destructive'
          )}
        >
          {props.label}
        </div>
        {props.description && (
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {props.description}
          </p>
        )}
      </div>
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2'>
        {props.value !== undefined && (
          <div className='min-w-0 flex-1 text-sm break-words'>
            {props.value}
          </div>
        )}
        {props.children && (
          <div className='ms-auto flex shrink-0 flex-wrap items-center gap-2'>
            {props.children}
          </div>
        )}
      </div>
    </div>
  )
}
