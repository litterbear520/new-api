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

// The store reads its flags when the module loads, so each test imports it fresh.
async function freshStore() {
  vi.resetModules()
  const mod = await import('../draw-dot-store')
  return mod.useDrawDotStore
}

describe('draw dot', () => {
  beforeEach(() => localStorage.clear())

  test('shows "new" until the page is opened once', async () => {
    let store = await freshStore()
    expect(store.getState().dot).toBe('new')
    store.getState().pageOpened()
    expect(store.getState().dot).toBeNull()
    store = await freshStore()
    expect(store.getState().dot).toBeNull()
  })

  test('lights when a picture finishes on another page, also after a reload', async () => {
    let store = await freshStore()
    store.getState().pageOpened()
    store.getState().pageClosed()
    store.getState().finished()
    expect(store.getState().dot).toBe('done')
    store = await freshStore()
    expect(store.getState().dot).toBe('done')
    store.getState().pageOpened()
    expect(store.getState().dot).toBeNull()
  })

  test('stays off when the picture finishes on the draw page', async () => {
    const store = await freshStore()
    store.getState().pageOpened()
    store.getState().finished()
    expect(store.getState().dot).toBeNull()
  })
})
