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
import { beforeEach, describe, expect, test, vi } from 'vitest'

const KEY = 'bear-chat.night-sea'

// The store reads the saved state when the module loads, so each test imports it fresh.
async function freshStore() {
  vi.resetModules()
  const mod = await import('../night-sea-store')
  return mod.useNightSeaStore
}

describe('night sea', () => {
  beforeEach(() => localStorage.clear())

  test('cannot be turned off before it is found', async () => {
    const store = await freshStore()
    store.getState().setOn(false)
    expect(store.getState()).toMatchObject({ found: false, on: false })
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  test('stays found after a reload, on or off', async () => {
    let store = await freshStore()
    store.getState().setOn(true)
    expect(store.getState()).toMatchObject({ found: true, on: true })
    store = await freshStore()
    expect(store.getState()).toMatchObject({ found: true, on: true })
    store.getState().setOn(false)
    store = await freshStore()
    expect(store.getState()).toMatchObject({ found: true, on: false })
  })

  test('ignores a value it did not write', async () => {
    localStorage.setItem(KEY, 'yes')
    const store = await freshStore()
    expect(store.getState()).toMatchObject({ found: false, on: false })
  })
})
