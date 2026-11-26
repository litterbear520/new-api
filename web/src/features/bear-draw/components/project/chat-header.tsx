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
import { ChevronLeft, PanelLeftClose, Palette } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { cn } from '@/lib/utils'

import type { Project, ProjectLayout } from '../../types'
import { TitleMenu } from './title-menu'
import { useProjectNav } from './use-project-nav'

function HeaderButton(props: {
  label: string
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <Tip label={props.label} side='bottom'>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className={cn('bd-hd-btn', props.className)}
        aria-label={props.label}
        onClick={props.onClick}
      >
        {props.children}
      </Button>
    </Tip>
  )
}

/**
 * 「画布」 with how many pictures it holds: opens the canvas, and closes it
 * again while it shows (pressed).
 */
function CanvasButton(props: {
  count: number
  on: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const label = props.on ? t('Hide the canvas') : t('Show the canvas')
  return (
    <Tip label={label} side='bottom'>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='bd-hd-canvas'
        aria-label={label}
        aria-pressed={props.on}
        onClick={props.onClick}
      >
        <Palette aria-hidden='true' />
        <span>{t('Canvas')}</span>
        {props.count > 0 && (
          <span className='bd-hd-count bd-num' aria-hidden='true'>
            {props.count}
          </span>
        )}
      </Button>
    </Tip>
  )
}

/**
 * Top of the chat: back to the drawing home, the title menu, what the
 * project has cost (on the canvas instead while it shows), the 画布 button
 * and, next to an open canvas, 收起对话. Narrow cards get the 画布 button
 * only.
 */
export function ChatHeader(props: {
  project: Project
  layout: ProjectLayout
  narrow: boolean
  onLayout: (layout: ProjectLayout) => void
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const nav = useProjectNav()
  const cost = props.project.cost
  const chatOnly = props.layout === 'chat'
  const count = props.project.nodes.filter((n) => n.status === 'ready').length
  return (
    <header className='bd-chatp-hd'>
      <HeaderButton label={t('Back to the drawing home')} onClick={nav.home}>
        <ChevronLeft aria-hidden='true' />
      </HeaderButton>
      <TitleMenu project={props.project} />
      <div className='bd-chatp-act'>
        {cost > 0 && chatOnly && (
          <Tip
            label={t('What this project has cost in total (failures are free)')}
            side='bottom'
          >
            <span className='bd-pcost bd-num'>
              {t('This project {{cost}}', { cost: money.cost(cost) })}
            </span>
          </Tip>
        )}
        {props.narrow ? (
          <CanvasButton
            count={count}
            on={false}
            onClick={() => props.onLayout('canvas')}
          />
        ) : (
          <>
            <CanvasButton
              count={count}
              on={!chatOnly}
              onClick={() => props.onLayout(chatOnly ? 'split' : 'chat')}
            />
            {!chatOnly && (
              <HeaderButton
                label={t('Hide the chat')}
                className='bd-hd-hide'
                onClick={() => props.onLayout('canvas')}
              >
                <PanelLeftClose aria-hidden='true' />
              </HeaderButton>
            )}
          </>
        )}
      </div>
    </header>
  )
}
