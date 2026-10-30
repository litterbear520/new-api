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

/** pay-bridge's 专属号额度 endpoint (see pay-bridge README) */
export const ACCOUNT_QUOTA_URL = '/pay/quota'

/** pay-bridge's 重置额度 endpoint (spends one manual reset) */
export const ACCOUNT_QUOTA_RESET_URL = '/pay/quota/reset'

/** "Almost used up" at or under this share left */
export const LOW_LEFT = 10

/** Colour bands: green from 70% left, amber from 30%, red below */
export const GOOD_LEFT = 70
export const WARN_LEFT = 30

/** A manual reset that expires within this many days is flagged */
export const SOON_DAYS = 3

/** Numbers older than this get a "may have changed" note */
export const STALE_AFTER_SECONDS = 60 * 60

/** pay-bridge refreshes the numbers at most once per this many minutes (QUOTA_TTL) */
export const REFRESH_MINUTES = 5

export type QuotaWindowId = 'five_hour' | 'weekly' | 'monthly'

export type QuotaWindow = {
  id: QuotaWindowId
  /** Share left, 0–100 */
  left: number
  /** Unix seconds */
  resetAt: number | null
}

export type QuotaLevel = 'good' | 'warn' | 'bad'

export function quotaLevel(left: number): QuotaLevel {
  if (left >= GOOD_LEFT) return 'good'
  if (left >= WARN_LEFT) return 'warn'
  return 'bad'
}

/** Manual resets (重置卡): each puts the 5-hour and weekly limits back to full */
export type ResetCards = {
  /** Unused resets */
  available: number
  /**
   * Resets OpenAI says would change something now; 0 while enough is left.
   * null when OpenAI didn't say.
   */
  usable: number | null
  /** Unix seconds, the one that expires first first */
  expiresAt: number[]
}

export type AccountQuota = {
  group: string
  plan: string | null
  windows: QuotaWindow[]
  /** null when OpenAI sent nothing about manual resets */
  resets: ResetCards | null
  fetchedAt: number | null
  nextRefreshAt: number
  /** The last read failed; these are older numbers */
  stale: boolean
  /** Nothing could be read yet */
  error: boolean
}

const WINDOW_IDS: ReadonlySet<string> = new Set([
  'five_hour',
  'weekly',
  'monthly',
])

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function parseResets(raw: unknown): ResetCards | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const available = num(r.available)
  if (available === null) return null
  const usable = num(r.usable)
  const expiresAt = (Array.isArray(r.expires_at) ? r.expires_at : [])
    .map(num)
    .filter((at): at is number => at !== null)
    .sort((a, b) => a - b)
  return {
    available: Math.max(0, Math.floor(available)),
    usable: usable === null ? null : Math.max(0, usable),
    expiresAt,
  }
}

/**
 * Reads /pay/quota leniently: no account, a malformed reply or an unknown
 * window means nothing to show for that part.
 */
export function parseAccountQuota(raw: unknown): AccountQuota | null {
  if (!raw || typeof raw !== 'object') return null
  const account = (raw as { account?: unknown }).account
  if (!account || typeof account !== 'object') return null
  const a = account as Record<string, unknown>
  if (typeof a.group !== 'string' || !a.group) return null

  const windows: QuotaWindow[] = []
  for (const item of Array.isArray(a.windows) ? a.windows : []) {
    if (!item || typeof item !== 'object') continue
    const w = item as Record<string, unknown>
    const used = num(w.used_percent)
    if (typeof w.id !== 'string' || !WINDOW_IDS.has(w.id)) continue
    if (used === null) continue
    windows.push({
      id: w.id as QuotaWindowId,
      left: Math.max(0, Math.min(100, 100 - used)),
      resetAt: num(w.reset_at),
    })
  }
  return {
    group: a.group,
    plan: typeof a.plan === 'string' && a.plan ? a.plan : null,
    windows,
    resets: parseResets(a.resets),
    fetchedAt: num(a.fetched_at),
    nextRefreshAt: num(a.next_refresh_at) ?? 0,
    stale: a.stale === true,
    error: windows.length === 0,
  }
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  prolite: 'Pro Lite',
  team: 'Team',
  business: 'Business',
  enterprise: 'Enterprise',
  edu: 'Edu',
}

/** "ChatGPT Plus"; an unknown plan type is shown as sent */
export function planLabel(plan: string | null): string | null {
  if (!plan) return null
  return `ChatGPT ${PLAN_NAMES[plan.toLowerCase()] ?? plan}`
}

/** "今天 13:14" today, else "11月1日周日 14:22" */
export function resetTime(
  resetAt: number,
  now: Date,
  locale: Intl.LocalesArgument,
  today: string
): string {
  const at = new Date(resetAt * 1000)
  const clock = at.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  if (at.toDateString() === now.toDateString()) return `${today} ${clock}`
  const date = at.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
  return `${date} ${clock}`
}

/** "GMT+8" for an offset east of UTC in minutes */
export function gmtLabel(offsetMinutes: number): string {
  if (!offsetMinutes) return 'GMT'
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(Math.trunc(offsetMinutes))
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return minutes
    ? `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`
    : `GMT${sign}${hours}`
}

/** "10/30 01:24 · 2天后": when a manual reset expires, in whole days rounded down */
export function resetExpiry(
  expiresAt: number,
  now: Date,
  locale: Intl.LocalesArgument
): string {
  const date = new Date(expiresAt * 1000).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const left = Math.max(0, expiresAt - Math.floor(now.getTime() / 1000))
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  let until = rtf.format(Math.max(1, Math.floor(left / 60)), 'minute')
  if (left >= 86400) until = rtf.format(Math.floor(left / 86400), 'day')
  else if (left >= 3600) until = rtf.format(Math.floor(left / 3600), 'hour')
  return `${date} · ${until}`
}

export type ResetResult =
  | 'reset'
  | 'not_needed'
  | 'no_credit'
  | 'busy'
  | 'unknown'
  | 'unavailable'
  | 'no_account'

const RESET_RESULTS: ReadonlySet<string> = new Set([
  'reset',
  'not_needed',
  'no_credit',
  'busy',
  'unknown',
  'unavailable',
  'no_account',
])

/** pay-bridge's reply to 重置额度; anything unexpected counts as unknown */
export function parseResetReply(raw: unknown): {
  result: ResetResult
  quota: AccountQuota | null
} {
  const r = raw && typeof raw === 'object' ? (raw as { result?: unknown }) : {}
  const result =
    typeof r.result === 'string' && RESET_RESULTS.has(r.result)
      ? (r.result as ResetResult)
      : 'unknown'
  return { result, quota: parseAccountQuota(raw) }
}

/**
 * One id per 重置额度 confirmation. OpenAI de-duplicates on it, so a retry
 * with the same id can't spend a second reset. randomUUID needs a secure page;
 * the IP site is plain http.
 */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
