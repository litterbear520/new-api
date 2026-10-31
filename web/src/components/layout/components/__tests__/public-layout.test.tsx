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
import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { PublicLayout } from '../public-layout'

const swap = vi.hoisted(() => ({ now: false }))
vi.mock('@/lib/page-swap', () => ({ inPageSwap: () => swap.now }))

const FADE = 'motion-safe:animate-[site-page-enter_0.26s_ease-out_backwards]'

afterEach(() => {
  swap.now = false
})

function frameOf(text: string) {
  return screen.getByText(text).closest('main')?.parentElement
}

test('a page outside the console fades itself in', () => {
  render(<PublicLayout>page</PublicLayout>)
  expect(frameOf('page')).toHaveClass(FADE)
})

test('arriving through the screen cross-fade, the page does not fade in again', () => {
  swap.now = true
  render(<PublicLayout>page</PublicLayout>)
  expect(frameOf('page')).not.toHaveClass(FADE)
})
