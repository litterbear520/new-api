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
import { Box, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatMoney } from '@/features/bear-chat/hooks/use-chat-money'
import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { IMAGE_MODEL_META } from '../../constants'
import { useBearDrawEnv, type ImageModelOption } from '../../hooks/use-env'
import { estimatePicture } from '../../lib/engine'
import { ModelIcon } from '../model-icon'

const shortName = (id: string, models: ImageModelOption[]) =>
  models.find((m) => m.id === id)?.short ?? IMAGE_MODEL_META[id]?.short ?? id

/** The image models as radio items: name, note, ≈ price per picture. */
function ImageModelItems(props: {
  models: ImageModelOption[]
  close: boolean
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const image = useBearDrawStore((s) => s.prefs.image)
  const transparent = useBearDrawStore((s) => s.prefs.transparent)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  if (!props.models.length) {
    return <div className='bd-menu-empty'>{t('No image models available')}</div>
  }
  return (
    <DropdownMenuRadioGroup
      value={image}
      onValueChange={(v) => setPrefs({ image: String(v) })}
    >
      {props.models.map((m) => {
        const usd = estimatePicture(m.id, { edit: false, refs: 0, transparent })
        return (
          <DropdownMenuRadioItem
            key={m.id}
            value={m.id}
            closeOnClick={props.close}
            className='bd-mi bd-mi-radio'
          >
            <ModelIcon model={m.id} size={18} />
            <span className='bd-mi-main'>
              <span className='bd-mi-name'>
                {m.name}
                {m.tag === 'recommended' && (
                  <em className='bd-tag'>{t('Recommended')}</em>
                )}
              </span>
              {m.note && <span className='bd-mi-desc'>{t(m.note)}</span>}
            </span>
            {usd != null && (
              <span className='bd-mi-right'>
                {t('≈{{cost}} each', { cost: money.cost(usd) })}
              </span>
            )}
          </DropdownMenuRadioItem>
        )
      })}
    </DropdownMenuRadioGroup>
  )
}

/** Image mode: the image model chip 「Sunburst ▾」. */
export function ImageModelMenu() {
  const { t } = useTranslation()
  const env = useBearDrawEnv()
  const image = useBearDrawStore((s) => s.prefs.image)
  const short = shortName(image, env.imageModels)
  return (
    <DropdownMenu>
      <Tip label={t('Image model')}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='bd-chip bd-model-chip'
              aria-label={t('Image model: {{name}}', { name: short })}
            >
              <ModelIcon model={image} size={16} />
              <span>{short}</span>
              <ChevronDown className='bd-chev' aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <DropdownMenuContent
        side='top'
        align='end'
        sideOffset={8}
        className='bd-pop bd-menu w-[min(360px,calc(100vw-24px))]'
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className='bd-menu-h'>
            {t('Image model')}
          </DropdownMenuLabel>
          <ImageModelItems models={env.imageModels} close />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Agent mode: 模型偏好 (box icon) → the planning model and the image model. */
export function ModelPrefs() {
  const { t } = useTranslation()
  const env = useBearDrawEnv()
  const chatMoney = useChatMoney()
  const brain = useBearDrawStore((s) => s.prefs.brain)
  const image = useBearDrawStore((s) => s.prefs.image)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  return (
    <DropdownMenu>
      <Tip
        label={t('Model preferences: {{brain}} · {{image}}', {
          brain,
          image: shortName(image, env.imageModels),
        })}
      >
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='bd-ib'
              aria-label={t('Model preferences')}
            >
              <Box aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <DropdownMenuContent
        side='top'
        align='end'
        sideOffset={8}
        className='bd-pop bd-menu w-[min(380px,calc(100vw-24px))]'
      >
        <div className='bd-prefs-t'>{t('Model preferences')}</div>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='bd-menu-h'>
            {t('Planning: asks, plans and writes the prompts')}
          </DropdownMenuLabel>
          {env.brainModels.length ? (
            <DropdownMenuRadioGroup
              value={brain}
              onValueChange={(v) => setPrefs({ brain: String(v) })}
              className='bd-prefs-list'
            >
              {env.brainModels.map((m) => (
                <DropdownMenuRadioItem
                  key={m.id}
                  value={m.id}
                  className='bd-mi bd-mi-radio'
                >
                  <ModelIcon model={m.id} size={18} />
                  <span className='bd-mi-main'>
                    <span className='bd-mi-name'>
                      {m.id}
                      {m.tag === 'default' && (
                        <em className='bd-tag'>{t('Default')}</em>
                      )}
                    </span>
                    {m.note && <span className='bd-mi-desc'>{t(m.note)}</span>}
                  </span>
                  <span className='bd-mi-right'>
                    {chatMoney.price(m.price)}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          ) : (
            <div className='bd-menu-empty'>{t('No chat models available')}</div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='bd-menu-h'>
            {t('Image model')}
          </DropdownMenuLabel>
          <ImageModelItems models={env.imageModels} close={false} />
        </DropdownMenuGroup>
        <p className='bd-menu-note'>
          {t(
            'Prices per 1M input / output tokens; the usage log has the exact cost.'
          )}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
