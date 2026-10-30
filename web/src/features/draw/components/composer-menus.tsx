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
import { ChevronDown, Images, Paperclip, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { RATIO_SHAPE, getRatioOptions } from '../constants'
import { useImageUrl } from '../hooks/use-image-url'
import type { DrawItem, DrawModelOption, DrawRatio } from '../types'
import { Tip } from './tip'

export function RatioShape(props: { ratio: DrawRatio }) {
  const [w, h, dashed] = RATIO_SHAPE[props.ratio]
  return (
    <span className='dw-shape' aria-hidden='true'>
      <i
        style={{
          width: w,
          height: h,
          borderStyle: dashed ? 'dashed' : undefined,
        }}
      />
    </span>
  )
}

function PickThumb(props: {
  item: DrawItem
  index: number
  onPick: () => void
}) {
  const { t } = useTranslation()
  const url = useImageUrl(props.item.img?.id, 'thumb')
  return (
    <DropdownMenuItem
      className='dw-pick-item'
      aria-label={t('Pick picture {{n}}', { n: props.index + 1 })}
      onClick={props.onPick}
    >
      {url ? <img src={url} alt='' /> : <span className='dw-img-wait' />}
    </DropdownMenuItem>
  )
}

type PlusMenuProps = {
  pictures: DrawItem[]
  onUpload: () => void
  onPick: (item: DrawItem) => void
}

export function PlusMenu(props: PlusMenuProps) {
  const { t } = useTranslation()
  const trigger = (
    <button
      type='button'
      className='dw-cb dw-sq'
      aria-label={t('Add pictures')}
    >
      <Plus />
    </button>
  )
  return (
    <DropdownMenu>
      <Tip label={t('Add pictures')}>
        <DropdownMenuTrigger render={trigger} />
      </Tip>
      <DropdownMenuContent side='top' align='start' className='w-[300px] p-1.5'>
        <DropdownMenuItem className='dw-mi' onClick={props.onUpload}>
          <Paperclip />
          <span className='dw-mi-tx'>
            <span>{t('Upload pictures')}</span>
            <small>{t('PNG, JPG or WebP, up to 4')}</small>
          </span>
        </DropdownMenuItem>
        {props.pictures.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className='dw-mi'>
              <Images />
              <span className='dw-mi-tx'>
                <span>{t('Pick from this conversation')}</span>
                <small>{t('Use an earlier picture as a reference')}</small>
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='dw-pick w-auto p-1.5'>
              {props.pictures.map((it, i) => (
                <PickThumb
                  key={it.id}
                  item={it}
                  index={i}
                  onPick={() => props.onPick(it)}
                />
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <p className='dw-menu-note'>
          {t('You can also drop pictures here or paste with Ctrl+V')}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type RatioMenuProps = {
  ratio: DrawRatio
  prices: Record<DrawRatio, string>
  clearPrice: string
  onChange: (ratio: DrawRatio) => void
}

export function RatioMenu(props: RatioMenuProps) {
  const { t } = useTranslation()
  const options = getRatioOptions(t)
  const current = options.find((o) => o.id === props.ratio) ?? options[0]
  const trigger = (
    <button type='button' className='dw-cb'>
      <RatioShape ratio={props.ratio} />
      <span>{current.label}</span>
      <ChevronDown className='dw-chev' />
    </button>
  )
  return (
    <DropdownMenu>
      <Tip label={t('Picture ratio')}>
        <DropdownMenuTrigger render={trigger} />
      </Tip>
      <DropdownMenuContent side='top' align='start' className='w-[320px] p-1.5'>
        <DropdownMenuRadioGroup
          value={props.ratio}
          onValueChange={(v) => props.onChange(v as DrawRatio)}
        >
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.id} value={o.id} className='dw-mi'>
              <RatioShape ratio={o.id} />
              <span className='dw-mi-tx'>
                <span>{o.name}</span>
                <small>{o.hint}</small>
              </span>
              <span className='dw-mi-pr tabular-nums'>
                {props.prices[o.id]}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className='dw-menu-note'>
          {t(
            'On the right: rough cost per picture. A transparent background is about {{price}}.',
            { price: props.clearPrice }
          )}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type ModelMenuProps = {
  models: DrawModelOption[]
  value: string
  samePrice: boolean
  onChange: (id: string) => void
}

export function ModelMenu(props: ModelMenuProps) {
  const { t } = useTranslation()
  const current = props.models.find((m) => m.id === props.value)
  const trigger = (
    <button type='button' className='dw-cb'>
      <span>{current?.name ?? props.value}</span>
      <ChevronDown className='dw-chev' />
    </button>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent side='top' align='end' className='w-[300px] p-1.5'>
        <DropdownMenuRadioGroup
          value={props.value}
          onValueChange={(v) => props.onChange(String(v))}
        >
          {props.models.map((m) => (
            <DropdownMenuRadioItem key={m.id} value={m.id} className='dw-mi'>
              <span className='dw-mi-tx'>
                <span>
                  {m.name}
                  {m.tag === 'recommended' && (
                    <span className='dw-tag'>{t('Recommended')}</span>
                  )}
                </span>
                {m.desc && <small>{t(m.desc)}</small>}
                <small className={cn('dw-mi-id')}>{m.id}</small>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className='dw-menu-note'>
          {props.samePrice
            ? t(
                'These models cost the same; switching only affects later pictures.'
              )
            : t('Switching only affects later pictures.')}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
