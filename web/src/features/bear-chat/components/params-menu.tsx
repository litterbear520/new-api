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
import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/features/draw/components/tip'
import { cn } from '@/lib/utils'
import { useBearChatStore } from '@/stores/bear-chat-store'

import type { BearMood, ChatParams, ReasoningEffort } from '../types'

const DEFAULTS = { temperature: 1, top_p: 1, max_tokens: 4096 }

type Seg<T extends string> = { value: T; label: string }

function Segmented<T extends string>(props: {
  label: string
  options: Seg<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className='bc-seg' role='group' aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type='button'
          aria-pressed={o.value === props.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SliderRow(props: {
  id: keyof Pick<ChatParams, 'temperature' | 'top_p'>
  label: string
  hint: string
  min: number
  max: number
  step: number
}) {
  const { t } = useTranslation()
  const value = useBearChatStore((s) => s.settings.params[props.id])
  const setParams = useBearChatStore((s) => s.setParams)
  const on = value != null
  const patch = (v: number | null): Partial<ChatParams> =>
    props.id === 'temperature' ? { temperature: v } : { top_p: v }
  return (
    <div className='bc-prm'>
      <div className='bc-prm-h'>
        <span className='bc-prm-t'>
          <span>{props.label}</span>
          <small>{on ? props.hint : t('Model default')}</small>
        </span>
        {on && <span className='bc-prm-v tabular-nums'>{value}</span>}
        <Switch
          checked={on}
          aria-label={props.label}
          onCheckedChange={(c) =>
            setParams(patch(c ? DEFAULTS[props.id] : null))
          }
        />
      </div>
      {value != null && (
        <Slider
          value={[value]}
          min={props.min}
          max={props.max}
          step={props.step}
          aria-label={props.label}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v
            setParams(patch(Math.round(n * 100) / 100))
          }}
        />
      )}
    </div>
  )
}

function MaxTokensRow() {
  const { t } = useTranslation()
  const value = useBearChatStore((s) => s.settings.params.max_tokens)
  const setParams = useBearChatStore((s) => s.setParams)
  const on = value != null
  return (
    <div className='bc-prm'>
      <div className='bc-prm-h'>
        <span className='bc-prm-t'>
          <span>{t('Longest reply')}</span>
          <small>
            {on ? t('Tokens; the reply stops there') : t('Model default')}
          </small>
        </span>
        {value != null && (
          <Input
            type='number'
            inputMode='numeric'
            min={1}
            max={200000}
            className='bc-prm-num h-7 w-24'
            aria-label={t('Longest reply')}
            value={value}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              if (Number.isFinite(n) && n > 0) {
                setParams({ max_tokens: Math.min(n, 200000) })
              }
            }}
          />
        )}
        <Switch
          checked={on}
          aria-label={t('Longest reply')}
          onCheckedChange={(c) =>
            setParams({ max_tokens: c ? DEFAULTS.max_tokens : null })
          }
        />
      </div>
    </div>
  )
}

/** Optional parameters, all off by default, plus the bear's mood. */
export function ParamsMenu() {
  const { t } = useTranslation()
  const params = useBearChatStore((s) => s.settings.params)
  const mood = useBearChatStore((s) => s.settings.mood)
  const setParams = useBearChatStore((s) => s.setParams)
  const setSettings = useBearChatStore((s) => s.setSettings)
  const changed = Object.values(params).some((v) => v != null)
  const effort = params.effort ?? 'default'
  return (
    <Popover>
      <Tip label={t('Parameters')}>
        <PopoverTrigger
          render={
            <button
              type='button'
              className={cn('bc-ib', changed && 'bc-ib-on')}
              aria-label={t('Parameters')}
            >
              <SlidersHorizontal aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <PopoverContent
        side='top'
        align='start'
        className='bc-menu w-[320px] gap-3 p-3'
      >
        <SliderRow
          id='temperature'
          label={t('Temperature')}
          hint={t('Higher is more varied, lower more focused')}
          min={0}
          max={2}
          step={0.1}
        />
        <SliderRow
          id='top_p'
          label='Top P'
          hint={t('Only sample from the most likely words')}
          min={0}
          max={1}
          step={0.05}
        />
        <MaxTokensRow />
        <div className='bc-prm'>
          <span className='bc-prm-t'>
            <span>{t('Thinking effort')}</span>
            <small>
              {t('Only for reasoning models; on High the bear brings its wand')}
            </small>
          </span>
          <Segmented<ReasoningEffort | 'default'>
            label={t('Thinking effort')}
            value={effort}
            onChange={(v) => setParams({ effort: v === 'default' ? null : v })}
            options={[
              { value: 'default', label: t('Default') },
              { value: 'low', label: t('Low') },
              { value: 'medium', label: t('Medium') },
              { value: 'high', label: t('High') },
            ]}
          />
        </div>
        <p className='bc-menu-note'>
          {t(
            'Parameters that are off are not sent, so models are less likely to refuse the request.'
          )}
        </p>
        <div className='bc-prm'>
          <span className='bc-prm-t'>
            <span>{t('The little bear')}</span>
          </span>
          <Segmented<BearMood>
            label={t('The little bear')}
            value={mood}
            onChange={(v) => setSettings({ mood: v })}
            options={[
              { value: 'live', label: t('Lively') },
              { value: 'quiet', label: t('Quiet') },
              { value: 'hide', label: t('Bear hidden') },
            ]}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
