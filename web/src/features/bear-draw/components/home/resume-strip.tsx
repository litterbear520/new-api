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
import { Link } from '@tanstack/react-router'
import { ChevronDown, Image as ImageIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRelativeTime } from '@/features/draw/components/relative-time'
import { useImageUrl } from '@/features/draw/hooks/use-image-url'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import type { Project } from '../../types'
import { ProjectMenuRow } from '../project/project-menu-row'
import { useProjectNav } from '../project/use-project-nav'
import { useWarmOnUse } from './use-home'

/** Recent projects shown as buttons; the rest are in 「全部」. */
const RECENT = 3

function ResumeItem(props: { project: Project }) {
  const { t } = useTranslation()
  const ago = useRelativeTime()
  const money = useMoney()
  const p = props.project
  const first = p.nodes.find((n) => n.status === 'ready' && n.img)
  const url = useImageUrl(first?.img?.id, 'thumb')
  const title = p.title || t('Untitled project')
  return (
    <Link to='/draw' search={{ p: p.id }} className='bd-resume-i' title={title}>
      {url ? (
        <img src={url} alt='' />
      ) : (
        <span className='bd-resume-e' aria-hidden='true'>
          <ImageIcon />
        </span>
      )}
      <span className='bd-resume-t'>{title}</span>
      <span className='bd-resume-m'>
        {ago(p.updatedAt)}
        {p.cost > 0 ? ` · ${money.cost(p.cost)}` : ''}
      </span>
    </Link>
  )
}

/**
 * Every project, newest first, in a menu; each row can be deleted. The
 * menu stays while open even when deleting leaves three or fewer.
 */
function AllProjects(props: {
  projects: Project[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const nav = useProjectNav()
  return (
    <DropdownMenu open={props.open} onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger className='bd-resume-all'>
        {t('All {{count}}', { count: props.projects.length })}
        <ChevronDown aria-hidden='true' />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        className='bd-pmenu max-h-[min(60vh,420px)] w-80'
      >
        {props.projects.map((p) => (
          <ProjectMenuRow key={p.id} project={p} onOpen={nav.open} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 「继续上次」: the latest projects in one line under the composer. */
export function ResumeStrip() {
  const { t } = useTranslation()
  const projects = useBearDrawStore((s) => s.projects)
  const ref = useRef<HTMLElement>(null)
  const [allOpen, setAllOpen] = useState(false)
  useWarmOnUse(ref)
  // the last project was deleted from the open menu: don't reopen it later
  if (!projects.length && allOpen) setAllOpen(false)
  if (!projects.length) return null
  return (
    <nav ref={ref} className='bd-row' aria-label={t('Recent projects')}>
      <span className='bd-row-l'>{t('Pick up where you left off:')}</span>
      <div className='bd-row-items bd-resume'>
        {projects.slice(0, RECENT).map((p) => (
          <ResumeItem key={p.id} project={p} />
        ))}
        {(projects.length > RECENT || allOpen) && (
          <AllProjects
            projects={projects}
            open={allOpen}
            onOpenChange={setAllOpen}
          />
        )}
      </div>
    </nav>
  )
}
