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
import {
  ArrowLeftRight,
  BookOpen,
  Info,
  ListChecks,
  ScanSearch,
  Sparkles,
  SwatchBook,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { Phrase, StatusIcon } from '../../types'

const ICONS: Record<StatusIcon, LucideIcon> = {
  book: BookOpen,
  scan: ScanSearch,
  brand: SwatchBook,
  plan: ListChecks,
  think: Sparkles,
  swap: ArrowLeftRight,
  info: Info,
}

/** One quiet line of what the agent did or is doing (「技能加载完成 · …」). */
export function StatusPart(props: {
  icon: StatusIcon
  text: Phrase
  live?: boolean
}) {
  const { t } = useTranslation()
  const Icon = ICONS[props.icon] ?? Info
  return (
    <div className={cn('bd-st', props.live && 'is-live')}>
      {props.live ? (
        <span className='bd-st-spin' aria-hidden='true' />
      ) : (
        <Icon className='bd-st-i' aria-hidden='true' />
      )}
      <span className='bd-st-t'>{t(props.text.key, props.text.params)}</span>
    </div>
  )
}
