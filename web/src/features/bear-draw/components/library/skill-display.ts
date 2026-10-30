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
import {
  Hash,
  Megaphone,
  Package,
  Pencil,
  Sparkles,
  Store,
  SwatchBook,
  type LucideIcon,
} from 'lucide-react'

import type { Ratio } from '../../types'

const ICONS: Record<string, LucideIcon> = {
  ecom: Store,
  brand: SwatchBook,
  social: Hash,
  ads: Megaphone,
  pack: Package,
  mine: Pencil,
}

const HUES: Record<string, number> = {
  ecom: 205,
  brand: 265,
  social: 340,
  ads: 28,
  pack: 160,
  mine: 220,
}

export function categoryIcon(category: string): LucideIcon {
  return ICONS[category] ?? Sparkles
}

/** Hue of the generated cover art. */
export function categoryHue(category: string): number {
  return HUES[category] ?? 210
}

/** Frame of a deliverable in the cover art: 64px on the long side. */
export function frameSize(ratio: Ratio | string): { w: number; h: number } {
  const [a, b] = (ratio === 'auto' ? '3:2' : ratio).split(':').map(Number)
  const w = a > 0 ? a : 1
  const h = b > 0 ? b : 1
  const k = 64 / Math.max(w, h)
  return { w: Math.round(w * k), h: Math.round(h * k) }
}

/** Short name of a source repo: nexu-io/open-design → open-design. */
export function repoName(repo: string): string {
  return repo.split('/').at(-1) || repo
}
