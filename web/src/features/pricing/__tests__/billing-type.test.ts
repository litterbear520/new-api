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
import { describe, expect, it } from 'vitest'

import { QUOTA_TYPES } from '../constants'
import { filterByQuotaType, getModelBillingType } from '../lib/filters'
import type { PricingModel } from '../types'

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

const TASK_SCHEMA = { seconds: { type: 'number', unit: 'second' } } as const

const MODELS = [
  model({ id: 1, model_name: 'token' }),
  model({ id: 2, model_name: 'request', quota_type: 1 }),
  model({
    id: 3,
    model_name: 'task-on-token',
    billing_usage_schema: TASK_SCHEMA,
  }),
  model({
    id: 4,
    model_name: 'task-on-request',
    quota_type: 1,
    billing_usage_schema: TASK_SCHEMA,
  }),
  model({ id: 5, model_name: 'unknown', quota_type: 2 }),
]

describe('model billing type', () => {
  it.each([
    [QUOTA_TYPES.TOKEN, ['token']],
    [QUOTA_TYPES.REQUEST, ['request']],
    [QUOTA_TYPES.TASK, ['task-on-token', 'task-on-request']],
  ])(
    'counts as many %s models as filtering by that type returns',
    (type, names) => {
      const counted = MODELS.filter(
        (item) => getModelBillingType(item) === type
      )
      const filtered = filterByQuotaType(MODELS, type)
      expect(filtered.map((item) => item.model_name)).toEqual(names)
      expect(counted).toHaveLength(filtered.length)
    }
  )

  it('puts a model with an unknown quota type in no bucket', () => {
    expect(getModelBillingType(MODELS[4])).toBeUndefined()
  })
})
