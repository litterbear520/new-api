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
import { ChevronDown, Pencil, Search, SquarePen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { coverOf, roomItems, useDrawStore } from '@/stores/draw-store'

import { useImageUrl } from '../hooks/use-image-url'
import { deleteRoomWithUndo, renameRoom } from '../lib/actions'
import type { DrawRoom } from '../types'
import { Bear } from './bear'
import { useRelativeTime } from './relative-time'

function RoomRow(props: { room: DrawRoom }) {
  const { t } = useTranslation()
  const ago = useRelativeTime()
  const cover = coverOf(props.room)
  const url = useImageUrl(cover?.id, 'thumb')
  const drawing = roomItems(props.room).some((it) => it.status === 'pending')
  return (
    <>
      {url ? (
        <img className='dw-rimg' src={url} alt='' />
      ) : (
        <span className='dw-rimg' />
      )}
      <span className='dw-mi-tx'>
        <span>{props.room.title}</span>
        <small>
          {drawing ? (
            <>
              <Bear mode='hop' className='dw-kb-mini' />
              {t('Drawing…')}
            </>
          ) : (
            ago(props.room.t)
          )}
        </small>
      </span>
    </>
  )
}

/** The conversation title: switch, search, rename, delete. */
export function RoomSwitcher(props: { room: DrawRoom }) {
  const { t } = useTranslation()
  const rooms = useDrawStore((s) => s.rooms)
  const setCur = useDrawStore((s) => s.setCur)
  const goNew = useDrawStore((s) => s.goNew)
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState(false)
  const q = query.trim().toLowerCase()
  const list = [...rooms]
    .sort((a, b) => b.t - a.t)
    .filter((r) => !q || r.title.toLowerCase().includes(q))

  if (renaming) {
    return (
      <input
        className='dw-cp-title dw-rename'
        defaultValue={props.room.title}
        aria-label={t('Conversation name')}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            renameRoom(props.room, e.currentTarget.value)
            setRenaming(false)
          } else if (e.key === 'Escape') setRenaming(false)
        }}
        onBlur={(e) => {
          renameRoom(props.room, e.currentTarget.value)
          setRenaming(false)
        }}
      />
    )
  }

  const trigger = (
    <button type='button' className='dw-cp-title'>
      <span>{props.room.fresh ? t('New conversation') : props.room.title}</span>
      <ChevronDown aria-hidden='true' />
    </button>
  )

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery('')}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align='start' className='w-[300px] p-1.5'>
        <div className='dw-q'>
          <Search aria-hidden='true' />
          <input
            value={query}
            placeholder={t('Search conversations')}
            aria-label={t('Search conversations')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuItem className='dw-mi' onClick={() => goNew()}>
          <SquarePen />
          {t('New conversation')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {list.length ? (
          <DropdownMenuRadioGroup
            value={props.room.id}
            onValueChange={(id) => setCur(String(id))}
          >
            {list.map((r) => (
              <DropdownMenuRadioItem key={r.id} value={r.id} className='dw-mi'>
                <RoomRow room={r} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        ) : (
          <p className='dw-menu-note'>
            {query
              ? t('Nothing matches “{{q}}”', { q: query })
              : t('No conversations yet')}
          </p>
        )}
        {!props.room.fresh && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='dw-mi'
              onClick={() => setRenaming(true)}
            >
              <Pencil />
              {t('Rename this conversation')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className='dw-mi'
              variant='destructive'
              onClick={() => {
                const undo = deleteRoomWithUndo(props.room)
                toast(t('Conversation deleted'), {
                  action: { label: t('Undo'), onClick: undo },
                  duration: 5000,
                })
              }}
            >
              <Trash2 />
              {t('Delete this conversation')}
            </DropdownMenuItem>
          </>
        )}
        <p className='dw-menu-note'>
          {t(
            'Conversations and pictures are kept only in this browser on this device. They are gone after switching devices or clearing browser data.'
          )}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
