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
import { RotateCcw, Sparkles, Wallet, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { cn } from '@/lib/utils'

import { IMAGE_MODEL_META } from '../../constants'
import { decide, togglePlanItem } from '../../lib/engine'
import type { AgentStatus, Part, PlanItem } from '../../types'
import { ModelIcon } from '../model-icon'
import { planTotal } from './format'
import { usePartActions } from './part-actions'
import { PlanAdLaw } from './plan-adlaw'

type PlanPart = Extract<Part, { type: 'plan' }>

function PlanRow(props: {
  item: PlanItem
  n: number
  pending: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const it = props.item
  const meta = IMAGE_MODEL_META[it.model]
  const sub = [it.size, it.note].filter(Boolean).join(' · ')
  return (
    <li className={cn('bd-plan-it', !it.on && 'is-off')}>
      <span className='bd-plan-n bd-num' aria-hidden='true'>
        {props.n}
      </span>
      <span className='bd-plan-m'>
        <b>{it.label}</b>
        {sub && <span>{sub}</span>}
      </span>
      <Tip label={meta?.name ?? it.model}>
        <span className='bd-plan-model'>
          <ModelIcon model={it.model} size={13} />
          {meta?.short ?? it.model}
        </span>
      </Tip>
      <span className='bd-plan-c bd-num'>
        {it.est > 0 ? money.cost(it.est) : '—'}
      </span>
      {props.pending && (
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          className='bd-plan-x'
          aria-label={
            it.on
              ? t('Do not draw “{{label}}”', { label: it.label })
              : t('Draw “{{label}}” again', { label: it.label })
          }
          onClick={props.onToggle}
        >
          {it.on ? <X aria-hidden='true' /> : <RotateCcw aria-hidden='true' />}
        </Button>
      )}
    </li>
  )
}

/** What happened to a plan that no longer waits, as one quiet line. */
function StateLine(props: { state: PlanPart['state'] }) {
  const { t } = useTranslation()
  let text = t('Not drawn, not charged')
  if (props.state === 'auto') {
    text = t('Only a few pictures, so it started right away')
  } else if (props.state === 'confirmed') {
    text = t('Started drawing')
  } else if (props.state === 'changed') {
    text = t('Starting over with what you said')
  }
  return <div className='bd-plan-state'>{text}</div>
}

/**
 * The plan before drawing: every picture with its size, model and price,
 * the total, flagged words, and 开始画 / 只画第一张 / 取消 while it waits.
 */
export function PlanCard(props: {
  projectId: string
  part: PlanPart
  /** Status of the agent message the plan belongs to. */
  status: AgentStatus
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const actions = usePartActions()
  const part = props.part
  const pending =
    part.state === 'pending' &&
    (props.status === 'waiting' || props.status === 'running')
  const on = part.items.filter((x) => x.on)
  const total = planTotal(part.items)
  const short = actions.balanceUsd != null && actions.balanceUsd < total
  const go = (decision: 'start' | 'first' | 'cancel') =>
    decide(props.projectId, part.id, decision)

  return (
    <div
      className={cn('bd-plan', pending && 'is-pending')}
      role='group'
      aria-label={part.title || t('Drawing plan')}
    >
      <div className='bd-plan-hd'>
        <span className='bd-plan-ti'>
          <b>{part.title || t('Drawing plan')}</b>
          {part.platform && (
            <span className='bd-plan-tag'>{part.platform}</span>
          )}
        </span>
        <span className='bd-plan-sum bd-num'>
          {t('Pictures: {{count}} · about {{cost}} · failures are free', {
            count: on.length,
            cost: money.cost(total),
          })}
        </span>
      </div>
      {part.note && <p className='bd-plan-note'>{part.note}</p>}
      <ol className='bd-plan-list'>
        {part.items.map((it, i) => (
          <PlanRow
            key={it.id}
            item={it}
            n={i + 1}
            pending={pending}
            onToggle={() =>
              togglePlanItem(props.projectId, part.id, it.id, !it.on)
            }
          />
        ))}
      </ol>
      <PlanAdLaw
        projectId={props.projectId}
        partId={part.id}
        hits={part.adlaw}
        items={part.items}
        fixed={Boolean(part.adlawFixed)}
        pending={pending}
      />
      {pending ? (
        <div className='bd-plan-ft'>
          <div className='bd-plan-btns'>
            <Button
              type='button'
              className='bd-cb bd-cb-ink bd-cb-lg'
              disabled={!on.length}
              onClick={() => go('start')}
            >
              <Sparkles aria-hidden='true' />
              {t('Start drawing {{count}} · about {{cost}}', {
                count: on.length,
                cost: money.cost(total),
              })}
            </Button>
            {on.length > 1 && (
              <Button
                type='button'
                variant='outline'
                className='bd-cb bd-cb-line bd-cb-lg'
                onClick={() => go('first')}
              >
                {t('Only the first one')}
              </Button>
            )}
            <Button
              type='button'
              variant='ghost'
              className='bd-cb bd-cb-ghost bd-cb-lg'
              onClick={() => go('cancel')}
            >
              {t('Cancel')}
            </Button>
          </div>
          {short && actions.balanceUsd != null && (
            <p className='bd-plan-warn'>
              <Wallet aria-hidden='true' />
              <span>
                {t('Your balance is {{balance}}, not enough for this plan.', {
                  balance: money.balance(actions.balanceUsd),
                })}
              </span>
              <Link to='/wallet' className='bd-plan-wallet'>
                {t('Go to top up')}
              </Link>
            </p>
          )}
        </div>
      ) : (
        <StateLine state={part.state} />
      )}
    </div>
  )
}
