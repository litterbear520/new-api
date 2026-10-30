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
import { Plus } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { AccessHandle } from '../lib/access'
import { AccessTrigger } from './access-popover'

const CreateKeyDialog = lazy(() =>
  import('./create-key-dialog').then((m) => ({ default: m.CreateKeyDialog }))
)

/** Bar heights of the placeholder chart, in percent (all different) */
const BARS = [28, 52, 38, 82, 46, 64]

/**
 * A new account's usage card, after OpenModel's empty dashboard: a faint
 * chart, one line and the two first steps. The key is created right here,
 * then 接入信息 (anchored to this card's button) shows it.
 */
export function EmptyUsage(props: {
  accessHandle: AccessHandle
  /** After the create dialog closes, saved or not */
  onKeysChange: () => void
}) {
  const { t } = useTranslation()
  const [createOpen, setCreateOpen] = useState(false)
  // Mounted on the first click, then kept so the dialog can animate out
  const [createMounted, setCreateMounted] = useState(false)

  return (
    <section className='bo-card bo-empty' aria-labelledby='bo-empty-title'>
      <div className='bo-empty-art' aria-hidden='true'>
        {BARS.map((height) => (
          <i key={height} style={{ height: `${height}%` }} />
        ))}
      </div>
      <h2 id='bo-empty-title'>{t('No usage yet')}</h2>
      <p>
        {t(
          'Create an API key and send your first request. Your usage shows up here.'
        )}
      </p>
      <div className='bo-empty-acts'>
        <Button
          className='h-9 px-3'
          onClick={() => {
            setCreateMounted(true)
            setCreateOpen(true)
          }}
        >
          <Plus data-icon='inline-start' />
          {t('Create API Key')}
        </Button>
        <AccessTrigger handle={props.accessHandle} />
      </div>
      {createMounted && (
        <Suspense fallback={null}>
          <CreateKeyDialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open)
              if (!open) props.onKeysChange()
            }}
          />
        </Suspense>
      )}
    </section>
  )
}
