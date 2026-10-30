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
import {
  ChevronRight,
  Code2,
  Globe,
  RefreshCw,
  Shapes,
  Wallet,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  classifyError,
  errorHint,
  errorTitle,
  type ErrorFix,
} from '../lib/errors'
import { artifactLabel } from '../lib/labels'
import type { Artifact, Reply } from '../types'

/** "Thought for 6 s", folded; live while the model is still thinking. */
export function ThinkRow(props: { reply: Reply; text: string; live: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const { live } = props
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [live])
  const r = props.reply
  const end = r.textAt ?? r.endedAt ?? now
  const secs = Math.max(
    1,
    Math.round((end - (r.firstAt ?? r.startedAt)) / 1000)
  )
  return (
    <div className='bc-think-w'>
      <button
        type='button'
        className='bc-think'
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {live ? (
          <>
            <span className='bc-shim'>{t('Thinking now')}</span>
            <span className='tabular-nums'>
              {t('{{count}} s', { count: secs })}
            </span>
          </>
        ) : (
          <span>{t('Thought for {{count}} s', { count: secs })}</span>
        )}
        <ChevronRight className='bc-think-chev' aria-hidden='true' />
      </button>
      <div className='bc-think-t'>
        <div>
          <p>{props.text}</p>
        </div>
      </div>
    </div>
  )
}

function ArtifactIcon(props: { kind: Artifact['kind'] }) {
  if (props.kind === 'html') return <Globe aria-hidden='true' />
  if (props.kind === 'svg') return <Shapes aria-hidden='true' />
  return <Code2 aria-hidden='true' />
}

/** The card in the chat for something shown in the side panel. */
export function ArtifactCard(props: {
  artifact: Artifact
  current: boolean
  writing: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const a = props.artifact
  const lines = a.code ? a.code.split('\n').length : 0
  let state = t('{{count}} lines · open', { count: lines })
  if (props.writing) state = t('Writing…')
  else if (!a.closed) {
    state = t('{{count}} lines · not finished', { count: lines })
  }
  return (
    <button
      type='button'
      className={cn('bc-artc', props.current && 'bc-cur')}
      onClick={props.onOpen}
    >
      <span className={cn('bc-artc-i', a.kind !== 'code' && 'bc-artc-web')}>
        <ArtifactIcon kind={a.kind} />
      </span>
      <span className='bc-artc-t'>
        <b>{artifactLabel(a, t)}</b>
        <small className={cn(props.writing && 'bc-shim')}>
          {a.kind === 'code' ? `${a.lang} · ` : ''}
          {state}
        </small>
      </span>
      <ChevronRight className='bc-artc-chev' aria-hidden='true' />
    </button>
  )
}

/** A failed reply: what happened in plain words, and what to do next. */
export function ErrorCard(props: {
  reply: Reply
  onRetry: () => void
  modelPicker: ReactNode
  onNew: () => void
}) {
  const { t } = useTranslation()
  const err = props.reply.error
  if (!err) return null
  const view = classifyError(err)
  // the buttons below always come in the same order
  const fixes = new Set<ErrorFix>(view.fixes)
  return (
    <div className='bc-err' role='alert'>
      <b>{errorTitle(view, props.reply.model, t)}</b>
      <span className='bc-err-why'>
        {errorHint(view, t)}
        {err.unbilled && ` ${t('This request was not billed.')}`}
      </span>
      <div className='bc-err-row'>
        {fixes.has('retry') && (
          <Button type='button' size='sm' onClick={props.onRetry}>
            <RefreshCw aria-hidden='true' />
            {t('Try again')}
          </Button>
        )}
        {fixes.has('model') && props.modelPicker}
        {fixes.has('wallet') && (
          <Button size='sm' variant='outline' render={<Link to='/wallet' />}>
            <Wallet aria-hidden='true' />
            {t('Top up')}
          </Button>
        )}
        {fixes.has('login') && (
          <Button
            type='button'
            size='sm'
            onClick={() => window.location.reload()}
          >
            {t('Sign in again')}
          </Button>
        )}
        {fixes.has('new') && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={props.onNew}
          >
            {t('New conversation')}
          </Button>
        )}
      </div>
      <details className='bc-err-raw'>
        <summary>{t('Details')}</summary>
        <code>
          {[err.status ? `HTTP ${err.status}` : '', err.code ?? '', err.message]
            .filter(Boolean)
            .join(' · ')}
        </code>
      </details>
    </div>
  )
}
