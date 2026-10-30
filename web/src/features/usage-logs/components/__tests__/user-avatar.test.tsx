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
  type ColumnDef,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { usageLogSchema } from '../../data/schema'
import type { TaskLog } from '../../types'
import { useCommonLogsColumns } from '../columns/common-logs-columns'
import { useTaskLogsColumns } from '../columns/task-logs-columns'
import { UsageLogsMobileList } from '../usage-logs-mobile-card'
import { UsageLogsProvider } from '../usage-logs-provider'

// Chrome gives each mix-blend ::after its own layer; repeated once per row it
// painted blank tiles over the admin logs, so these avatars draw no ::after.
const NO_BLEND_LAYER = 'after:hidden'

const commonLog = usageLogSchema.parse({
  id: 1,
  user_id: 2,
  created_at: 1788840000,
  type: 2,
  content: '',
  model_name: 'gpt-5.5',
  username: 'production-admin',
  token_name: 'backend',
  quota: 5000,
})

const taskLog: TaskLog = {
  id: 1,
  user_id: 2,
  username: 'production-admin',
  platform: 'kling',
  task_id: 'task-1',
  action: 'GENERATE',
  channel_id: 3,
  group: 'default',
  quota: 5000,
  submit_time: 1788840000,
  status: 'SUCCESS',
}

function UserCell<TData>(props: { data: TData; columns: ColumnDef<TData>[] }) {
  const table = useReactTable({
    data: [props.data],
    columns: props.columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'user')
  if (!cell) throw new Error('The admin columns must have a user column')
  return flexRender(cell.column.columnDef.cell, cell.getContext())
}

function CommonTableCell() {
  const columns = useCommonLogsColumns(true, false)
  return <UserCell data={commonLog} columns={columns} />
}

function TaskTableCell() {
  const columns = useTaskLogsColumns(true, false)
  return <UserCell data={taskLog} columns={columns} />
}

function CommonPhoneCard() {
  const table = useReactTable({
    data: [commonLog],
    columns: useCommonLogsColumns(true, false),
    getCoreRowModel: getCoreRowModel(),
  })
  return <UsageLogsMobileList table={table} logCategory='common' />
}

function renderSite(site: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <UsageLogsProvider>{site}</UsageLogsProvider>
    </QueryClientProvider>
  )
}

function avatarOf(text: string): HTMLElement {
  const avatars = screen
    .getAllByText(text)
    .map((element) => element.closest<HTMLElement>('[data-slot="avatar"]'))
    .filter((avatar): avatar is HTMLElement => avatar !== null)
  expect(avatars).toHaveLength(1)
  return avatars[0]
}

const sites = [
  { name: 'common logs table', site: <CommonTableCell /> },
  { name: 'task logs table', site: <TaskTableCell /> },
  { name: 'common logs phone card', site: <CommonPhoneCard /> },
]

it.each(sites)(
  'draws the user avatar of the $name without a blend layer',
  (props) => {
    renderSite(props.site)

    const avatar = avatarOf('P')

    expect(avatar).toHaveClass(NO_BLEND_LAYER)
  }
)
