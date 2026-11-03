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
import { render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { Route } from '@/routes/_authenticated/draw'

vi.mock('@/features/bear-draw', () => ({
  BearDraw: () => <div data-testid='draw' />,
}))

afterEach(() => vi.restoreAllMocks())

function pageScrollFor(search: Record<string, string>) {
  vi.spyOn(Route, 'useSearch').mockReturnValue(search as never)
  const Page = Route.options.component
  if (!Page) throw new Error('no page')
  const { container, unmount } = render(<Page />)
  const on = container.querySelector('main')?.hasAttribute('data-page-scroll')
  unmount()
  return on
}

test('the home and the skills scroll as pages, a project fits the screen', () => {
  expect(pageScrollFor({})).toBe(true)
  expect(pageScrollFor({ view: 'skills' })).toBe(true)
  expect(pageScrollFor({ p: 'a-project' })).toBe(false)
})
