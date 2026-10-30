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
  FolderPlus,
  LogIn,
  PenLine,
  RefreshCw,
  Repeat2,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  errorHint,
  errorTitle,
  type ErrorFix,
} from '@/features/bear-chat/lib/errors'

import { retryStep } from '../../lib/engine'
import type { BrainErrorKind, Part } from '../../types'
import { usePartActions } from './part-actions'

type ErrorPartData = Extract<Part, { type: 'error' }>

/** What each kind of planner failure offers, in button order. */
const FIXES: Record<BrainErrorKind, ErrorFix[]> = {
  login: ['login'],
  balance: ['wallet', 'model'],
  model: ['retry', 'model'],
  vision: ['model'],
  long: ['new', 'model'],
  blocked: ['edit'],
  busy: ['retry', 'model'],
  network: ['retry'],
  upstream: ['retry', 'model'],
  other: ['retry', 'model'],
}

/** The planner failed: what happened in plain words, and what to do next. */
export function ErrorPart(props: {
  projectId: string
  messageId: string
  part: ErrorPartData
}) {
  const { t } = useTranslation()
  const actions = usePartActions()
  const part = props.part
  const fixes = FIXES[part.kind] ?? FIXES.other
  const view = { kind: part.kind, fixes }
  const has = (fix: ErrorFix) => fixes.includes(fix)
  const pickModel = () => {
    actions.focusComposer()
    toast(t('Pick another model in the message box, then send again.'))
  }
  return (
    <div className='bd-err' role='alert'>
      <b>{errorTitle(view, part.model ?? t('This model'), t)}</b>
      <span className='bd-err-why'>{errorHint(view, t)}</span>
      <div className='bd-err-row'>
        {has('retry') && (
          <Button
            type='button'
            size='sm'
            className='bd-cb bd-cb-ink'
            disabled={actions.busy}
            onClick={() => retryStep(props.projectId, props.messageId)}
          >
            <RefreshCw aria-hidden='true' />
            {t('Retry this step')}
          </Button>
        )}
        {has('model') && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='bd-cb bd-cb-line'
            onClick={pickModel}
          >
            <Repeat2 aria-hidden='true' />
            {t('Switch model')}
          </Button>
        )}
        {has('wallet') && (
          <Button
            size='sm'
            variant='outline'
            className='bd-cb bd-cb-line'
            render={<Link to='/wallet' />}
          >
            <Wallet aria-hidden='true' />
            {t('Go to top up')}
          </Button>
        )}
        {has('login') && (
          <Button
            type='button'
            size='sm'
            className='bd-cb bd-cb-ink'
            onClick={() => window.location.reload()}
          >
            <LogIn aria-hidden='true' />
            {t('Sign in again')}
          </Button>
        )}
        {has('new') && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='bd-cb bd-cb-line'
            onClick={actions.newProject}
          >
            <FolderPlus aria-hidden='true' />
            {t('Start a new project')}
          </Button>
        )}
        {has('edit') && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='bd-cb bd-cb-line'
            onClick={actions.focusComposer}
          >
            <PenLine aria-hidden='true' />
            {t('Rephrase and send again')}
          </Button>
        )}
      </div>
      {part.message && (
        <details className='bd-err-raw'>
          <summary>{t('Details')}</summary>
          <code>{part.message}</code>
        </details>
      )}
    </div>
  )
}
