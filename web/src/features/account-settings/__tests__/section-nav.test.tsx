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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SectionNav } from '../components/section-nav'
import type { SettingsSection } from '../constants'

const SECTIONS: SettingsSection[] = [
  'profile',
  'security',
  'notifications',
  'audit',
]

afterEach(() => {
  vi.restoreAllMocks()
})

/** The phone layout: a 300px row with each section 100px wide. */
function layOutRow() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const item = this.closest('li')
      if (this.tagName === 'UL') {
        return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 36 })
      }
      if (item?.parentElement) {
        const index = [...item.parentElement.children].indexOf(item)
        return DOMRect.fromRect({
          x: index * 100,
          y: 0,
          width: 100,
          height: 36,
        })
      }
      return DOMRect.fromRect()
    }
  )
}

async function renderNav(current: SettingsSection) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <SectionNav sections={SECTIONS} current={current} />,
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

describe('account settings section nav', () => {
  it('scrolls the row on a phone to the current section when it starts out of view', async () => {
    layOutRow()
    await renderNav('audit')

    const row = (
      await screen.findByRole('link', { name: 'Audit Logs' })
    ).closest('ul')
    // 「审计日志」 spans 300–400px in a 300px row: 100px, plus the 24px fade.
    expect(row?.scrollLeft).toBe(124)
  })
})
