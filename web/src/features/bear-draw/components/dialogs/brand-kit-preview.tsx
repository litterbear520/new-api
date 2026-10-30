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
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { useImageUrl } from '@/features/draw/hooks/use-image-url'

import { keyed } from '../home/home-text'
import { fontPresets, splitPoints, type BrandKitDraft } from './brand-kit-form'

/** A business card in the kit's colours: what every picture will lean on. */
export function BrandKitPreview(props: { draft: BrandKitDraft }) {
  const { t } = useTranslation()
  const d = props.draft
  const logoUrl = useImageUrl(d.logo?.id, 'thumb')
  const font = fontPresets(t).find((f) => f.value === d.fonts)?.id ?? 'modern'
  const colors = d.colors.map((c) => c.value)
  const points = splitPoints(d.points)
  const shown = points.length
    ? points.slice(0, 3)
    : [t('Selling point one'), t('Selling point two')]
  const style = {
    '--c1': colors[0] ?? '#222222',
    '--c2': colors[1] ?? '#EEEEEE',
    '--c3': colors[2] ?? colors[0] ?? '#888888',
  } as CSSProperties
  const name = d.name.trim()

  return (
    <div className='bd-bk-prev'>
      <div className='bd-bk-card' style={style} aria-hidden='true'>
        <div className='bd-bk-logo'>
          {logoUrl ? (
            <img src={logoUrl} alt='' />
          ) : (
            <span className={`bd-bk-font-${font}`}>
              {(name || t('Brand')).slice(0, 2)}
            </span>
          )}
        </div>
        <div className={`bd-bk-name bd-bk-font-${font}`}>
          {name || t('Your brand')}
        </div>
        <div className='bd-bk-sw'>
          {d.colors.map((c) => (
            <i key={c.id} style={{ background: c.value }}>
              <span>{c.value.toUpperCase()}</span>
            </i>
          ))}
        </div>
        <div className='bd-bk-pts'>
          {keyed(shown).map((p) => (
            <span key={p.key}>{p.text}</span>
          ))}
        </div>
      </div>
      <p className='bd-bk-note'>
        {t(
          'Every time it draws, the bear writes these into the prompt: these colours, this type style, the logo in a fitting place, and your selling points first in the copy.'
        )}
      </p>
    </div>
  )
}
