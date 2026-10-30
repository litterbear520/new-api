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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { modelPrice, type ModelPrice } from '@/features/bear-chat/lib/cost'
import { syncDrawToken } from '@/features/draw/lib/draw-key'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'
import { getUserModels } from '@/lib/api'
import { getCurrencyDisplay } from '@/lib/currency'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { BRAIN_META, IMAGE_MODEL_META, NON_CHAT_MODEL } from '../constants'

export type ImageModelOption = {
  id: string
  name: string
  short: string
  /** i18n key */
  note?: string
  tag?: 'recommended'
}

export type BrainModelOption = {
  id: string
  /** i18n key */
  note?: string
  tag?: 'default'
  price: ModelPrice | null
  /** Listed in BRAIN_META (shown first). */
  featured: boolean
}

export type BearDrawEnv = {
  uid: number | null
  imageModels: ImageModelOption[]
  brainModels: BrainModelOption[]
  /** Pricing rows by model name. */
  prices: Map<string, PricingModel>
  groupRatio: number
  /** The user's balance in USD (null until known). */
  balanceUsd: number | null
  loading: boolean
  failed: boolean
}

const KNOWN_IMAGE = Object.keys(IMAGE_MODEL_META)

/** Once per page visit: the drawing token must allow every image model. */
export function useDrawTokenSync(env: BearDrawEnv) {
  const imageKey = env.imageModels.map((m) => m.id).join(',')
  useEffect(() => {
    if (env.uid == null || !imageKey) return
    syncDrawToken(env.uid, imageKey.split(',')).catch(() => undefined)
  }, [env.uid, imageKey])
}

/** Models this user can use here, their prices, the balance. */
export function useBearDrawEnv(): BearDrawEnv {
  const user = useAuthStore((s) => s.auth.user)
  const uid = user?.id ?? null

  const modelsQuery = useQuery({
    queryKey: ['bear-draw', 'user-models', uid],
    queryFn: async () => requireServerSuccess(await getUserModels()).data ?? [],
    enabled: uid != null,
    staleTime: 5 * 60 * 1000,
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => requireServerSuccess(await getPricing()),
    staleTime: 5 * 60 * 1000,
  })

  const available = modelsQuery.data
  const pricing = pricingQuery.data
  const groupRatio = pricing?.group_ratio?.[user?.group ?? 'default'] ?? 1

  const prices = useMemo(() => {
    const map = new Map<string, PricingModel>()
    for (const m of pricing?.data ?? []) map.set(m.model_name, m)
    return map
  }, [pricing])

  const imageModels = useMemo<ImageModelOption[]>(() => {
    if (!available) return []
    const ids = available.filter(
      (id) =>
        KNOWN_IMAGE.includes(id) ||
        Boolean(
          prices.get(id)?.supported_endpoint_types?.includes('image-generation')
        )
    )
    const rank = (id: string) =>
      KNOWN_IMAGE.includes(id) ? KNOWN_IMAGE.indexOf(id) : KNOWN_IMAGE.length
    return ids
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map((id) => ({
        id,
        name: IMAGE_MODEL_META[id]?.name ?? id,
        short: IMAGE_MODEL_META[id]?.short ?? id,
        note: IMAGE_MODEL_META[id]?.note,
        tag: IMAGE_MODEL_META[id]?.tag,
      }))
  }, [available, prices])

  const brainModels = useMemo<BrainModelOption[]>(() => {
    if (!available) return []
    const imageIds = new Set(imageModels.map((m) => m.id))
    const chat = available.filter((id) => {
      if (imageIds.has(id) || NON_CHAT_MODEL.test(id)) return false
      const types = prices.get(id)?.supported_endpoint_types
      return (
        !types ||
        types.length === 0 ||
        types.some((t) => t !== 'image-generation')
      )
    })
    const featured = BRAIN_META.filter((m) => chat.includes(m.id)).map(
      (m): BrainModelOption => ({
        id: m.id,
        note: m.note,
        tag: m.tag,
        price: modelPrice(prices.get(m.id), groupRatio),
        featured: true,
      })
    )
    const rest = chat
      .filter((id) => !BRAIN_META.some((m) => m.id === id))
      .sort((a, b) => a.localeCompare(b))
      .map((id): BrainModelOption => ({
        id,
        price: modelPrice(prices.get(id), groupRatio),
        featured: false,
      }))
    return [...featured, ...rest]
  }, [available, imageModels, prices, groupRatio])

  const quotaPerUnit = getCurrencyDisplay().config.quotaPerUnit
  const balanceUsd =
    user?.quota != null && quotaPerUnit > 0 ? user.quota / quotaPerUnit : null

  return useMemo(
    () => ({
      uid,
      imageModels,
      brainModels,
      prices,
      groupRatio,
      balanceUsd,
      loading: modelsQuery.isLoading || pricingQuery.isLoading,
      failed: modelsQuery.isError,
    }),
    [
      uid,
      imageModels,
      brainModels,
      prices,
      groupRatio,
      balanceUsd,
      modelsQuery.isLoading,
      pricingQuery.isLoading,
      modelsQuery.isError,
    ]
  )
}
