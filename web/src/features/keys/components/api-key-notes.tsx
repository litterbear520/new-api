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
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { ApiKey } from '../types'

/**
 * The quiet line under a key's name: a non-default group, model limits and
 * an IP allow-list, the settings that have no column of their own. An Auto
 * key reads like the official group cell: 「跨分组」 and its Auto ratio.
 */
export function ApiKeyNotes(props: { apiKey: ApiKey; className?: string }) {
  const { t } = useTranslation()
  const group = props.apiKey.group
  const models = props.apiKey.model_limits_enabled
    ? (props.apiKey.model_limits ?? '').split(',').filter(Boolean).length
    : 0
  const notes: { key: string; content: ReactNode }[] = []
  if (group === 'auto') {
    notes.push(
      {
        key: 'group',
        content: (
          <span
            className='text-info'
            title={t(
              'Automatically selects the best available group with circuit breaker mechanism'
            )}
          >
            {t('Cross-group')}
          </span>
        ),
      },
      { key: 'ratio', content: t('Auto') }
    )
  } else if (group && group !== 'default') {
    notes.push({ key: 'group', content: group })
  }
  if (models) {
    notes.push({
      key: 'models',
      content: t('Models: {{count}}', { count: models }),
    })
  }
  if (props.apiKey.allow_ips?.trim()) {
    notes.push({ key: 'ips', content: t('IP Restriction') })
  }
  if (!notes.length) return null
  return (
    <small className={cn('text-muted-foreground', props.className)}>
      {notes.map((note, index) => (
        <Fragment key={note.key}>
          {index > 0 && ' · '}
          {note.content}
        </Fragment>
      ))}
    </small>
  )
}
