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
import { createContext, useContext } from 'react'

import type { PricingData } from '@/features/pricing/types'

import type { DrawItem, DrawModelOption } from '../types'

export type LightboxTarget =
  | { item: DrawItem }
  | { imageId: string; clear?: boolean }

export type DrawPageContext = {
  models: DrawModelOption[]
  pricing?: PricingData
  groupRatio: number
  /** Balance in USD; null while unknown. */
  balanceUsd: number | null
  /** Under 820px: one column, the canvas opens over the chat. */
  narrow: boolean
  /** The canvas is folded away: pictures show large in the chat. */
  canvasOff: boolean
  setCanvasOn: (on: boolean) => void
  /** Narrow layout: show the canvas over the chat. */
  openCanvas: () => void
  openLightbox: (target: LightboxTarget) => void
  focusComposer: () => void
}

export const DrawContext = createContext<DrawPageContext | null>(null)

export function useDrawPage(): DrawPageContext {
  const ctx = useContext(DrawContext)
  if (!ctx) throw new Error('useDrawPage must be used inside the drawing page')
  return ctx
}
