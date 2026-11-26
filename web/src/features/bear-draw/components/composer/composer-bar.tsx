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
import type { Ratio } from '../../types'
import { PlusMenu } from './bar-menus'
import { EffortMenu } from './effort-menu'
import { RatioMenu } from './ratio-menu'

type BarProps = {
  variant: 'home' | 'dock'
  /** In a project (the "@" canvas picker works). */
  canvas: boolean
  busy: boolean
  /** Something to send and nothing in the way. */
  ready: boolean
  /** The ratio picked for this message. */
  ratio: Ratio
  onRatio: (ratio: Ratio) => void
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

/** Under the text: + and the ratio on the left; thinking effort and send on the right. */
export function ComposerBar(props: BarProps) {
  const { t } = useTranslation()
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
        <RatioMenu
          ratio={props.ratio}
          onChange={props.onRatio}
          finalFocus={props.taRef}
        />
      </div>
      <div className='bd-comp-r'>
        <EffortMenu />
        <LowBalance />
        <Tip
          label={
            props.busy
              ? t("Stop the pictures that haven't started (not charged)")
              : t('Send (Enter)')
          }
        >
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
