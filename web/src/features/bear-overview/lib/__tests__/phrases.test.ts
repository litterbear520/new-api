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
import type { TFunction } from 'i18next'
import { describe, expect, test } from 'vitest'

import { daysPhrase } from '../phrases'

const t = ((key: string, values?: Record<string, number>) =>
  key.replaceAll(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values?.[name] ?? '')
  )) as TFunction

describe('daysPhrase', () => {
  test('rounds down to whole days and caps very long runs', () => {
    expect(daysPhrase(t, 0.4)).toBe('under a day')
    expect(daysPhrase(t, 1.7)).toBe('about a day')
    expect(daysPhrase(t, 12.9)).toBe('about 12 days')
    expect(daysPhrase(t, 5000000)).toBe('over 100 days')
  })
})
