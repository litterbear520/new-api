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
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/stores/auth-store'

import { getGreeting } from '../constants'

/** The new-conversation greeting; at night, a question over the sea. */
export function EmptyHero(props: { dark: boolean }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const name = user?.display_name || user?.username || ''
  const greeting = getGreeting(t)
  const line = name ? t('{{greeting}}, {{name}}', { greeting, name }) : greeting
  return (
    <div className='bc-hero'>
      {props.dark ? (
        <>
          <h1 className='bc-greet'>{t('What shall we talk about tonight?')}</h1>
          <p className='bc-greet-sub'>{line}</p>
        </>
      ) : (
        <h1 className='bc-greet'>{line}</h1>
      )}
    </div>
  )
}
