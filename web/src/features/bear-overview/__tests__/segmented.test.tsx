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
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'

import { Segmented } from '../components/segmented'

const OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
] as const

function Harness(props: { onChange?: (value: '7' | '30') => void }) {
  const [value, setValue] = useState<'7' | '30'>('7')
  return (
    <Segmented
      label='Time range'
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next)
        props.onChange?.(next)
      }}
    />
  )
}

test('clicking another option presses it and releases the old one', async () => {
  render(<Harness />)
  const group = screen.getByRole('group', { name: 'Time range' })
  const week = screen.getByRole('button', { name: '7 days' })
  const month = screen.getByRole('button', { name: '30 days' })
  expect(group).toContainElement(week)
  expect(week).toHaveAttribute('aria-pressed', 'true')

  await userEvent.click(month)

  expect(month).toHaveAttribute('aria-pressed', 'true')
  expect(week).toHaveAttribute('aria-pressed', 'false')
})

test('clicking the pressed option keeps it pressed and reports nothing', async () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  const week = screen.getByRole('button', { name: '7 days' })

  await userEvent.click(week)

  expect(week).toHaveAttribute('aria-pressed', 'true')
  expect(onChange).not.toHaveBeenCalled()
})

test('arrow keys move focus between the options and Space presses one', async () => {
  render(<Harness />)
  const week = screen.getByRole('button', { name: '7 days' })
  const month = screen.getByRole('button', { name: '30 days' })

  await userEvent.click(week)
  await userEvent.keyboard('{ArrowRight}')
  expect(month).toHaveFocus()

  await userEvent.keyboard(' ')
  expect(month).toHaveAttribute('aria-pressed', 'true')
})

test('options carry no toggle size classes, so .bo-seg alone sizes them', () => {
  render(<Harness />)

  for (const name of ['7 days', '30 days']) {
    const option = screen.getByRole('button', { name })
    // a toggle size would bring a min-width the pill CSS must undo
    expect(option.className).not.toMatch(/\bmin-w-/)
    expect(option).not.toHaveAttribute('data-size')
  }
})
