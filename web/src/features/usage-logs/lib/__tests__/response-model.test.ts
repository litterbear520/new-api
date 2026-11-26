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
import { describe, expect, test } from 'vitest'

import {
  isCodexFastResponse,
  isResponseModelMismatch,
  type ResponseModelObservation,
} from '../response-model'

function observation(
  returned: string,
  overrides: Partial<ResponseModelObservation> = {}
): ResponseModelObservation {
  return {
    requested_model: 'requested',
    upstream_model: 'mapped',
    returned_model: returned,
    ...overrides,
  }
}

describe('isResponseModelMismatch', () => {
  test.each([
    ['requested', 'exact requested model'],
    ['mapped', 'exact upstream model'],
    ['Requested', 'case-only difference'],
    ['requested-2026-09-01', 'dated variant of the requested model'],
    ['mapped-2026-09-01', 'dated variant of the upstream model'],
    ['deepseek/requested', 'provider path in front of the requested model'],
    ['vendor/MAPPED', 'provider path with a case-only difference'],
    ['accounts/vendor/models/requested', 'nested provider path'],
  ])('treats %s as compatible (%s)', (returned) => {
    expect(isResponseModelMismatch(observation(returned))).toBe(false)
  })

  test.each([
    ['other', 'different model'],
    ['request', 'shorter name that the expected model extends'],
    ['vendor/other', 'different model behind a provider path'],
    ['vendor/request', 'provider path with a shorter name'],
    ['vendor/', 'provider path with no model segment'],
    ['vendor', 'provider segment alone'],
  ])('flags %s as a mismatch (%s)', (returned) => {
    expect(isResponseModelMismatch(observation(returned))).toBe(true)
  })

  test('compares against provider-qualified requested and upstream names as written', () => {
    expect(
      isResponseModelMismatch(
        observation('vendor/requested-2026-09-01', {
          requested_model: 'vendor/requested',
        })
      )
    ).toBe(false)
    expect(
      isResponseModelMismatch(
        observation('vendor/other', { requested_model: 'vendor/requested' })
      )
    ).toBe(true)
  })

  test('empty expected names never match', () => {
    expect(
      isResponseModelMismatch(
        observation('other', { requested_model: '', upstream_model: '' })
      )
    ).toBe(true)
  })

  test('returns false without an observation or a returned model', () => {
    expect(isResponseModelMismatch(undefined)).toBe(false)
    expect(isResponseModelMismatch(observation(''))).toBe(false)
  })
})

describe('Codex Fast responses', () => {
  test.each([
    ['gpt-6.2-sol-fast', 'gpt-6.2-sol-fast', 'gpt-6.2-sol'],
    ['gpt-6-astra-fast', 'gpt-6-astra-fast', 'GPT-6-Astra'],
    ['gpt-6.2-astra-fast', 'team_a/gpt-6.2-astra-fast', 'gpt-6.2-astra'],
    ['gpt-6.1-sol-fast', 'gpt-6.1-sol-fast', 'gpt-6.1-sol-2026-09-01'],
  ])(
    '%s answered as the base model is Fast, not a mismatch',
    (requested, upstream, returned) => {
      const fast = observation(returned, {
        requested_model: requested,
        upstream_model: upstream,
      })
      expect(isResponseModelMismatch(fast)).toBe(false)
      expect(isCodexFastResponse(fast)).toBe(true)
    }
  )

  test.each([
    ['gpt-6.2-sol-fast', 'gpt-6.2-astra', 'a different GPT model'],
    ['grok-4-fast', 'grok-4', 'a -fast name that is not a Codex model'],
    ['gpt-6.2-sol-fast', 'gpt-6.2', 'a shorter name'],
  ])('%s answered as %s stays a mismatch (%s)', (requested, returned) => {
    const other = observation(returned, {
      requested_model: requested,
      upstream_model: requested,
    })
    expect(isResponseModelMismatch(other)).toBe(true)
    expect(isCodexFastResponse(other)).toBe(false)
  })

  test('plain models and missing observations are not Fast', () => {
    expect(isCodexFastResponse(undefined)).toBe(false)
    expect(isCodexFastResponse(observation('requested'))).toBe(false)
    expect(
      isCodexFastResponse(
        observation('', { requested_model: 'gpt-6.2-sol-fast' })
      )
    ).toBe(false)
  })
})
