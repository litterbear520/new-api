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
import { quotaPerUnit } from '@/features/bear-overview/lib/money'
import type {
  SubscriptionPlan,
  UserSubscription,
} from '@/features/subscriptions/types'

import type { FirstRule, PayRules } from './rules'

export type PackKind = 'bonus' | 'first' | 'gift' | 'plan'

/** A subscription with quota left, spent before the wallet */
export interface Pack {
  id: number
  kind: PackKind
  /** Quota units */
  total: number
  left: number
  startsAt: number
  /** Unix seconds */
  endsAt: number
}

/** Active packs with quota left, soonest to expire first */
export function activePacks(
  subscriptions: UserSubscription[],
  rules: Pick<PayRules, 'bonusPlanId' | 'giftPlanId' | 'first'>,
  nowSeconds: number
): Pack[] {
  return subscriptions
    .filter(
      (sub) =>
        sub.status === 'active' &&
        sub.end_time > nowSeconds &&
        // 0 means unlimited: not a pack of credit
        sub.amount_total > 0
    )
    .map((sub) => {
      let kind: PackKind = 'plan'
      if (sub.plan_id === rules.bonusPlanId) kind = 'bonus'
      else if (rules.first?.planId && sub.plan_id === rules.first.planId) {
        kind = 'first'
      } else if (sub.plan_id === rules.giftPlanId) kind = 'gift'
      return {
        id: sub.id,
        kind,
        total: sub.amount_total,
        left: Math.max(0, sub.amount_total - sub.amount_used),
        startsAt: sub.start_time,
        endsAt: sub.end_time,
      }
    })
    .filter((pack) => pack.left > 0)
    .sort((a, b) => a.endsAt - b.endsAt)
}

export function packsLeft(packs: Pack[]): number {
  return packs.reduce((sum, pack) => sum + pack.left, 0)
}

/** The gift plan, while it is on sale and this user may still buy it */
export function giftOffer(
  plans: SubscriptionPlan[],
  all: UserSubscription[],
  giftPlanId: number | null
): SubscriptionPlan | null {
  if (!giftPlanId) return null
  const plan = plans.find((item) => item.id === giftPlanId && item.enabled)
  if (!plan || plan.total_amount <= 0) return null
  const bought = all.filter((sub) => sub.plan_id === plan.id).length
  if (plan.max_purchase_per_user > 0 && bought >= plan.max_purchase_per_user) {
    return null
  }
  return plan
}

/**
 * Whether the user may still get the 新人礼包. It is once per account, so it is
 * gone after any subscription on its plan, expired ones included; pay-bridge
 * checks its own orders the same way. False until the subscriptions load.
 */
export function starterOpen(
  first: FirstRule | null,
  all: UserSubscription[] | undefined
): boolean {
  if (!first?.planId || !all) return false
  return !all.some((sub) => sub.plan_id === first.planId)
}

/** How many days a plan lasts, or null when it is not a whole number of days */
export function planDays(plan: SubscriptionPlan): number | null {
  const value = plan.duration_value
  switch (plan.duration_unit) {
    case 'day':
      return value
    case 'custom': {
      const days = (plan.custom_seconds ?? 0) / 86400
      return Number.isInteger(days) && days > 0 ? days : null
    }
    default:
      return null
  }
}

/** Quota units to dollars, by the site's QuotaPerUnit */
export function quotaToUsd(quota: number, perUnit = quotaPerUnit()): number {
  return Math.round((quota / perUnit) * 100) / 100
}
