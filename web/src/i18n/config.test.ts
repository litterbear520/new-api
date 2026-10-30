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

import i18n, { i18nReady } from './config'

declare const __EN_OVERRIDES__: Record<string, string>

// test-setup has already initialised the shared instance in English, so
// language detection is not exercised here; switching languages is.
describe('i18n config', () => {
  test('fetches a language only when it is switched to', async () => {
    await i18nReady
    expect(i18n.hasResourceBundle('zhCN', 'translation')).toBe(false)

    await i18n.changeLanguage('zhCN')
    expect(i18n.t('Save')).toBe('保存')
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(false)

    await i18n.changeLanguage('fr')
    expect(i18n.t('Save')).toBe('Enregistrer')
  })

  test('falls back to the bundled English for unknown keys', async () => {
    await i18n.changeLanguage('ja')
    expect(i18n.t('A key no locale has')).toBe('A key no locale has')
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true)
  })

  test('English is the key itself, plus the entries that differ from it', async () => {
    // test-setup re-initialises English as empty, so put the build's entries back
    expect(__EN_OVERRIDES__).not.toHaveProperty('Save')
    i18n.addResourceBundle('en', 'translation', __EN_OVERRIDES__, true, true)
    await i18n.changeLanguage('en')
    expect(i18n.t('Save')).toBe('Save')
    expect(i18n.t('Ali')).toBe('Alibaba Bailian')
    expect(i18n.t('{{count}} outside this view', { count: 3 })).toBe(
      '3 outside this view'
    )
  })
})
