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
import { expect, test } from 'vitest'

import { LiquidGlass } from '../liquid-glass'

test('frosts instead of refracting where the browser cannot filter the backdrop through SVG', () => {
  render(<LiquidGlass className='rounded-full'>Messages</LiquidGlass>)

  const pane = screen.getByText('Messages')
  expect(pane).not.toHaveAttribute('data-refracts')
  expect(pane.style.backdropFilter).toBe('')
  expect(pane.querySelector('filter')).toBeNull()
})

test('the Dock material frosts the same way where the browser cannot refract', () => {
  render(
    <LiquidGlass material='dock' className='rounded-[12px]'>
      Links
    </LiquidGlass>
  )

  const pane = screen.getByText('Links')
  expect(pane).toHaveClass('dock-glass')
  expect(pane).not.toHaveAttribute('data-refracts')
  expect(pane.querySelector('filter')).toBeNull()
})

test('a panel of text keeps its frost', () => {
  render(<LiquidGlass className='rounded-[22px]'>Menu</LiquidGlass>)

  expect(screen.getByText('Menu')).not.toHaveClass('dock-glass')
})
