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

import { getUserGroups, getUserModels } from '@/features/playground/api'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'
import { useBearChatStore } from '@/stores/bear-chat-store'

import { IMAGE_MODEL, MODEL_NOTES, PREFERRED_MODELS } from '../constants'
import { modelPrice, type ModelPrice } from '../lib/cost'
import { setChatEnv } from '../lib/run'

export type ChatModel = {
  id: string
  tag?: string
  note?: string
  price: ModelPrice | null
  cheapest?: boolean
}

export type ChatGroup = { id: string; desc?: string; ratio: number }

const rankOf = (id: string) => {
  const i = MODEL_NOTES.findIndex((n) => n.match.test(id))
  return i < 0 ? MODEL_NOTES.length : i
}

function pickModel(list: ChatModel[], current: string): string {
  if (list.some((m) => m.id === current)) return current
  return (
    PREFERRED_MODELS.find((id) => list.some((m) => m.id === id)) ??
    list[0]?.id ??
    ''
  )
}

function pickGroup(groups: ChatGroup[], current: string, own?: string): string {
  if (!groups.length) return current
  if (groups.some((g) => g.id === current)) return current
  const prefer = [own, 'default'].find(
    (g) => g && groups.some((x) => x.id === g)
  )
  return prefer ?? groups[0].id
}

/** Chat models for the user's group, their prices and the group ratio. */
export function useChatEnv() {
  const own = useAuthStore((s) => s.auth.user?.group)
  const group = useBearChatStore((s) => s.settings.group)
  const model = useBearChatStore((s) => s.settings.model)
  const setSettings = useBearChatStore((s) => s.setSettings)

  const groupsQuery = useQuery({
    queryKey: ['bear-chat', 'groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    staleTime: 5 * 60 * 1000,
  })
  const groups = useMemo<ChatGroup[]>(
    () =>
      (groupsQuery.data ?? []).map((g) => ({
        id: g.value,
        desc: g.desc,
        ratio: Number(g.ratio) || 1,
      })),
    [groupsQuery.data]
  )
  const activeGroup = pickGroup(groups, group, own)

  const modelsQuery = useQuery({
    queryKey: ['bear-chat', 'models', activeGroup],
    queryFn: async () => requireServerSuccess(await getUserModels(activeGroup)),
    enabled: groupsQuery.isSuccess || groupsQuery.isError,
    staleTime: 5 * 60 * 1000,
  })
  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => requireServerSuccess(await getPricing()),
    staleTime: 5 * 60 * 1000,
  })

  const pricing = pricingQuery.data
  const groupRatio =
    pricing?.group_ratio?.[activeGroup] ??
    groups.find((g) => g.id === activeGroup)?.ratio ??
    1
  const prices = useMemo(() => {
    const map = new Map<string, PricingModel>()
    for (const m of pricing?.data ?? []) map.set(m.model_name, m)
    return map
  }, [pricing])

  const models = useMemo<ChatModel[]>(() => {
    const ids = (modelsQuery.data ?? [])
      .map((m) => m.value)
      .filter((id) => {
        if (IMAGE_MODEL.test(id)) return false
        const types = prices.get(id)?.supported_endpoint_types
        return (
          !types ||
          types.length === 0 ||
          types.some((t) => t !== 'image-generation')
        )
      })
    const list = ids.map((id): ChatModel => {
      const known = MODEL_NOTES.find((n) => n.match.test(id))
      return {
        id,
        tag: known?.tag,
        note: known?.note,
        price: modelPrice(prices.get(id), groupRatio),
      }
    })
    const priced = list.filter((m) => m.price?.kind === 'tokens')
    if (priced.length > 2) {
      const out = (m: ChatModel) =>
        m.price?.kind === 'tokens' ? m.price.output : Infinity
      const cheapest = priced.reduce((a, b) => (out(b) < out(a) ? b : a))
      cheapest.cheapest = true
    }
    return list.sort(
      (a, b) => rankOf(a.id) - rankOf(b.id) || a.id.localeCompare(b.id)
    )
  }, [modelsQuery.data, prices, groupRatio])

  const activeModel = models.length ? pickModel(models, model) : model

  useEffect(() => {
    const patch: { group?: string; model?: string } = {}
    if (groups.length && activeGroup !== group) patch.group = activeGroup
    if (models.length && activeModel !== model) patch.model = activeModel
    if (patch.group !== undefined || patch.model !== undefined) {
      setSettings(patch)
    }
  }, [
    groups.length,
    activeGroup,
    group,
    models.length,
    activeModel,
    model,
    setSettings,
  ])

  useEffect(() => {
    setChatEnv({ prices, groupRatio })
  }, [prices, groupRatio])

  const loading = modelsQuery.isLoading || groupsQuery.isLoading
  const failed = modelsQuery.isError
  return useMemo(
    () => ({ models, groups, prices, groupRatio, loading, failed }),
    [models, groups, prices, groupRatio, loading, failed]
  )
}

export type ChatEnv = ReturnType<typeof useChatEnv>
