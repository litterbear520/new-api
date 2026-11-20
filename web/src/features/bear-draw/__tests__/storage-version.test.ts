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

import { nextRev } from '../lib/storage'

describe('the version check before a project is written', () => {
  test('a project never stored is written as version 1', () => {
    expect(nextRev(undefined, null)).toBe(1)
  })

  test('the version this tab read is written as the next one', () => {
    expect(nextRev({ rev: 4 }, 4)).toBe(5)
  })

  test('a record stored before versions counts as version 0', () => {
    expect(nextRev({}, 0)).toBe(1)
  })

  test('a newer stored version is not overwritten', () => {
    expect(nextRev({ rev: 5 }, 4)).toBeNull()
  })

  test('a record deleted since it was read is not written back', () => {
    expect(nextRev(undefined, 4)).toBeNull()
  })

  test('a record stored by another tab first is not overwritten by a new copy', () => {
    expect(nextRev({ rev: 1 }, null)).toBeNull()
  })
})
