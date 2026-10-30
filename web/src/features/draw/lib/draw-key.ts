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
  createApiKey,
  fetchTokenKey,
  searchApiKeys,
  updateApiKey,
} from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import type { ApiKey } from '@/features/keys/types'
import { createServerError } from '@/lib/server-error-message'

import { DRAW_TOKEN_NAME, STORAGE_KEYS } from '../constants'

/*
 * The console session can't call /v1/images, so the page draws with its own
 * API token, 「网页画图」: image models only, unlimited quota (the account
 * balance still applies), no expiry. Revealing a key is audited and rate
 * limited (20 per 20 minutes), so the key is revealed once and kept in this
 * browser. A deleted token is created again on the next picture.
 */

type CachedKey = { uid: number; id: number; key: string }

export class DrawKeyError extends Error {
  constructor(public reason: 'disabled' | 'missing') {
    super(
      reason === 'disabled'
        ? 'The drawing token is disabled'
        : 'The drawing token could not be created'
    )
  }
}

function readCache(): CachedKey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.key)
    return raw ? (JSON.parse(raw) as CachedKey) : null
  } catch {
    return null
  }
}

function writeCache(value: CachedKey | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEYS.key, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEYS.key)
  } catch {
    // Private mode: the key is revealed again next time.
  }
}

async function findToken(): Promise<ApiKey | null> {
  const res = await searchApiKeys({ keyword: DRAW_TOKEN_NAME, p: 1, size: 50 })
  if (!res.success) throw createServerError(res, 'Failed to load API keys')
  const items = res.data?.items ?? []
  const mine = items.filter((item) => item.name === DRAW_TOKEN_NAME)
  return (
    mine.find((item) => item.status === API_KEY_STATUS.ENABLED) ??
    mine[0] ??
    null
  )
}

async function createToken(models: string[]) {
  const res = await createApiKey({
    name: DRAW_TOKEN_NAME,
    remain_quota: 0,
    expired_time: -1,
    unlimited_quota: true,
    model_limits_enabled: models.length > 0,
    model_limits: models.join(','),
    allow_ips: '',
    allow_user_quota_query: false,
    group: '',
    auto_groups: [],
    cross_group_retry: false,
  })
  if (!res.success) throw createServerError(res, 'Failed to create API key')
}

/** Adds image models the token doesn't allow yet (new models on the site). */
async function allowModels(token: ApiKey, models: string[]) {
  if (!token.model_limits_enabled) return
  const allowed = new Set((token.model_limits ?? '').split(',').filter(Boolean))
  const missing = models.filter((m) => !allowed.has(m))
  if (!missing.length) return
  const res = await updateApiKey({
    id: token.id,
    name: token.name,
    remain_quota: token.remain_quota,
    expired_time: token.expired_time,
    unlimited_quota: token.unlimited_quota,
    model_limits_enabled: true,
    model_limits: [...allowed, ...missing].join(','),
    allow_ips: token.allow_ips ?? '',
    allow_user_quota_query: token.allow_user_quota_query,
    group: token.group ?? '',
    auto_groups: token.auto_groups ?? [],
    cross_group_retry: token.cross_group_retry,
  })
  if (!res.success) throw createServerError(res, 'Failed to update API key')
}

async function resolveKey(uid: number, models: string[]): Promise<string> {
  let token = await findToken()
  if (!token) {
    await createToken(models)
    token = await findToken()
  }
  if (!token) throw new DrawKeyError('missing')
  if (token.status !== API_KEY_STATUS.ENABLED) {
    throw new DrawKeyError('disabled')
  }
  await allowModels(token, models)
  const res = await fetchTokenKey(token.id)
  if (!res.success || !res.data?.key) {
    throw createServerError(res, 'Failed to load API keys')
  }
  const key = `sk-${res.data.key}`
  writeCache({ uid, id: token.id, key })
  return key
}

let inflight: Promise<string> | null = null

/** The key for drawing; `fresh` skips this browser's copy (e.g. after a 401). */
export function getDrawKey(
  uid: number,
  models: string[],
  fresh = false
): Promise<string> {
  const cached = readCache()
  if (!fresh && cached && cached.uid === uid) return Promise.resolve(cached.key)
  if (fresh) writeCache(null)
  inflight ??= resolveKey(uid, models).finally(() => {
    inflight = null
  })
  return inflight
}

/** Once per visit: make sure the token still allows every image model. */
export async function syncDrawToken(uid: number, models: string[]) {
  const cached = readCache()
  if (!cached || cached.uid !== uid || !models.length) return
  const token = await findToken()
  if (!token || token.id !== cached.id) {
    writeCache(null)
    return
  }
  await allowModels(token, models)
}
