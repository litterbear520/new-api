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
import { ArrowUp, Wallet } from 'lucide-react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { useBearDrawEnv } from '../../hooks/use-env'
import { estimatePicture } from '../../lib/engine'
import { ModeMenu, PlusMenu } from './bar-menus'
import { ImageSettings } from './image-settings'
import { ImageModelMenu, ModelPrefs } from './model-menus'

type BarProps = {
  variant: 'home' | 'dock'
  /** In a project (the "@" canvas picker works). */
  canvas: boolean
  busy: boolean
  /** Something to send and nothing in the way. */
  ready: boolean
  /** Image mode: rough USD for this message; null when unknown. */
  estimate: number | null
  taRef: RefObject<HTMLTextAreaElement | null>
  onUpload: () => void
  onSkill: () => void
  onCanvas: () => void
  onSend: () => void
  onStop?: () => void
}

/** Below $1 a small amber pill next to send says so and links to the wallet. */
function LowBalance() {
  const { t } = useTranslation()
  const money = useMoney()
  const env = useBearDrawEnv()
  const model = useBearDrawStore((s) => s.prefs.image)
  const balance = env.balanceUsd
  if (balance == null || balance >= 1) return null
  const each = estimatePicture(model, {
    edit: false,
    refs: 0,
    transparent: false,
  })
  const count = each ? Math.max(0, Math.floor(balance / each)) : 0
  return (
    <Tip
      label={t(
        'Balance is running low: about {{count}} more pictures. Click to top up.',
        { count }
      )}
    >
      <Link to='/wallet' className='bd-lowbal'>
        <Wallet aria-hidden='true' />
        {money.balance(balance)}
      </Link>
    </Tip>
  )
}

/** Under the text: + and the mode on the left; models and send on the right. */
export function ComposerBar(props: BarProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const image = useBearDrawStore((s) => s.prefs.mode === 'image')
  const cost =
    image && props.estimate != null ? money.cost(props.estimate) : null
  let tip = t('Send (Enter)')
  if (props.busy) {
    tip = t("Stop the pictures that haven't started (not charged)")
  } else if (cost) {
    tip = t('Send (Enter) · about {{cost}}', { cost })
  }
  return (
    <div className='bd-comp-bar'>
      <div className='bd-comp-l'>
        <PlusMenu
          finalFocus={props.taRef}
          canvas={props.canvas}
          onUpload={props.onUpload}
          onSkill={props.onSkill}
          onCanvas={props.onCanvas}
        />
        <ModeMenu finalFocus={props.taRef} />
        {image && <ImageSettings cost={cost} />}
      </div>
      <div className='bd-comp-r'>
        {image ? <ImageModelMenu /> : <ModelPrefs />}
        {cost && props.variant === 'home' && (
          <Tip
            label={t(
              'Rough cost of this message; nothing is charged if it fails'
            )}
          >
            <span className='bd-est'>≈{cost}</span>
          </Tip>
        )}
        <LowBalance />
        <Tip label={tip}>
          <button
            type='button'
            className='bd-send'
            data-ready={props.ready ? '' : undefined}
            data-stop={props.busy ? '' : undefined}
            aria-disabled={!props.busy && !props.ready}
            aria-label={props.busy ? t('Stop') : t('Send')}
            onClick={props.busy ? props.onStop : props.onSend}
          >
            {props.busy ? (
              <i className='bd-send-stop' aria-hidden='true' />
            ) : (
              <ArrowUp aria-hidden='true' />
            )}
          </button>
        </Tip>
      </div>
    </div>
  )
}
