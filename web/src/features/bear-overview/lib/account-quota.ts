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

/** pay-bridge's 刷新额度 endpoint: the only read that reaches the upstream */
export const ACCOUNT_QUOTA_REFRESH_URL = '/pay/quota/refresh'

/** pay-bridge's 重置额度 endpoint (spends one manual reset) */
export const ACCOUNT_QUOTA_RESET_URL = '/pay/quota/reset'

/** Colour bands: green from 70% left, amber from 30%, red below */
export const GOOD_LEFT = 70
export const WARN_LEFT = 30

/** A manual reset that expires within this many days is flagged */
export const SOON_DAYS = 3

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

/** The window's reset time has passed since this reading was taken */
export function hasReset(window: QuotaWindow, nowSeconds: number): boolean {
  return window.resetAt !== null && window.resetAt <= nowSeconds
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

/** The manual resets that have not expired since this reading was taken */
export function liveResets(
  resets: ResetCards | null,
  nowSeconds: number
): ResetCards | null {
  if (!resets) return null
  const expiresAt = resets.expiresAt.filter((at) => at > nowSeconds)
  const expired = resets.expiresAt.length - expiresAt.length
  return {
    ...resets,
    available: Math.max(0, resets.available - expired),
    expiresAt,
  }
}

export type AccountProvider = 'codex' | 'claude'

export type AccountQuota = {
  group: string
  provider: AccountProvider
  plan: string | null
  windows: QuotaWindow[]
  /** null when OpenAI sent nothing about manual resets */
  resets: ResetCards | null
  fetchedAt: number | null
  nextRefreshAt: number
  /** The last read failed; these are older numbers */
  stale: boolean
  /** Nobody has pressed refresh yet, so there are no numbers */
  never: boolean
  /** A read failed and there are no older numbers to show */
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
  const fetchedAt = num(a.fetched_at)
  const never =
    windows.length === 0 && fetchedAt === null && a.error !== 'unavailable'
  return {
    group: a.group,
    provider: a.provider === 'claude' ? 'claude' : 'codex',
    plan: typeof a.plan === 'string' && a.plan ? a.plan : null,
    windows,
    resets: parseResets(a.resets),
    fetchedAt,
    nextRefreshAt: num(a.next_refresh_at) ?? 0,
    stale: a.stale === true,
    never,
    error: windows.length === 0 && !never,
  }
}

/** The nameplate's material. Plans of about the same price share one. */
export type PlanTier = 'plain' | 'gold' | 'platinum' | 'diamond'

type PlanName = { name: string; tier: PlanTier }

const PLANS: Record<AccountProvider, Record<string, PlanName>> = {
  codex: {
    free: { name: 'Free', tier: 'plain' },
    edu: { name: 'Edu', tier: 'gold' },
    plus: { name: 'Plus', tier: 'gold' },
    prolite: { name: 'Pro Lite', tier: 'platinum' },
    team: { name: 'Team', tier: 'platinum' },
    business: { name: 'Business', tier: 'platinum' },
    pro: { name: 'Pro', tier: 'diamond' },
    enterprise: { name: 'Enterprise', tier: 'diamond' },
  },
  claude: {
    free: { name: 'Free', tier: 'plain' },
    pro: { name: 'Pro', tier: 'gold' },
    max: { name: 'Max', tier: 'platinum' },
    max_5x: { name: 'Max 5x', tier: 'platinum' },
    team: { name: 'Team', tier: 'platinum' },
    max_20x: { name: 'Max 20x', tier: 'diamond' },
    enterprise: { name: 'Enterprise', tier: 'diamond' },
  },
}

const BRANDS = {
  codex: { brand: 'ChatGPT', icon: 'OpenAI' },
  claude: { brand: 'Claude', icon: 'Claude.Color' },
} as const

/** What the card's header shows. An unknown plan type is shown as sent. */
export function subscription(provider: AccountProvider, plan: string | null) {
  const known = plan ? PLANS[provider][plan.toLowerCase()] : undefined
  return {
    ...BRANDS[provider],
    plan: known?.name ?? plan,
    tier: known?.tier ?? ('plain' as PlanTier),
  }
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

/** "10/30 01:24" and "2天后" (rounded down) for a moment in the future */
export function resetParts(
  expiresAt: number,
  now: Date,
  locale: Intl.LocalesArgument
) {
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
  return { date, until, soon: left < 3600 }
}

/** "10/30 01:24 · 2天后": when a manual reset expires */
export function resetExpiry(
  expiresAt: number,
  now: Date,
  locale: Intl.LocalesArgument
): string {
  const { date, until } = resetParts(expiresAt, now, locale)
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
