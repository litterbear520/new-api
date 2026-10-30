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

import { isSiteLinkActive, siteLinkTarget } from '../site-nav'

describe('isSiteLinkActive', () => {
  test('lights 控制台 on every console page and nothing else there', () => {
    const at = '/usage-logs/common'
    expect(isSiteLinkActive('/dashboard', at, true)).toBe(true)
    expect(isSiteLinkActive('/', at, true)).toBe(false)
    expect(isSiteLinkActive('/pricing', at, true)).toBe(false)
  })

  test('outside the console 控制台 stays dark', () => {
    expect(isSiteLinkActive('/dashboard', '/pricing', false)).toBe(false)
  })

  test('lights 主页 only on the home page itself', () => {
    expect(isSiteLinkActive('/', '/', false)).toBe(true)
    expect(isSiteLinkActive('/', '/pricing', false)).toBe(false)
  })

  test('lights a section on its own pages too', () => {
    expect(isSiteLinkActive('/pricing', '/pricing', false)).toBe(true)
    expect(isSiteLinkActive('/pricing', '/pricing/gpt-6', false)).toBe(true)
    expect(isSiteLinkActive('/pricing', '/pricingx', false)).toBe(false)
    expect(isSiteLinkActive('/docs/', '/docs', false)).toBe(true)
  })
})

describe('siteLinkTarget', () => {
  test('in-app routes go through the router', () => {
    expect(siteLinkTarget({ title: 'Home', href: '/' })).toBe('route')
  })

  test('the docs site on this domain loads in the same tab', () => {
    expect(
      siteLinkTarget({ title: 'Docs', href: '/docs/', external: true })
    ).toBe('page')
  })

  test('another site opens in a new tab', () => {
    expect(
      siteLinkTarget({
        title: 'Docs',
        href: 'https://docs.example.com',
        external: true,
      })
    ).toBe('tab')
    expect(
      siteLinkTarget({
        title: 'Docs',
        href: '//docs.example.com',
        external: true,
      })
    ).toBe('tab')
  })
})
