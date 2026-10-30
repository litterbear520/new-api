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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'

import type { ChatRequestBody } from '../lib/payload'
import { snippet, type SnippetLang } from '../lib/snippets'
import { CodeView } from './code-view'

const LANGS: Array<{ id: SnippetLang; label: string; hl: string }> = [
  { id: 'curl', label: 'cURL', hl: 'bash' },
  { id: 'python', label: 'Python', hl: 'python' },
  { id: 'javascript', label: 'JavaScript', hl: 'javascript' },
]

/** The last request as code for the user's own app. */
export function CodeDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  body: ChatRequestBody | undefined
}) {
  const { t } = useTranslation()
  const [lang, setLang] = useState<SnippetLang>('curl')
  const code = props.body
    ? snippet(lang, props.body, window.location.origin)
    : ''
  const hl = LANGS.find((l) => l.id === lang)?.hl ?? 'bash'
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Use this in your code')}
      description={t(
        'The request this conversation just sent, for the /v1 API with your own API key.'
      )}
      contentClassName='sm:max-w-3xl'
    >
      {props.body ? (
        <div className='bc-snip'>
          <div className='bc-snip-h'>
            <div className='bc-seg' role='group' aria-label={t('Language')}>
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type='button'
                  aria-pressed={l.id === lang}
                  onClick={() => setLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <span className='bc-grow' />
            <CopyButton value={code} />
          </div>
          <CodeView code={code} lang={hl} follow={false} />
          <p className='bc-snip-note'>
            {t(
              'Put an API key where the code says API_KEY. Pictures are shortened here.'
            )}{' '}
            <Link to='/keys' className='bc-link'>
              {t('Create a key')}
            </Link>
          </p>
        </div>
      ) : (
        <p className='text-muted-foreground text-sm'>
          {t('Send a message first, then the code for it shows here.')}
        </p>
      )}
    </Dialog>
  )
}
