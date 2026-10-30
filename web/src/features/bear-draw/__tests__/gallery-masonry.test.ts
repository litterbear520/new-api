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
import { describe, expect, it } from 'vitest'

import { assignColumns, columnCount } from '../components/gallery/masonry'

const card = (id: string, w?: number, h?: number) => ({ id, w, h })
const ids = (cols: Array<{ items: Array<{ id: string }> }>) =>
  cols.map((c) => c.items.map((it) => it.id))

describe('columnCount', () => {
  it('fits 224px tracks into the width, between 2 and 5 columns', () => {
    expect(columnCount(300)).toBe(2)
    expect(columnCount(700)).toBe(3)
    expect(columnCount(1000)).toBe(4)
    expect(columnCount(2400)).toBe(5)
  })

  it('assumes a 1000px wall before the wall has been measured', () => {
    expect(columnCount(0)).toBe(4)
  })
})

describe('assignColumns', () => {
  it('fills the top row left to right when the cards are the same size', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => card(id, 100, 100))
    expect(ids(assignColumns(items, 2))).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ])
  })

  it('puts each card into the column that is shortest so far', () => {
    const items = [
      card('tall', 100, 200),
      card('b', 100, 100),
      card('c', 100, 100),
      card('d', 100, 100),
    ]
    expect(ids(assignColumns(items, 2))).toEqual([
      ['tall', 'd'],
      ['b', 'c'],
    ])
  })

  it('counts a card without a size as a 3:4 portrait', () => {
    const items = [card('unknown'), card('b', 100, 130), card('c', 100, 100)]
    // 4/3 > 1.3, so the second column is shorter when c arrives
    expect(ids(assignColumns(items, 2))).toEqual([['unknown'], ['b', 'c']])
  })

  it('gives every column a stable id, also when it stays empty', () => {
    const cols = assignColumns([card('a', 1, 1)], 3)
    expect(cols.map((c) => c.id)).toEqual(['col-0', 'col-1', 'col-2'])
    expect(ids(cols)).toEqual([['a'], [], []])
  })
})
