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
import { Check, ChevronDown, ImageIcon } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tip } from '@/features/draw/components/tip'
import { cn } from '@/lib/utils'

import { DRAW_PAGE } from '../constants'
import type { ChatGroup, ChatModel } from '../hooks/use-chat-env'
import { useChatMoney } from '../hooks/use-chat-money'
import { ModelIcon } from './model-icon'

type ModelMenuProps = {
  models: ChatModel[]
  groups: ChatGroup[]
  model: string
  group: string
  onModel: (id: string) => void
  onGroup: (id: string) => void
  /** Opens with this title, e.g. "Try again with". */
  title?: string
  /** Custom trigger; defaults to the composer's model chip. */
  trigger?: ReactElement
  /** Tooltip for a custom trigger. */
  tip?: string
  side?: 'top' | 'bottom'
  align?: 'start' | 'end'
}

/** Picks the model (and the group, when the user has more than one). */
export function ModelMenu(props: ModelMenuProps) {
  const { t } = useTranslation()
  const money = useChatMoney()
  const [open, setOpen] = useState(false)
  const trigger = props.trigger ?? (
    <button type='button' className='bc-chip' aria-label={t('Choose a model')}>
      <ModelIcon model={props.model} />
      <span className='truncate'>{props.model || t('Choose a model')}</span>
      <ChevronDown className='bc-chev' aria-hidden='true' />
    </button>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={props.trigger ? props.tip : t('Model')}>
        <PopoverTrigger render={trigger} />
      </Tip>
      <PopoverContent
        side={props.side ?? 'top'}
        align={props.align ?? 'end'}
        className='bc-menu w-[min(360px,calc(100vw-24px))] gap-0 p-0'
      >
        <Command loop>
          {/* always there, so arrows and Enter work from the keyboard */}
          <CommandInput autoFocus placeholder={t('Search models')} />
          <CommandList className='max-h-[min(420px,60vh)]'>
            <CommandEmpty>{t('No matching model')}</CommandEmpty>
            {props.groups.length > 1 && !props.title && (
              <CommandGroup heading={t('Group')}>
                {props.groups.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={`group:${g.id}`}
                    onSelect={() => props.onGroup(g.id)}
                    className='bc-mi'
                  >
                    <span className='bc-mi-tx'>
                      <span>{g.id}</span>
                      {g.desc && <small>{g.desc}</small>}
                    </span>
                    {g.ratio !== 1 && (
                      <span className='bc-price'>×{g.ratio}</span>
                    )}
                    {g.id === props.group && (
                      <Check className='bc-tick' aria-hidden='true' />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={props.title ?? t('Model')}>
              {props.models.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  keywords={[m.note ? t(m.note) : '', m.tag ? t(m.tag) : '']}
                  onSelect={() => {
                    props.onModel(m.id)
                    setOpen(false)
                  }}
                  className='bc-mi'
                >
                  <ModelIcon model={m.id} size={16} />
                  <span className='bc-mi-tx'>
                    <span className='bc-mi-name'>
                      {m.id}
                      {m.tag && <span className='bc-tag'>{t(m.tag)}</span>}
                      {m.cheapest && !m.tag && (
                        <span className='bc-tag'>{t('Cheapest')}</span>
                      )}
                    </span>
                    {m.note && <small>{t(m.note)}</small>}
                  </span>
                  <span className='bc-price tabular-nums'>
                    {money.price(m.price)}
                  </span>
                  <Check
                    className={cn(
                      'bc-tick',
                      m.id !== props.model && 'invisible'
                    )}
                    aria-hidden='true'
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className='bc-menu-foot'>
          <span>
            {t(
              'Prices per 1M input / output tokens; the usage log has the exact cost.'
            )}
          </span>
          {!props.title && (
            <Link
              to={DRAW_PAGE}
              className='bc-menu-link'
              onClick={() => setOpen(false)}
            >
              <ImageIcon aria-hidden='true' />
              {t('Picture models are on the drawing page')}
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
