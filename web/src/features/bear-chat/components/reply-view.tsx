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
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Repeat2,
} from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Response } from '@/components/ai-elements/response'
import { Button } from '@/components/ui/button'
import { Tip } from '@/features/draw/components/tip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { useBearChatStore } from '@/stores/bear-chat-store'

import type { ChatEnv } from '../hooks/use-chat-env'
import { useChatMoney } from '../hooks/use-chat-money'
import { splitReply, splitThink } from '../lib/artifacts'
import { retryReply, showReply } from '../lib/run'
import type { AssistantTurn, Reply } from '../types'
import { ModelIcon } from './model-icon'
import { ModelMenu } from './model-menu'
import { ArtifactCard, ErrorCard, ThinkRow } from './reply-parts'

/** Below this the cost line says "under $0.0001" instead of rounding up. */
const TINY_COST = 0.0001

type ReplyViewProps = {
  turn: AssistantTurn
  env: ChatEnv
  /** This reply is the one streaming right now. */
  live: boolean
  /** Another reply anywhere is streaming, so retrying waits. */
  busy: boolean
  onCopied: () => void
  onNewConversation: () => void
}

function UsageLine(props: { reply: Reply }) {
  const { t, i18n } = useTranslation()
  const money = useChatMoney()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const r = props.reply
  const secs = r.endedAt ? (r.endedAt - r.startedAt) / 1000 : null
  const parts: string[] = []
  if (secs != null) parts.push(t('{{value}} s', { value: secs.toFixed(1) }))
  if (r.usage) {
    parts.push(
      t('{{value}} tokens', { value: formatNumber(r.usage.completion, locale) })
    )
  }
  return (
    <div className='bc-usage'>
      <span className='bc-usage-model'>
        <ModelIcon model={r.model} />
        {r.model}
      </span>
      {parts.map((p) => (
        <span key={p}>{p}</span>
      ))}
      {r.cost != null && (
        <span title={t('An estimate; the usage log has the exact amount')}>
          {r.cost > 0 && r.cost < TINY_COST
            ? t('under {{cost}}', { cost: money.cost(TINY_COST) })
            : t('about {{cost}}', { cost: money.cost(r.cost) })}
        </span>
      )}
    </div>
  )
}

function Versions(props: { turn: AssistantTurn; disabled: boolean }) {
  const { t } = useTranslation()
  const n = props.turn.replies.length
  if (n < 2) return null
  const cur = props.turn.cur
  return (
    <span className='bc-ver'>
      <button
        type='button'
        aria-label={t('Previous answer')}
        disabled={props.disabled || cur === 0}
        onClick={() => showReply(props.turn.id, cur - 1)}
      >
        <ChevronLeft aria-hidden='true' />
      </button>
      <span className='tabular-nums'>
        {cur + 1}/{n}
      </span>
      <button
        type='button'
        aria-label={t('Next answer')}
        disabled={props.disabled || cur === n - 1}
        onClick={() => showReply(props.turn.id, cur + 1)}
      >
        <ChevronRight aria-hidden='true' />
      </button>
    </span>
  )
}

export const ReplyView = memo(function ReplyView(props: ReplyViewProps) {
  const { t } = useTranslation()
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })
  const panel = useBearChatStore((s) => s.panel)
  const openPanel = useBearChatStore((s) => s.openPanel)
  const setSettings = useBearChatStore((s) => s.setSettings)
  const turn = props.turn
  const reply = turn.replies[turn.cur] ?? turn.replies.at(-1) ?? turn.replies[0]
  const streaming =
    props.live && (reply.status === 'waiting' || reply.status === 'streaming')
  const { think, text } = useMemo(
    () => splitThink(reply.content),
    [reply.content]
  )
  const split = useMemo(() => splitReply(text, reply.id), [text, reply.id])
  const reasoning = [reply.reasoning ?? '', think].filter(Boolean).join('\n\n')
  const thinkingLive = streaming && !text.trim()
  const showThink = Boolean(reasoning) || thinkingLive

  const retryWith = (model: string) => {
    setSettings({ model })
    retryReply(turn.id, model)
  }
  const modelPicker = (label: string, compact: boolean) => (
    <ModelMenu
      tip={compact ? label : undefined}
      models={props.env.models}
      groups={props.env.groups}
      model={reply.model}
      group=''
      title={t('Try again with')}
      side='top'
      align='start'
      onModel={retryWith}
      onGroup={() => undefined}
      trigger={
        compact ? (
          <button type='button' aria-label={label} disabled={props.busy}>
            <Repeat2 aria-hidden='true' />
          </button>
        ) : (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={props.busy}
          >
            <Repeat2 aria-hidden='true' />
            {label}
          </Button>
        )
      }
    />
  )

  return (
    <div className='bc-a' data-status={reply.status}>
      {showThink && (
        <ThinkRow reply={reply} text={reasoning} live={thinkingLive} />
      )}
      <div className='bc-body'>
        {split.segments.map((seg, i) => {
          if (seg.type === 'artifact') {
            const a = seg.artifact
            return (
              <ArtifactCard
                key={seg.key}
                artifact={a}
                current={panel.open && panel.artId === a.id}
                writing={streaming && !a.closed}
                onOpen={() =>
                  openPanel(a.id, {
                    view: a.kind === 'code' ? 'code' : 'preview',
                  })
                }
              />
            )
          }
          const last = i === split.segments.length - 1
          return (
            <Response
              key={seg.key}
              className='bc-md'
              final={!(streaming && last)}
            >
              {seg.text}
            </Response>
          )
        })}
      </div>
      {reply.status === 'error' && (
        <ErrorCard
          reply={reply}
          onRetry={() => retryReply(turn.id)}
          onNew={props.onNewConversation}
          modelPicker={modelPicker(t('Another model'), false)}
        />
      )}
      {reply.status === 'stopped' && (
        <p className='bc-stopped'>
          {t(
            'You stopped this reply. What was already written is billed as usual.'
          )}
        </p>
      )}
      {!streaming && (
        <div className='bc-foot'>
          {reply.status !== 'error' && <UsageLine reply={reply} />}
          <div className='bc-acts'>
            {reply.status !== 'error' && text.trim() && (
              <Tip label={copiedText ? t('Copied') : t('Copy')}>
                <button
                  type='button'
                  aria-label={t('Copy')}
                  onClick={() => {
                    void copyToClipboard(text)
                    props.onCopied()
                  }}
                >
                  {copiedText ? (
                    <Check aria-hidden='true' />
                  ) : (
                    <Copy aria-hidden='true' />
                  )}
                </button>
              </Tip>
            )}
            <Tip label={t('Try again')}>
              <button
                type='button'
                aria-label={t('Try again')}
                disabled={props.busy}
                onClick={() => retryReply(turn.id)}
              >
                <RefreshCw aria-hidden='true' />
              </button>
            </Tip>
            {modelPicker(t('Try again with another model'), true)}
            <Versions turn={turn} disabled={props.busy} />
          </div>
        </div>
      )}
    </div>
  )
})
