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
import { expect, it } from 'vitest'

import { shownUsageLogsSection } from '../shown-section'

it('keeps the tab in the URL while it is on', () => {
  expect(shownUsageLogsSection('task', ['common', 'task'])).toBe('task')
})

it.each([
  [['task'], 'task'],
  [['drawing'], 'drawing'],
  [['task', 'drawing'], 'task'],
] as const)(
  'opens the first tab that is on when common logs are off (%j)',
  (visible, shown) => {
    expect(shownUsageLogsSection('common', visible)).toBe(shown)
  }
)

it('keeps the URL tab when every tab is off', () => {
  expect(shownUsageLogsSection('common', [])).toBe('common')
})
