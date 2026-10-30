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
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearRetiredThemePreferences,
  THEME_STORAGE_KEYS,
} from '@/lib/theme-storage'

const retiredKeys = [
  THEME_STORAGE_KEYS.preset,
  THEME_STORAGE_KEYS.font,
  THEME_STORAGE_KEYS.radius,
  THEME_STORAGE_KEYS.scale,
  THEME_STORAGE_KEYS.contentLayout,
]

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0]
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  }
})

describe('clearRetiredThemePreferences', () => {
  it('drops the old theme drawer choices and keeps the light/dark mode', () => {
    localStorage.setItem(THEME_STORAGE_KEYS.mode, 'dark')
    for (const key of retiredKeys) localStorage.setItem(key, 'saved')
    localStorage.setItem('unrelated-preference', 'keep')
    document.cookie = 'layout_variant=floating; path=/'
    document.cookie = 'layout_collapsible=offcanvas; path=/'
    document.cookie = 'dir=rtl; path=/'
    document.cookie = 'sidebar_state=false; path=/'

    clearRetiredThemePreferences()

    expect(localStorage.getItem(THEME_STORAGE_KEYS.mode)).toBe('dark')
    for (const key of retiredKeys) expect(localStorage.getItem(key)).toBeNull()
    expect(localStorage.getItem('unrelated-preference')).toBe('keep')
    expect(document.cookie).not.toContain('layout_variant')
    expect(document.cookie).not.toContain('layout_collapsible')
    expect(document.cookie).not.toMatch(/(^|; )dir=/)
    expect(document.cookie).toContain('sidebar_state=false')
  })

  it('does not throw when storage is blocked', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })

    expect(() => clearRetiredThemePreferences()).not.toThrow()
  })
})
