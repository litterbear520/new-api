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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { usageLogSchema } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { useCommonLogsColumns } from '../columns/common-logs-columns'
import { UsageLogsProvider } from '../usage-logs-provider'

function makeLog(other: LogOtherData, isStream = false) {
  return usageLogSchema.parse({
    id: 1,
    user_id: 1,
    created_at: 1788840000,
    type: 2,
    content: '',
    model_name: 'gpt-5.5',
    quota: 5000,
    prompt_tokens: 1200,
    completion_tokens: 80,
    use_time: 3,
    is_stream: isStream,
    other: JSON.stringify(other),
  })
}

function Cell(props: {
  columnId: string
  other: LogOtherData
  stream?: boolean
}) {
  const table = useReactTable({
    data: [makeLog(props.other, props.stream)],
    columns: useCommonLogsColumns(false, false),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === props.columnId)
  if (!cell) throw new Error(`No ${props.columnId} column`)
  return (
    <div data-testid='cell'>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  )
}

function renderCell(
  columnId: string,
  other: LogOtherData,
  stream = false,
  row: { onClick?: () => void; onKeyDown?: () => void } = {}
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UsageLogsProvider>
        {/* Stands in for the clickable table row. */}
        <div onClick={row.onClick} onKeyDown={row.onKeyDown}>
          <Cell columnId={columnId} other={other} stream={stream} />
        </div>
      </UsageLogsProvider>
    </QueryClientProvider>
  )
  return screen.getByTestId('cell')
}

it('shows only the cache write when nothing was read from the cache', () => {
  const cell = renderCell('cache_tokens', { cache_creation_tokens: 1234 })

  expect(cell).toHaveTextContent(/^↑1,234$/)
})

it('shows the cache read and the write when both happened', () => {
  const cell = renderCell('cache_tokens', {
    cache_tokens: 300,
    cache_creation_tokens: 1234,
  })

  expect(cell).toHaveTextContent(/^300\s*↑1,234$/)
})

it('explains a failed stream with its end reason and soft errors on hover', async () => {
  const user = userEvent.setup()
  renderCell(
    'use_time',
    {
      stream_status: {
        status: 'error',
        end_reason: 'client_gone',
        error_count: 2,
      },
    },
    true
  )

  await user.hover(screen.getByRole('button', { name: 'Stream Status: Error' }))

  expect(await screen.findByText('client_gone')).toBeVisible()
  expect(screen.getByText('Soft Errors: 2')).toBeVisible()
})

it('explains a failed stream when the alert gets keyboard focus', async () => {
  const user = userEvent.setup()
  renderCell(
    'use_time',
    { stream_status: { status: 'error', end_reason: 'timeout' } },
    true
  )

  await user.tab()

  expect(
    screen.getByRole('button', { name: 'Stream Status: Error' })
  ).toHaveFocus()
  expect(await screen.findByText('timeout')).toBeVisible()
})

it('keeps clicks and keys on the stream alert from opening the row', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  const onKeyDown = vi.fn()
  renderCell(
    'use_time',
    { stream_status: { status: 'error', end_reason: 'timeout' } },
    true,
    { onClick, onKeyDown }
  )
  const alert = screen.getByRole('button', { name: 'Stream Status: Error' })

  await user.click(alert)
  alert.focus()
  await user.keyboard('{Enter}')

  expect(onClick).not.toHaveBeenCalled()
  expect(onKeyDown).not.toHaveBeenCalled()
})
