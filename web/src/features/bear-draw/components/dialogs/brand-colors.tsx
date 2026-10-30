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
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { newId } from '@/stores/bear-draw-store'

import { MAX_BRAND_COLORS, type BrandColor } from './brand-kit-form'

type BrandColorsProps = {
  colors: BrandColor[]
  onChange: (colors: BrandColor[]) => void
}

/** Colour swatches with the system picker; the first one is the main colour. */
export function BrandColors(props: BrandColorsProps) {
  const { t } = useTranslation()
  const set = (id: string, value: string) =>
    props.onChange(props.colors.map((c) => (c.id === id ? { id, value } : c)))
  const remove = (id: string) =>
    props.onChange(props.colors.filter((c) => c.id !== id))
  const add = () =>
    props.onChange([...props.colors, { id: newId('c'), value: '#888888' }])

  return (
    <div className='bd-bk-colors'>
      {props.colors.map((c, i) => (
        <div key={c.id} className='bd-bk-c' style={{ background: c.value }}>
          <input
            type='color'
            value={c.value}
            onChange={(e) => set(c.id, e.target.value)}
            aria-label={t('Brand colour {{n}}', { n: i + 1 })}
          />
          {props.colors.length > 1 && (
            <button
              type='button'
              className='bd-bk-cx'
              aria-label={t('Remove brand colour {{n}}', { n: i + 1 })}
              onClick={() => remove(c.id)}
            >
              <X aria-hidden='true' />
            </button>
          )}
        </div>
      ))}
      {props.colors.length < MAX_BRAND_COLORS && (
        <button
          type='button'
          className='bd-bk-c bd-bk-cadd'
          aria-label={t('Add a colour')}
          onClick={add}
        >
          <Plus aria-hidden='true' />
        </button>
      )}
    </div>
  )
}
