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

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** "just now", "5 min ago", "yesterday", "3 days ago". */
export function useRelativeTime() {
  const { t } = useTranslation()
  return (time: number) => {
    const d = Date.now() - time
    if (d < MIN) return t('Just now')
    if (d < HOUR) return t('{{count}} min ago', { count: Math.floor(d / MIN) })
    if (d < DAY) return t('{{count}} h ago', { count: Math.floor(d / HOUR) })
    if (d < 2 * DAY) return t('Yesterday')
    return t('{{count}} days ago', { count: Math.floor(d / DAY) })
  }
}
