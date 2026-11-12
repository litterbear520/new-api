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
import { Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useRelativeTime } from '@/features/draw/components/relative-time'

import { deleteProject } from '../../lib/engine'
import type { Project } from '../../types'

/** The delete button of the row below, or above when this was the last. */
function neighbourDelete(button: HTMLElement): HTMLElement | null {
  const row = button.closest('.bd-prow')
  for (const el of [row?.nextElementSibling, row?.previousElementSibling]) {
    if (el?.classList.contains('bd-prow')) {
      return el.querySelector<HTMLElement>('.bd-prow-del')
    }
  }
  return null
}

/**
 * One project in a project menu: the row opens it, the trash button at the
 * end deletes it. The first press arms the button (「确认删除」), the second
 * deletes; moving to another item disarms it. The menu stays open and the
 * focus moves to the next row's delete button, so several projects can go
 * in a row.
 */
export function ProjectMenuRow(props: {
  project: Project
  icon?: ReactNode
  onOpen: (projectId: string) => void
}) {
  const { t } = useTranslation()
  const ago = useRelativeTime()
  const [armed, setArmed] = useState(false)
  const p = props.project
  const title = p.title || t('Untitled project')
  return (
    <div role='none' className='bd-prow' data-armed={armed || undefined}>
      <DropdownMenuItem
        className='bd-prow-open'
        onClick={() => props.onOpen(p.id)}
      >
        {props.icon}
        <span className='bd-pmenu-t'>{title}</span>
        <span className='bd-pmenu-r'>{ago(p.updatedAt)}</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        variant='destructive'
        closeOnClick={false}
        className='bd-prow-del'
        aria-label={
          armed
            ? t('Confirm deleting “{{title}}”', { title })
            : t('Delete project “{{title}}”', { title })
        }
        title={armed ? undefined : t('Delete')}
        onClick={(e) => {
          if (!armed) {
            setArmed(true)
            return
          }
          setArmed(false)
          const next = neighbourDelete(e.currentTarget)
          void deleteProject(p.id)
          // the focused button goes away with its row
          if (next) requestAnimationFrame(() => next.focus())
        }}
        onBlur={() => setArmed(false)}
      >
        <Trash2 aria-hidden='true' />
        {armed && <span>{t('Confirm delete')}</span>}
      </DropdownMenuItem>
    </div>
  )
}
