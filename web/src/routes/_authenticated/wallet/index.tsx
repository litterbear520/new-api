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
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { BearWallet } from '@/features/bear-wallet'
import { WALLET_TABS } from '@/features/bear-wallet/constants'

const walletSearchSchema = z.object({
  show_history: z.boolean().optional(),
  // Top-up amount picked elsewhere (the overview's quick amounts)
  amount: z.number().positive().optional().catch(undefined),
  tab: z.enum(WALLET_TABS).optional().catch(undefined),
  // Order number pay-bridge sends the payer back with
  paid: z.string().max(64).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/wallet/')({
  component: RouteComponent,
  validateSearch: walletSearchSchema,
})

function RouteComponent() {
  const { show_history, amount, tab, paid } = Route.useSearch()
  return (
    <BearWallet
      initialTab={show_history ? 'history' : tab}
      initialAmount={amount}
      paid={paid}
    />
  )
}
