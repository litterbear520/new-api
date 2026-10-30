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
import type { TFunction } from 'i18next'

import type { Artifact } from '../types'

/** The name shown for an artifact: its title, or what kind of thing it is. */
export function artifactLabel(a: Artifact, t: TFunction): string {
  if (a.title) return a.title
  if (a.kind === 'html') return t('Web page')
  if (a.kind === 'svg') return t('SVG picture')
  const lang = a.lang ? a.lang[0].toUpperCase() + a.lang.slice(1) : ''
  return lang ? t('{{lang}} code', { lang }) : t('Code')
}
