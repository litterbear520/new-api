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
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { getModelTools } from '../lib/tools'
import type { PricingModel } from '../types'

const CHIP =
  'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground relative z-10 inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors'

/** Chips for the tools a model is made for; each opens its guide */
export function ModelTools(props: { model: PricingModel; className?: string }) {
  const { t } = useTranslation()
  const tools = getModelTools(props.model)
  if (tools.length === 0) return null
  return (
    <ul
      aria-label={t('Works with')}
      className={cn('flex flex-wrap gap-1.5', props.className)}
    >
      {tools.map((tool) => (
        <li key={tool.id}>
          {tool.id === 'draw' ? (
            <Link to='/draw' className={CHIP}>
              {t(tool.label)}
            </Link>
          ) : (
            <a
              href={tool.href}
              target='_blank'
              rel='noreferrer'
              title={t('{{tool}} setup guide', { tool: tool.label })}
              className={CHIP}
            >
              {tool.label}
              <ArrowUpRight aria-hidden className='size-3' />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
