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
import { Popover } from '@base-ui/react/popover'

import { API_FORMATS, type ApiFormat } from '../constants'

/** The base URL to paste: the line's domain plus the format's path. */
export function apiBaseUrl(line: string, format: ApiFormat): string {
  const base = line.trim().replace(/\/+$/, '')
  const path = API_FORMATS.find((item) => item.id === format)?.path ?? ''
  return `${base}${path}`
}

/** Lets a button elsewhere on the page open the 接入信息 popover next to itself */
export type AccessHandle = Popover.Handle<unknown>

/** The shared ui popover has no handle helper; one per page, kept in state */
export function createAccessHandle(): AccessHandle {
  return Popover.createHandle<unknown>()
}
