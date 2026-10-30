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
/** Amount buttons, in yuan, when pay-bridge lists no bonus tiers (DeepSeek's) */
export const DEFAULT_CHIPS = [10, 20, 50, 100, 300, 500]
/** The smallest button, shown even when no tier starts there */
export const BASE_CHIP = 10
/** Preselected for returning users when it is one of the buttons */
export const DEFAULT_PAY = 100
/** Custom amounts are whole yuan in this range */
export const CUSTOM_MIN = 1
export const CUSTOM_MAX = 10000

export const WALLET_TABS = ['topup', 'code', 'invite', 'history'] as const
export type WalletTab = (typeof WALLET_TABS)[number]

export const HISTORY_PAGE_SIZE = 20

/** pay-bridge grants the bonus, so its rules are the ones to show */
export const PAY_RULES_URL = '/pay/rules'

/** Payment types the cashier (EPay via pay-bridge) handles */
export const EPAY_TYPES = ['alipay', 'wxpay', 'qqpay']

export const walletKeys = {
  all: ['bear-wallet'] as const,
  topupInfo: ['bear-wallet', 'topup-info'] as const,
  rules: ['bear-wallet', 'rules'] as const,
  subscriptions: ['bear-wallet', 'subscriptions'] as const,
  plans: ['bear-wallet', 'plans'] as const,
  history: ['bear-wallet', 'history'] as const,
  payMoney: ['bear-wallet', 'pay-money'] as const,
}
