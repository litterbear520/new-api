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

import { getPricing } from '@/features/pricing/api'
import { getUserModels } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { MODEL_META, SUGGEST_MODELS } from '../constants'
import { syncDrawToken } from '../lib/draw-key'
import { setDrawEnv } from '../lib/generate'
import type { DrawModelOption } from '../types'

const KNOWN = Object.keys(MODEL_META)

/** Image models this user can draw with, prices and the suggestion model. */
export function useDrawEnv() {
  const user = useAuthStore((s) => s.auth.user)
  const uid = user?.id

  const modelsQuery = useQuery({
    queryKey: ['draw', 'user-models', uid],
    queryFn: async () => requireServerSuccess(await getUserModels()).data ?? [],
    enabled: Boolean(uid),
    staleTime: 5 * 60 * 1000,
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => requireServerSuccess(await getPricing()),
    staleTime: 5 * 60 * 1000,
  })

  const available = modelsQuery.data
  const pricing = pricingQuery.data

  const imageModels = useMemo(() => {
    if (!available) return []
    const imageIds = new Set(
      (pricing?.data ?? [])
        .filter((m) => m.supported_endpoint_types?.includes('image-generation'))
        .map((m) => m.model_name)
    )
    const ids = available.filter((id) => imageIds.has(id) || KNOWN.includes(id))
    const rank = (id: string) =>
      KNOWN.includes(id) ? KNOWN.indexOf(id) : KNOWN.length
    return ids.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  }, [available, pricing])

  const models = useMemo<DrawModelOption[]>(
    () =>
      imageModels.map((id) => ({
        id,
        name: MODEL_META[id]?.name ?? id,
        tag: MODEL_META[id]?.tag,
        desc: MODEL_META[id]?.desc,
      })),
    [imageModels]
  )

  const groupRatio = pricing?.group_ratio?.[user?.group ?? 'default'] ?? 1
  const planKey = available
    ? SUGGEST_MODELS.filter((m) => available.includes(m)).join(',')
    : ''
  const suggestModel = planKey ? planKey.split(',')[0] : undefined

  useEffect(() => {
    if (!uid) return
    const planModels = planKey ? planKey.split(',') : []
    setDrawEnv({
      uid,
      imageModels,
      pricing,
      groupRatio,
      suggestModel,
      planModels,
    })
  }, [uid, imageModels, pricing, groupRatio, suggestModel, planKey])

  const modelKey = imageModels.join(',')
  useEffect(() => {
    if (!uid || !modelKey) return
    syncDrawToken(uid, modelKey.split(',')).catch(() => undefined)
  }, [uid, modelKey])

  return {
    models,
    pricing,
    groupRatio,
    loading: modelsQuery.isLoading,
    failed: modelsQuery.isError,
  }
}
