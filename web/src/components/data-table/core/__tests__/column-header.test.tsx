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
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { DataTableColumnHeader } from '../column-header'

function Fixture(props: { description?: string; sortable?: boolean }) {
  const table = useReactTable({
    data: [{ speed: 1 }],
    columns: [{ accessorKey: 'speed', enableSorting: props.sortable ?? false }],
    getCoreRowModel: getCoreRowModel(),
  })
  const column = table.getColumn('speed')
  if (!column) throw new Error('No speed column')
  return (
    <DataTableColumnHeader
      column={column}
      title='Speed'
      description={props.description}
    />
  )
}

it('shows the description when the question mark is hovered', async () => {
  const user = userEvent.setup()
  render(<Fixture description='Measured on the server.' />)

  expect(screen.getByText('Speed')).toBeVisible()
  await user.hover(
    screen.getByRole('button', { name: 'Measured on the server.' })
  )

  expect(await screen.findByText('Measured on the server.')).toBeVisible()
})

it('keeps the question mark outside the sort menu button', () => {
  render(<Fixture description='Measured on the server.' sortable />)

  expect(
    screen.getByRole('button', { name: 'Measured on the server.' })
  ).not.toHaveAttribute('aria-haspopup')
  expect(screen.getAllByRole('button')).toHaveLength(2)
})

it('adds no question mark without a description', () => {
  render(<Fixture />)

  expect(screen.getByText('Speed')).toBeVisible()
  expect(screen.queryByRole('button')).toBeNull()
})
