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
import { ChevronDown, FolderPlus, Images, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { deleteProject, renameProject } from '../../lib/engine'
import type { Project } from '../../types'
import { ProjectMenuRow } from './project-menu-row'
import { useProjectNav } from './use-project-nav'

/** The title, edited in place: Enter or leaving the field keeps it, Esc drops it. */
function RenameField(props: {
  value: string
  onDone: (title: string | null) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(props.value)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    // after the menu has closed and handed the focus back
    const id = requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [])
  const finish = (title: string | null) => {
    if (done.current) return
    done.current = true
    props.onDone(title)
  }
  return (
    <Input
      ref={ref}
      className='bd-ptitle-in'
      value={value}
      maxLength={40}
      aria-label={t('Project name')}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          finish(value)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          finish(null)
        }
      }}
    />
  )
}

/**
 * The project title and its menu: rename, a new project, the recent
 * projects (each with its own delete), and delete this one (asks first).
 */
export function TitleMenu(props: { project: Project }) {
  const { t } = useTranslation()
  const nav = useProjectNav()
  const projects = useBearDrawStore((s) => s.projects)
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const p = props.project
  const title = p.title || t('Untitled project')
  const recent = projects.filter((x) => x.id !== p.id).slice(0, 6)

  if (renaming) {
    return (
      <RenameField
        value={p.title}
        onDone={(next) => {
          setRenaming(false)
          if (next != null && next.trim() !== p.title) {
            renameProject(p.id, next)
          }
        }}
      />
    )
  }

  const remove = () => {
    setConfirming(false)
    nav.home()
    void deleteProject(p.id)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className='bd-ptitle' title={title}>
          <span>{title}</span>
          <ChevronDown aria-hidden='true' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='bd-pmenu w-80'>
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil aria-hidden='true' />
            {t('Rename')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={nav.home}>
            <FolderPlus aria-hidden='true' />
            {t('New project')}
          </DropdownMenuItem>
          {recent.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('Recent projects')}</DropdownMenuLabel>
                {recent.map((x) => (
                  <ProjectMenuRow
                    key={x.id}
                    project={x}
                    icon={<Images aria-hidden='true' />}
                    onOpen={nav.open}
                  />
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden='true' />
            {t('Delete this project')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('Delete “{{title}}”?', { title })}
        desc={t(
          'The conversation and the pictures only this project uses are deleted. This cannot be undone.'
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={remove}
      />
    </>
  )
}
