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
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EN_JSON = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/i18n/locales/en.json'
)

/**
 * The i18n keys are the English text, so the app ships only the English
 * entries that differ from their key (src/i18n/config.ts reads them as
 * `__EN_OVERRIDES__`, defined by rsbuild.config.ts and vitest.config.ts).
 */
export function englishOverrides(): Record<string, string> {
  const { translation } = JSON.parse(fs.readFileSync(EN_JSON, 'utf8')) as {
    translation: Record<string, string>
  }
  return Object.fromEntries(
    Object.entries(translation).filter(([key, text]) => key !== text)
  )
}
