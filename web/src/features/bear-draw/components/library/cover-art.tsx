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

import type { Skill } from '../../types'
import { keyed } from '../home/home-text'
import { categoryHue, categoryIcon, frameSize } from './skill-display'

/** Cover for a skill without sample pictures: its deliverables as frames. */
export function CoverArt(props: { skill: Skill }) {
  const s = props.skill
  const Icon = categoryIcon(s.category)
  const list = s.deliverables.length
    ? s.deliverables.slice(0, 5)
    : [{ label: '', ratio: '1:1' as const }]
  const frames = keyed(list.map((d) => d.label)).map((k, i) => ({
    key: k.key,
    label: k.text,
    delay: i * 60,
    ...frameSize(list[i].ratio),
  }))
  return (
    <div
      className='bd-cart'
      style={{ '--hue': categoryHue(s.category) } as CSSProperties}
      aria-hidden='true'
    >
      <div className='bd-cart-row'>
        {frames.map((f) => (
          <i
            key={f.key}
            style={{ width: f.w, height: f.h, animationDelay: `${f.delay}ms` }}
          >
            <span>{f.label}</span>
          </i>
        ))}
      </div>
      <div className='bd-cart-ic'>
        <Icon />
      </div>
    </div>
  )
}
