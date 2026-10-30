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
import { useQueries } from '@tanstack/react-query'

import { calculateAmount, isApiSuccess } from '@/features/wallet/api'
import { getPaymentErrorTranslation } from '@/features/wallet/lib'
import { createServerError } from '@/lib/server-error-message'

import { walletKeys } from '../constants'

/** Tries for a price that fails to load (network, 5xx), the first included */
const MAX_TRIES = 4

/** New API's answer for one top-up amount */
export interface PayMoney {
  /** Yuan the cashier will charge, once New API has answered */
  money: number | null
  /** New API's response refusing this amount; final, never retried */
  refusal: Record<string, unknown> | null
  /** The price could not be loaded, retries included */
  failed: boolean
  /** No answer yet, retries included */
  pending: boolean
  /** No answer yet and no try has failed: nothing to show for it */
  firstPending: boolean
  retry: () => void
}

const WAITING: PayMoney = {
  money: null,
  refusal: null,
  failed: false,
  pending: true,
  firstPending: true,
  retry: () => undefined,
}

/** No amount to ask about (0): nothing to wait for */
const NOTHING: PayMoney = { ...WAITING, pending: false, firstPending: false }

/** The response behind a refusal, or null for a failed request */
function refusalOf(error: unknown): Record<string, unknown> | null {
  const cause = error instanceof Error ? error.cause : null
  if (!cause || typeof cause !== 'object') return null
  const body = cause as Record<string, unknown>
  return body.message === 'error' || body.success === false ? body : null
}

/**
 * Why New API refused an amount, in the language shown now: its message key
 * translated at render time, else its own text. Null when it gave neither.
 */
export function refusalText(refusal: Record<string, unknown>): string | null {
  const translated = getPaymentErrorTranslation(refusal)
  if (translated) return translated
  return typeof refusal.data === 'string' && refusal.data ? refusal.data : null
}

async function fetchPayMoney(amount: number): Promise<number> {
  const res = await calculateAmount({ amount })
  const money = isApiSuccess(res)
    ? Number.parseFloat(String(res.data))
    : Number.NaN
  if (Number.isFinite(money) && money > 0) return money
  // The response stays the cause, so the reason is translated when shown.
  throw createServerError(
    isApiSuccess(res) ? { ...res, message: 'error' } : res
  )
}

/**
 * What New API charges for each top-up amount (POST /api/user/amount): the
 * amount × Price × the user group's top-up ratio × any preset discount. Only
 * the server knows the group ratio, so the dialog shows this answer, not a
 * sum of its own. Amounts are in New API's request unit (topupRequestAmount).
 * A refusal is final; a failed request is retried a few times, then offers
 * `retry`.
 */
export function usePayMoney(
  amounts: number[],
  enabled: boolean
): (amount: number) => PayMoney {
  const unique = [...new Set(amounts)].filter((amount) => amount > 0)
  const results = useQueries({
    queries: unique.map((amount) => ({
      queryKey: [...walletKeys.payMoney, amount],
      queryFn: () => fetchPayMoney(amount),
      enabled,
      staleTime: 60 * 1000,
      retry: (failures: number, error: Error) =>
        refusalOf(error) === null && failures < MAX_TRIES - 1,
      // The dialog says what went wrong instead of a toast.
      meta: { errorToast: false },
    })),
  })
  return (amount: number) => {
    if (!(amount > 0)) return NOTHING
    const result = results[unique.indexOf(amount)]
    if (!result) return WAITING
    const retry = () => void result.refetch()
    if (result.isSuccess) {
      return {
        money: result.data,
        refusal: null,
        failed: false,
        pending: false,
        firstPending: false,
        retry,
      }
    }
    if (result.isError && !result.isFetching) {
      const refusal = refusalOf(result.error)
      return {
        money: null,
        refusal,
        failed: refusal === null,
        pending: false,
        firstPending: false,
        retry,
      }
    }
    return {
      ...WAITING,
      firstPending: result.isPending && result.failureCount === 0,
      retry,
    }
  }
}
