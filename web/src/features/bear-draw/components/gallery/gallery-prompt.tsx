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
import { Pencil } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'

import type { GalleryItem } from '../../data/gallery'
import { Segmented } from '../dialogs/segmented'
import { altPrompt, langName } from './gallery-item'
import { hasSlots, parseTemplate, templateText } from './prompt-template'

/** The prompt of a 玩法: 中/EN switch, copy, template slots highlighted. */
export function GalleryPrompt(props: { item: GalleryItem }) {
  const { t } = useTranslation()
  const it = props.item
  const labelId = useId()
  const [which, setWhich] = useState<'main' | 'alt'>('main')
  const alt = altPrompt(it)
  const parts = useMemo(
    () => (it.template ? parseTemplate(it.template) : null),
    [it.template]
  )
  const showAlt = which === 'alt' && alt != null
  const mainText = parts ? templateText(parts) : it.prompt
  const text = showAlt ? alt : mainText
  const marks = !showAlt && parts != null && hasSlots(parts)
  const main = langName(it.lang)
  const other = langName(it.promptAlt?.lang)

  return (
    <>
      <div className='bd-gd-ph'>
        <b id={labelId}>{t('Prompt text')}</b>
        <div className='bd-gd-pa'>
          {alt != null && (
            <Segmented
              value={which}
              options={[
                { value: 'main', label: main },
                { value: 'alt', label: other },
              ]}
              onChange={(v) => setWhich(v === 'alt' ? 'alt' : 'main')}
              aria-label={t('Prompt language')}
            />
          )}
          <CopyButton
            value={text}
            variant='outline'
            size='sm'
            className='bd-gd-copy'
            aria-label={t('Copy the prompt')}
          >
            {t('Copy')}
          </CopyButton>
        </div>
      </div>
      <pre className='bd-gd-prompt' aria-labelledby={labelId} tabIndex={0}>
        {marks && parts
          ? parts.map((p) =>
              p.kind === 'slot' ? (
                <mark key={p.at} title={p.name}>
                  {p.value}
                </mark>
              ) : (
                <span key={p.at}>{p.text}</span>
              )
            )
          : text}
      </pre>
      {marks && (
        <p className='bd-gd-note'>
          <Pencil aria-hidden='true' />
          {t(
            'The highlighted words can be changed to what you want, like hair colour, person or scene.'
          )}
        </p>
      )}
    </>
  )
}
