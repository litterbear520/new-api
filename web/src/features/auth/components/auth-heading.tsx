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

type AuthHeadingProps = {
  title: string
  children?: ReactNode
}

/** Centered serif title shared by the auth pages, with optional copy below. */
export function AuthHeading(props: AuthHeadingProps) {
  return (
    <div className='mb-6 flex w-full flex-col items-center gap-1.5 text-center'>
      <h1 className='font-serif text-[1.625rem] leading-snug font-normal tracking-[0.08em]'>
        {props.title}
      </h1>
      {props.children && (
        <div className='text-muted-foreground flex flex-col gap-1.5 text-sm'>
          {props.children}
        </div>
      )}
    </div>
  )
}
