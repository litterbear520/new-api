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
import { z } from 'zod'

import { QUOTA_TYPES } from '../constants'

/**
 * URL search of the model square and its details pages. Only what the
 * filter bar can show and clear: an old bookmark with the retired sidebar's
 * endpointType, or a billing type this version does not know, loads
 * unfiltered instead of hiding models.
 */
export const pricingSearchSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  vendor: z.string().optional(),
  group: z.string().optional(),
  quotaType: z
    .enum([
      QUOTA_TYPES.ALL,
      QUOTA_TYPES.TOKEN,
      QUOTA_TYPES.REQUEST,
      QUOTA_TYPES.TASK,
    ])
    .optional()
    .catch(undefined),
  tag: z.string().optional(),
  tokenUnit: z.enum(['M', 'K']).optional(),
  view: z.enum(['card', 'table']).optional().catch(undefined),
  rechargePrice: z.boolean().optional(),
})

export type PricingSearch = z.infer<typeof pricingSearchSchema>
