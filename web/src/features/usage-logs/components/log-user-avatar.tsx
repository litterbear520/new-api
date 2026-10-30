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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface LogUserAvatarProps {
  /** The name the initial and the colour come from. */
  name: string
  /** False while sensitive data is hidden: a grey dot instead. */
  visible: boolean
  className?: string
}

/**
 * The small user avatar of the logs lists. It hides the shared Avatar's
 * blended ::after border: with one avatar per row, Chrome gives every blend a
 * layer of its own and painted blank tiles over the admin logs.
 */
export function LogUserAvatar(props: LogUserAvatarProps) {
  return (
    <Avatar
      className={cn(
        'ring-border/60 size-6 ring-1 after:hidden',
        props.className
      )}
    >
      <AvatarFallback
        className='text-[11px] font-semibold'
        style={props.visible ? getUserAvatarStyle(props.name) : undefined}
      >
        {props.visible ? getUserAvatarFallback(props.name) : '•'}
      </AvatarFallback>
    </Avatar>
  )
}
